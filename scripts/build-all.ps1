# build-all.ps1
# Test all app builds locally before pushing to Render
# Usage: .\scripts\build-all.ps1

param(
    [switch]$SkipInstall,
    [switch]$SkipPrisma,
    [string[]]$Only  # e.g., -Only web,admin
)

$ErrorActionPreference = "Continue"
$startTime = Get-Date

# Colors for output
function Write-Success { param($msg) Write-Host "[PASS] $msg" -ForegroundColor Green }
function Write-Failure { param($msg) Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Header { param($msg) Write-Host "`n========== $msg ==========" -ForegroundColor Yellow }

# Track results
$results = @{}

# Change to project root
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot
Write-Info "Project root: $projectRoot"

# Step 1: Install dependencies
if (-not $SkipInstall) {
    Write-Header "Installing Dependencies"
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependencies installed"
    } else {
        Write-Failure "Dependency installation failed"
        exit 1
    }
} else {
    Write-Info "Skipping dependency installation"
}

# Step 2: Generate Prisma client
if (-not $SkipPrisma) {
    Write-Header "Generating Prisma Client"
    Push-Location packages\db
    pnpm prisma generate
    $prismaExit = $LASTEXITCODE
    Pop-Location
    if ($prismaExit -eq 0) {
        Write-Success "Prisma client generated"
    } else {
        Write-Failure "Prisma generation failed"
        exit 1
    }
} else {
    Write-Info "Skipping Prisma generation"
}

# Define apps to build (in dependency order)
# Note: notifications must be built before admin, dealer, and harvester
$apps = @(
    @{ Name = "notifications"; Filter = "@ironscout/notifications"; Command = "build" },
    @{ Name = "api"; Filter = "@ironscout/api"; Command = "build" },
    @{ Name = "web"; Filter = "@ironscout/web"; Command = "build" },
    @{ Name = "admin"; Filter = "@ironscout/admin"; Command = "build" },
    @{ Name = "dealer"; Filter = "@ironscout/dealer"; Command = "build" },
    @{ Name = "harvester"; Filter = "@ironscout/harvester"; Command = "build" }
)

# Filter apps if -Only specified
if ($Only) {
    $apps = $apps | Where-Object { $Only -contains $_.Name }
    Write-Info "Building only: $($Only -join ', ')"
}

# Step 3: Build each app
Write-Header "Building Apps"

foreach ($app in $apps) {
    $name = $app.Name
    $filter = $app.Filter
    $command = $app.Command
    
    Write-Info "Building $name..."
    $buildStart = Get-Date
    
    pnpm --filter $filter run $command
    $exitCode = $LASTEXITCODE
    $duration = [math]::Round(((Get-Date) - $buildStart).TotalSeconds, 1)
    
    if ($exitCode -eq 0) {
        Write-Success "$name built successfully (${duration}s)"
        $results[$name] = @{ Success = $true; Duration = $duration }
    } else {
        Write-Failure "$name build failed"
        $results[$name] = @{ Success = $false; Duration = $duration }
    }
}

# Summary
Write-Header "Build Summary"

$totalTime = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
$successCount = ($results.Values | Where-Object { $_.Success }).Count
$failCount = ($results.Values | Where-Object { -not $_.Success }).Count

foreach ($app in $apps) {
    $name = $app.Name
    if ($results.ContainsKey($name)) {
        $result = $results[$name]
        if ($result.Success) {
            Write-Success "$name - $($result.Duration)s"
        } else {
            Write-Failure "$name - FAILED"
        }
    }
}

Write-Host ""
if ($failCount -eq 0) {
    Write-Host "Total: $successCount passed, $failCount failed ($totalTime`s)" -ForegroundColor Green
} else {
    Write-Host "Total: $successCount passed, $failCount failed ($totalTime`s)" -ForegroundColor Red
}

if ($failCount -gt 0) {
    Write-Host "`nFailed builds:" -ForegroundColor Red
    foreach ($app in $apps) {
        $name = $app.Name
        if ($results.ContainsKey($name) -and -not $results[$name].Success) {
            Write-Host "  - $name" -ForegroundColor Red
        }
    }
    Write-Host "`nFix the errors above before pushing to Render." -ForegroundColor Yellow
    exit 1
}

Write-Host "`nAll builds passed! Safe to push to Render." -ForegroundColor Green
exit 0
