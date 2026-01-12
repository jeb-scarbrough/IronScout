# build-all.ps1
# Test all app builds locally before pushing to Render
#
# Usage:
#   .\scripts\build\build-all.ps1              # Full build + tests
#   .\scripts\build\build-all.ps1 -SkipTests   # Build without running tests
#   .\scripts\build\build-all.ps1 -CheckDeps   # Build + check for outdated packages
#   .\scripts\build\build-all.ps1 -CheckDepsOnly  # Only check packages, skip builds
#   .\scripts\build\build-all.ps1 -Only web,api   # Build specific apps only
#   .\scripts\build\build-all.ps1 -SkipInstall    # Skip pnpm install
#   .\scripts\build\build-all.ps1 -SkipPrisma     # Skip Prisma generation
#   .\scripts\build\build-all.ps1 -SkipSchemaValidation  # Skip DB schema validation

param(
    [switch]$SkipInstall,
    [switch]$SkipPrisma,
    [switch]$SkipTests,    # Skip running tests
    [switch]$SkipSchemaValidation, # Skip database schema validation
    [switch]$CheckDeps,    # Check for outdated dependencies
    [switch]$CheckDepsOnly, # Only check deps, skip builds
    [string[]]$Only  # e.g., -Only web,admin
)

$ErrorActionPreference = "Continue"
$PSStyle.OutputRendering = 'Ansi'
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
try { chcp.com 65001 > $null } catch {}
$startTime = Get-Date

# Initialize fnm (Fast Node Manager) if available
if (-not $env:Path.Contains("WinGet\Links")) {
    $env:Path += ";$env:LOCALAPPDATA\Microsoft\WinGet\Links"
}
if (Get-Command fnm -ErrorAction SilentlyContinue) {
    fnm env --use-on-cd --shell power-shell | Out-String | Invoke-Expression
}

