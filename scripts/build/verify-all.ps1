# verify-all.ps1
# Build and start all services, verify they start correctly, then stop
# Usage: .\scripts\verify-all.ps1
#
# This script is useful for CI/CD or pre-commit verification

param(
    [switch]$SkipBuild,
    [int]$Timeout = 45  # seconds to wait for services
)

$ErrorActionPreference = "Continue"

# Colors for output
function Write-Success { param($msg) Write-Host "[PASS] $msg" -ForegroundColor Green }
function Write-Failure { param($msg) Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Header { param($msg) Write-Host "`n========== $msg ==========`n" -ForegroundColor Yellow }

# Change to project root (scripts/build -> scripts -> project root)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptsDir = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent $scriptsDir
Set-Location $projectRoot
Write-Info "Project root: $projectRoot"

# Track results
$results = @()
$jobs = @()
$overallSuccess = $true

# Define services with their start commands
$services = @(
    @{
        Name = "api"
        Port = 8000
        Command = "pnpm --filter @ironscout/api start"
        HealthCheck = "http://localhost:8000/health"
    },
    @{
        Name = "web"
        Port = 3000
        Command = "pnpm --filter @ironscout/web start"
        HealthCheck = "http://localhost:3000"
    },
    @{
        Name = "admin"
        Port = 3002
        Command = "pnpm --filter @ironscout/admin start"
        HealthCheck = "http://localhost:3002"
    },
    @{
        Name = "dealer"
        Port = 3003
        Command = "pnpm --filter @ironscout/dealer start"
        HealthCheck = "http://localhost:3003"
    }
)

# Build first if not skipped
if (-not $SkipBuild) {
    Write-Header "Building All Services"
    & "$projectRoot\scripts\build-all.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Failure "Build failed. Fix errors before verifying runtime."
        exit 1
    }
    Write-Success "Build completed successfully"
}

Write-Header "Starting Services for Verification"

# Start each service as a background job
foreach ($service in $services) {
    $name = $service.Name
    $port = $service.Port
    $command = $service.Command

    Write-Info "Starting $name on port $port..."

    # Start as background job
    $job = Start-Job -Name $name -ScriptBlock {
        param($root, $cmd)
        Set-Location $root
        # Set DATABASE_URL for Prisma
        $env:DATABASE_URL = "postgresql://test:test@localhost:5432/test"
        Invoke-Expression $cmd 2>&1
    } -ArgumentList $projectRoot, $command

    $jobs += @{ Name = $name; Job = $job; Port = $port; HealthCheck = $service.HealthCheck }

    # Small delay between service starts
    Start-Sleep -Seconds 1
}

Write-Header "Verifying Services ($Timeout second timeout)"

# Wait and check health
$startTime = Get-Date

foreach ($svc in $jobs) {
    $name = $svc.Name
    $healthCheck = $svc.HealthCheck
    $job = $svc.Job

    Write-Host "Checking $name..." -NoNewline

    $ready = $false
    $error = $null

    while (-not $ready -and ((Get-Date) - $startTime).TotalSeconds -lt $Timeout) {
        # Check if job failed
        if ($job.State -eq "Failed" -or $job.State -eq "Stopped") {
            $error = "Job exited unexpectedly"
            $jobOutput = Receive-Job -Job $job -ErrorAction SilentlyContinue
            if ($jobOutput) {
                $error = $jobOutput | Select-Object -Last 5 | Out-String
            }
            break
        }

        # Try health check
        try {
            $response = Invoke-WebRequest -Uri $healthCheck -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 302) {
                $ready = $true
            }
        } catch {
            Write-Host "." -NoNewline
            Start-Sleep -Seconds 2
        }
    }

    if ($ready) {
        Write-Success " OK"
        $results += @{ Name = $name; Status = "PASS"; Message = "Started successfully" }
    } else {
        if (-not $error) { $error = "Timeout waiting for service" }
        Write-Failure " FAILED"
        $results += @{ Name = $name; Status = "FAIL"; Message = $error }
        $overallSuccess = $false
    }
}

Write-Header "Stopping All Services"

foreach ($svc in $jobs) {
    Write-Info "Stopping $($svc.Name)..."
    Stop-Job -Job $svc.Job -ErrorAction SilentlyContinue
    Remove-Job -Job $svc.Job -Force -ErrorAction SilentlyContinue
}

Write-Header "Verification Results"

# Display results table
Write-Host "`nService          Status     Message" -ForegroundColor White
Write-Host "-------          ------     -------" -ForegroundColor Gray

foreach ($result in $results) {
    $name = $result.Name.PadRight(16)
    $status = $result.Status
    $statusColor = if ($status -eq "PASS") { "Green" } else { "Red" }
    $message = $result.Message

    Write-Host "$name " -NoNewline
    Write-Host $status.PadRight(10) -ForegroundColor $statusColor -NoNewline
    Write-Host " $message"
}

Write-Host ""

if ($overallSuccess) {
    Write-Success "All services verified successfully!"
    exit 0
} else {
    Write-Failure "Some services failed verification"
    exit 1
}