# Colors for output
function Write-Success { param($msg) Write-Host "[PASS] $msg" -ForegroundColor Green }
function Write-Failure { param($msg) Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Header { param($msg) Write-Host "`n========== $msg ==========" -ForegroundColor Yellow }
function Write-Outdated { param($msg) Write-Host "[OUTDATED] $msg" -ForegroundColor Yellow }
function Write-UpToDate { param($msg) Write-Host "[CURRENT] $msg" -ForegroundColor Green }

# Check for outdated dependencies
function Check-Dependencies {
    Write-Header "Checking Dependencies for Updates"

    Write-Info "Scanning all packages across workspaces..."

    # Get all installed packages using pnpm list
    $listOutput = pnpm list -r --depth 0 2>&1 | Out-String

    # Get outdated packages in structured form to avoid table parsing glitches
    $outdatedJson = pnpm outdated -r --format json 2>&1 | Out-String
    $hasOutdated = $LASTEXITCODE -ne 0

    # Parse installed packages
    $allPackages = @{}
    $lines = $listOutput -split "`n"

    foreach ($line in $lines) {
        # Match package lines like: "next 16.1.1" or "dependencies:" section items
        if ($line -match "^\s*(\S+)\s+(\d+\.\d+\.\d+.*)$") {
            $pkgName = $matches[1]
            $version = $matches[2].Trim()

            # Skip workspace packages and noise
            if ($pkgName -match "^@ironscout" -or $pkgName -match "^(dependencies|devDependencies|Legend)") {
                continue
            }

            if (-not $allPackages.ContainsKey($pkgName)) {
                $allPackages[$pkgName] = @{
                    Name = $pkgName
                    Current = $version
                    Latest = $version
                    Status = "current"
                    IsMajor = $false
                }
            }
        }
    }

    # Parse outdated packages and update status
    if ($hasOutdated -and $outdatedJson.Trim().Length -gt 0) {
        try {
            $outdatedData = $outdatedJson | ConvertFrom-Json
        } catch {
            Write-Info "Failed to parse pnpm outdated JSON output; skipping dependency status table."
            $outdatedData = @()
        }

        foreach ($pkg in $outdatedData) {
            $pkgName = $pkg.name
            $current = $pkg.current
            $latest = $pkg.latest
            if (-not $pkgName -or -not $current -or -not $latest) { continue }

            # Determine if it's a major update
            $currentMajor = ($current -split '\.')[0] -replace '[^\d]', ''
            $latestMajor = ($latest -split '\.')[0] -replace '[^\d]', ''
            $isMajor = $currentMajor -ne $latestMajor -and $currentMajor -ne "" -and $latestMajor -ne ""

            $allPackages[$pkgName] = @{
                Name = $pkgName
                Current = $current
                Latest = $latest
                Status = if ($isMajor) { "MAJOR" } else { "minor" }
                IsMajor = $isMajor
            }
        }
    }

    # Sort packages: outdated first (major, then minor), then current by name
    $sortedPackages = $allPackages.Values | Sort-Object {
        if ($_.Status -eq "MAJOR") { 0 }
        elseif ($_.Status -eq "minor") { 1 }
        else { 2 }
    }, Name

    # Display summary table
    Write-Host ""
    Write-Host "Dependency Status Summary" -ForegroundColor White
    Write-Host "=========================" -ForegroundColor White
    Write-Host ""

    # Table header
    $nameWidth = 40
    $versionWidth = 14

    Write-Host ("{0,-$nameWidth} {1,-$versionWidth} {2,-$versionWidth} {3}" -f "Package", "Current", "Latest", "Status") -ForegroundColor Cyan
    Write-Host ("{0,-$nameWidth} {1,-$versionWidth} {2,-$versionWidth} {3}" -f ("-" * 40), ("-" * 14), ("-" * 14), ("-" * 10)) -ForegroundColor DarkGray

    $outdatedCount = 0
    $majorCount = 0
    $minorCount = 0
    $currentCount = 0

    foreach ($pkg in $sortedPackages) {
        # Truncate long package names
        $displayName = if ($pkg.Name.Length -gt 38) { $pkg.Name.Substring(0, 35) + "..." } else { $pkg.Name }

        switch ($pkg.Status) {
            "MAJOR" {
                Write-Host ("{0,-$nameWidth} {1,-$versionWidth} {2,-$versionWidth} " -f $displayName, $pkg.Current, $pkg.Latest) -NoNewline
                Write-Host "MAJOR" -ForegroundColor Yellow
                $outdatedCount++
                $majorCount++
            }
            "minor" {
                Write-Host ("{0,-$nameWidth} {1,-$versionWidth} {2,-$versionWidth} " -f $displayName, $pkg.Current, $pkg.Latest) -NoNewline
                Write-Host "minor" -ForegroundColor DarkYellow
                $outdatedCount++
                $minorCount++
            }
            default {
                Write-Host ("{0,-$nameWidth} {1,-$versionWidth} {2,-$versionWidth} " -f $displayName, $pkg.Current, $pkg.Latest) -NoNewline
                Write-Host "current" -ForegroundColor Green
                $currentCount++
            }
        }
    }

    # Summary
    Write-Host ""
    Write-Host ("-" * 80) -ForegroundColor DarkGray
    Write-Host "Summary:" -ForegroundColor White
    Write-Host "  Total packages:  $($sortedPackages.Count)" -ForegroundColor White
    Write-Host "  Up to date:      $currentCount" -ForegroundColor Green

    if ($majorCount -gt 0) {
        Write-Host "  Major updates:   $majorCount" -ForegroundColor Yellow
    }
    if ($minorCount -gt 0) {
        Write-Host "  Minor updates:   $minorCount" -ForegroundColor DarkYellow
    }

    if ($outdatedCount -gt 0) {
        Write-Host ""
        Write-Host "To update to wanted versions:  pnpm update -r" -ForegroundColor Cyan
        Write-Host "To update to latest versions:  pnpm update -r --latest" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Success "All dependencies are up to date!"
    }

    return @{ Total = $sortedPackages.Count; Outdated = $outdatedCount; UpToDate = ($outdatedCount -eq 0) }
}

# Track results
$results = @{}

# Change to project root (scripts/build -> scripts -> project root)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptsDir = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent $scriptsDir
Set-Location $projectRoot
Write-Info "Project root: $projectRoot"

# Step 0: Validate database schema
if (-not $SkipSchemaValidation) {
    Write-Header "Validating Database Schema"
    $validateScript = Join-Path $scriptsDir "validate-db-schema.ps1"
    if (Test-Path $validateScript) {
        & $validateScript
        if ($LASTEXITCODE -ne 0) {
            Write-Failure "Database schema validation failed"
            Write-Host ""
            Write-Host "Fix schema issues before building. Run:" -ForegroundColor Yellow
            Write-Host "  .\scripts\validate-db-schema.ps1 -Verbose" -ForegroundColor Cyan
            Write-Host ""
            exit 1
        }
        Write-Success "Database schema validated"
    } else {
        Write-Warn "validate-db-schema.ps1 not found, skipping validation"
    }
} else {
    Write-Info "Skipping database schema validation"
}

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

# Step 1.5: Check for outdated dependencies (optional)
if ($CheckDeps -or $CheckDepsOnly) {
    $depResult = Check-Dependencies

    if ($CheckDepsOnly) {
        Write-Host ""
        if ($depResult.UpToDate) {
            Write-Host "Dependency check complete. All packages are up to date." -ForegroundColor Green
        } else {
            Write-Host "Dependency check complete. See outdated packages above." -ForegroundColor Yellow
        }
        exit 0
    }
}

# Step 2: Generate Prisma client
if (-not $SkipPrisma) {
    Write-Header "Generating Prisma Client"

    # Prisma generate requires DATABASE_URL to be set, but doesn't actually connect.
    # Set a dummy URL only for this step, then clear it immediately after.
    $hadDatabaseUrl = [bool]$env:DATABASE_URL
    if (-not $hadDatabaseUrl) {
        $env:DATABASE_URL = "postgresql://dummy:dummy@localhost:5432/dummy"
    }

    Push-Location packages\db
    pnpm prisma generate
    $prismaExit = $LASTEXITCODE
    Pop-Location

    # Clear the dummy URL if we set it
    if (-not $hadDatabaseUrl) {
        Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    }

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
# Note: notifications must be built before admin, merchant, and harvester
$apps = @(
    @{ Name = "notifications"; Filter = "@ironscout/notifications"; Command = "build" },
    @{ Name = "api"; Filter = "@ironscout/api"; Command = "build" },
    @{ Name = "web"; Filter = "@ironscout/web"; Command = "build" },
    @{ Name = "admin"; Filter = "@ironscout/admin"; Command = "build" },
    @{ Name = "merchant"; Filter = "@ironscout/merchant"; Command = "build" },
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

# Step 4: Run tests
$testResults = @{}
if (-not $SkipTests) {
    Write-Header "Running Tests"

    # Define test suites to run
    $testSuites = @(
        @{
            Name = "harvester:schema"
            Description = "Schema validation (catches raw SQL bugs)"
            Filter = "@ironscout/harvester"
            Command = "test:schema"
            Critical = $true  # Fail build if this fails
        },
        @{
            Name = "harvester:unit"
            Description = "Harvester unit tests"
            Filter = "@ironscout/harvester"
            Command = "test:run"
            Critical = $true
        }
    )

    # Filter test suites if -Only specified (only run tests for specified apps)
    if ($Only) {
        $testSuites = $testSuites | Where-Object {
            $suiteName = $_.Name -split ':' | Select-Object -First 1
            $Only -contains $suiteName
        }
    }

    foreach ($suite in $testSuites) {
        $name = $suite.Name
        $description = $suite.Description
        $filter = $suite.Filter
        $command = $suite.Command
        $critical = $suite.Critical

        Write-Info "Running $name ($description)..."
        $testStart = Get-Date

        pnpm --filter $filter run $command 2>&1 | Out-Host
        $exitCode = $LASTEXITCODE
        $duration = [math]::Round(((Get-Date) - $testStart).TotalSeconds, 1)

        if ($exitCode -eq 0) {
            Write-Success "$name passed (${duration}s)"
            $testResults[$name] = @{ Success = $true; Duration = $duration; Critical = $critical }
        } else {
            Write-Failure "$name FAILED"
            $testResults[$name] = @{ Success = $false; Duration = $duration; Critical = $critical }
        }
    }
} else {
    Write-Info "Skipping tests (use without -SkipTests to run)"
}

# Summary
Write-Header "Build Summary"

$totalTime = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
$successCount = ($results.Values | Where-Object { $_.Success }).Count
$failCount = ($results.Values | Where-Object { -not $_.Success }).Count

Write-Host "Builds:" -ForegroundColor Cyan
foreach ($app in $apps) {
    $name = $app.Name
    if ($results.ContainsKey($name)) {
        $result = $results[$name]
        if ($result.Success) {
            Write-Success "  $name - $($result.Duration)s"
        } else {
            Write-Failure "  $name - FAILED"
        }
    }
}

# Test summary
$testSuccessCount = ($testResults.Values | Where-Object { $_.Success }).Count
$testFailCount = ($testResults.Values | Where-Object { -not $_.Success }).Count
$criticalTestsFailed = ($testResults.Values | Where-Object { -not $_.Success -and $_.Critical }).Count

if ($testResults.Count -gt 0) {
    Write-Host ""
    Write-Host "Tests:" -ForegroundColor Cyan
    foreach ($name in $testResults.Keys | Sort-Object) {
        $result = $testResults[$name]
        if ($result.Success) {
            Write-Success "  $name - $($result.Duration)s"
        } else {
            $criticalTag = if ($result.Critical) { " [CRITICAL]" } else { "" }
            Write-Failure "  $name - FAILED$criticalTag"
        }
    }
}

Write-Host ""
$buildStatus = if ($failCount -eq 0) { "Green" } else { "Red" }
$testStatus = if ($testFailCount -eq 0) { "Green" } else { "Red" }

Write-Host "Builds: $successCount passed, $failCount failed" -ForegroundColor $buildStatus
if ($testResults.Count -gt 0) {
    Write-Host "Tests:  $testSuccessCount passed, $testFailCount failed" -ForegroundColor $testStatus
}
Write-Host "Total time: $totalTime`s" -ForegroundColor White

# Check for failures
$hasFailures = $false
$failureReasons = @()

if ($failCount -gt 0) {
    $hasFailures = $true
    $failureReasons += "Failed builds:"
    foreach ($app in $apps) {
        $name = $app.Name
        if ($results.ContainsKey($name) -and -not $results[$name].Success) {
            $failureReasons += "  - $name"
        }
    }
}

if ($criticalTestsFailed -gt 0) {
    $hasFailures = $true
    $failureReasons += "Failed critical tests:"
    foreach ($name in $testResults.Keys) {
        $result = $testResults[$name]
        if (-not $result.Success -and $result.Critical) {
            $failureReasons += "  - $name"
        }
    }
}

if ($hasFailures) {
    Write-Host ""
    foreach ($line in $failureReasons) {
        Write-Host $line -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Fix the errors above before pushing to production." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "All builds and tests passed! Safe to push to Render." -ForegroundColor Green
exit 0
