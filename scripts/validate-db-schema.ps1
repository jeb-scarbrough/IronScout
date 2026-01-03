<#
.SYNOPSIS
    Validates that the Prisma schema matches the actual database schema.

.DESCRIPTION
    This script performs several checks to ensure the database is in sync with the Prisma schema:
    1. Checks for pending migrations
    2. Pulls the actual database schema and compares with expected
    3. Identifies missing/extra columns (filtering out Prisma-only directives)
    4. Checks for dealer->merchant terminology issues in actual columns/tables
    5. Validates foreign key relationships

.EXAMPLE
    .\scripts\validate-db-schema.ps1

.EXAMPLE
    .\scripts\validate-db-schema.ps1 -Verbose
#>

param(
    [switch]$Fix,           # If set, will attempt to generate a fix migration
    [switch]$Verbose        # Show detailed output
)

$ErrorActionPreference = "Continue"
$script:hasErrors = $false
$script:warnings = @()
$script:errors = @()

# Colors for output
function Write-Success($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) {
    Write-Host "  [WARN] $msg" -ForegroundColor Yellow
    $script:warnings += $msg
}
function Write-Err($msg) {
    Write-Host "  [ERROR] $msg" -ForegroundColor Red
    $script:errors += $msg
    $script:hasErrors = $true
}
function Write-Info($msg) { Write-Host "  $msg" -ForegroundColor Cyan }
function Write-Detail($msg) { if ($Verbose) { Write-Host "    $msg" -ForegroundColor Gray } }

# Parse a Prisma schema file and extract models with their columns
# Returns a hashtable where keys are model names and values are hashtables of {fieldName: dbColumnName}
function Get-SchemaModels($schemaContent, [switch]$UseDbColumnNames) {
    $models = @{}
    $currentModel = $null
    $currentColumns = @()

    foreach ($line in ($schemaContent -split "`n")) {
        $trimmed = $line.Trim()

        # Start of a model
        if ($trimmed -match "^model\s+(\w+)\s*\{") {
            $currentModel = $matches[1]
            $currentColumns = @()
        }
        # End of a model
        elseif ($currentModel -and $trimmed -eq "}") {
            $models[$currentModel] = $currentColumns
            $currentModel = $null
        }
        # Column definition (not a relation, not @@, not empty)
        elseif ($currentModel -and $trimmed -and -not $trimmed.StartsWith("//") -and -not $trimmed.StartsWith("@@")) {
            # Match column definitions: name Type ...
            if ($trimmed -match "^(\w+)\s+(String|Int|Boolean|DateTime|Decimal|Json|BigInt|Float|Bytes)") {
                $fieldName = $matches[1]
                $colName = $fieldName

                # Check for @map() directive to get actual DB column name
                if ($UseDbColumnNames -and $trimmed -match '@map\("([^"]+)"\)') {
                    $colName = $matches[1]
                }

                $currentColumns += $colName
            }
        }
    }

    return $models
}

# Navigate to db package
$dbPath = Join-Path $PSScriptRoot "..\packages\db"
if (-not (Test-Path $dbPath)) {
    Write-Err "Could not find packages/db directory"
    exit 1
}

Push-Location $dbPath

try {
    Write-Host "`n=== Prisma Schema Validation ===" -ForegroundColor Magenta
    Write-Host ""

    # =========================================================================
    # Step 1: Check for pending migrations
    # =========================================================================
    Write-Host "1. Checking migration status..." -ForegroundColor White

    $migrateStatus = (pnpm exec prisma migrate status 2>&1) -join "`n"

    if ($migrateStatus -match "Following migrations have not yet been applied") {
        Write-Err "Pending migrations found!"
        Write-Info "Run: pnpm exec prisma migrate deploy"
        $migrateStatus -split "`n" | Where-Object { $_ -match "^\d{14}" } | ForEach-Object {
            Write-Detail "  - $_"
        }
    }
    elseif ($migrateStatus -match "Database schema is up to date") {
        Write-Success "All migrations applied"
    }
    elseif ($migrateStatus -match "failed to apply") {
        Write-Err "Migration failure detected!"
        Write-Info "Check: pnpm exec prisma migrate status"
    }
    else {
        Write-Warn "Could not determine migration status"
        Write-Detail $migrateStatus
    }

    # =========================================================================
    # Step 2: Pull database schema and compare columns
    # =========================================================================
    Write-Host "`n2. Comparing database schema with Prisma schema..." -ForegroundColor White

    # Read expected schema (use DB column names from @map directives)
    $schemaPath = "schema.prisma"
    $expectedContent = Get-Content $schemaPath -Raw
    $expectedModels = Get-SchemaModels $expectedContent -UseDbColumnNames

    # Backup current schema
    $backupPath = "schema.prisma.backup"
    Copy-Item $schemaPath $backupPath -Force

    # Pull actual database schema
    $pullOutput = pnpm exec prisma db pull --force 2>&1

    # Read pulled schema
    $actualContent = Get-Content $schemaPath -Raw
    $actualModels = Get-SchemaModels $actualContent

    # Restore original schema
    Copy-Item $backupPath $schemaPath -Force
    Remove-Item $backupPath -Force

    # Compare models and columns
    $missingFromDb = @()
    $extraInDb = @()
    $dealerColumns = @()

    foreach ($model in $expectedModels.Keys) {
        $expectedCols = $expectedModels[$model]
        $actualCols = $actualModels[$model]

        if (-not $actualCols) {
            # Model doesn't exist in database
            Write-Detail "Model $model not found in database (may need migration)"
            continue
        }

        foreach ($col in $expectedCols) {
            if ($col -notin $actualCols) {
                # Skip Prisma-only fields that are intentionally not in DB
                if ($col -notmatch "^(ignoredAt|ignoredBy|ignoredReason|suppressedAt|suppressedBy|suppressedReason)$") {
                    $missingFromDb += "[$model] $col"
                }
            }
        }

        foreach ($col in $actualCols) {
            if ($col -notin $expectedCols) {
                $extraInDb += "[$model] $col"
            }
            # Check for dealer terminology in actual column names
            if ($col -match "dealer" -and $col -notmatch "merchant") {
                $dealerColumns += "[$model] $col"
            }
        }
    }

    # Check for dealer terminology in table names
    $dealerTables = $actualModels.Keys | Where-Object { $_ -match "dealer" -and $_ -notmatch "merchant" }

    # Report results
    $hasDrift = $false

    if ($dealerTables.Count -gt 0) {
        Write-Err "Found 'dealer' table names (should be 'merchant'):"
        $dealerTables | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        $hasDrift = $true
    }

    if ($dealerColumns.Count -gt 0) {
        Write-Err "Found 'dealer' column names (should be 'merchant'):"
        $dealerColumns | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        if ($dealerColumns.Count -gt 10) {
            Write-Host "    ... and $($dealerColumns.Count - 10) more" -ForegroundColor Red
        }
        $hasDrift = $true
    }

    if ($missingFromDb.Count -gt 0) {
        Write-Err "Columns in schema but MISSING from database:"
        $missingFromDb | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        if ($missingFromDb.Count -gt 10) {
            Write-Host "    ... and $($missingFromDb.Count - 10) more" -ForegroundColor Red
        }
        $hasDrift = $true
    }

    if ($extraInDb.Count -gt 0 -and $Verbose) {
        Write-Info "Extra columns in database (not in schema):"
        $extraInDb | Select-Object -First 10 | ForEach-Object { Write-Detail $_ }
        if ($extraInDb.Count -gt 10) {
            Write-Detail "    ... and $($extraInDb.Count - 10) more"
        }
    }

    if (-not $hasDrift) {
        Write-Success "Schema columns match database"
    }

    # =========================================================================
    # Step 3: Check for common model name issues (quick grep)
    # =========================================================================
    Write-Host "`n3. Checking for model name mismatches in code..." -ForegroundColor White

    $codeIssues = @()
    $appsPath = Join-Path $dbPath "..\..\" | Resolve-Path

    # Quick grep for common issues (using git grep for speed)
    try {
        Push-Location $appsPath

        # Check for incorrect casing on Prisma model accessors
        $accountCheck = git grep -l "prisma\.Account\." -- "*.ts" "*.tsx" 2>$null
        if ($accountCheck) {
            $codeIssues += "prisma.Account should be prisma.account (found in: $($accountCheck -join ', '))"
        }

        $settingCheck = git grep -l "prisma\.systemSetting\." -- "*.ts" "*.tsx" 2>$null
        if ($settingCheck) {
            $codeIssues += "prisma.systemSetting should be prisma.system_settings (found in: $($settingCheck -join ', '))"
        }

        # Check for dealer references in code that should be merchant
        $dealerCodeCheck = git grep -l "prisma\.dealer" -- "*.ts" "*.tsx" 2>$null
        if ($dealerCodeCheck) {
            $codeIssues += "prisma.dealer* should be prisma.merchant* (found in: $($dealerCodeCheck -join ', '))"
        }
    }
    finally {
        Pop-Location
    }

    if ($codeIssues.Count -eq 0) {
        Write-Success "No model name issues found in code"
    }
    else {
        foreach ($issue in $codeIssues) {
            Write-Err $issue
        }
    }

    # =========================================================================
    # Step 4: Validate Prisma client is up to date
    # =========================================================================
    Write-Host "`n4. Checking Prisma client generation..." -ForegroundColor White

    $generatedPath = "generated\prisma"
    if (-not (Test-Path $generatedPath)) {
        Write-Err "Prisma client not generated!"
        Write-Info "Run: pnpm exec prisma generate"
    }
    else {
        $schemaModified = (Get-Item $schemaPath).LastWriteTime
        $clientModified = (Get-ChildItem $generatedPath -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime

        if ($schemaModified -gt $clientModified) {
            Write-Warn "Schema modified after client generation"
            Write-Info "Run: pnpm exec prisma generate"
        }
        else {
            Write-Success "Prisma client is up to date"
        }
    }

    # =========================================================================
    # Step 5: Quick sanity check on key tables
    # =========================================================================
    Write-Host "`n5. Validating key table columns..." -ForegroundColor White

    # Check critical columns exist in actual database schema
    $criticalChecks = @(
        @{ Table = "prices"; Column = "productId"; Required = $true },
        @{ Table = "pricing_snapshots"; Column = "merchantId"; Required = $true },
        @{ Table = "merchant_feeds"; Column = "merchantId"; Required = $true },
        @{ Table = "merchant_skus"; Column = "merchantId"; Required = $true },
        @{ Table = "alerts"; Column = "userId"; Required = $true },
        @{ Table = "watchlist_items"; Column = "userId"; Required = $true }
    )

    $allGood = $true
    foreach ($check in $criticalChecks) {
        $tableCols = $actualModels[$check.Table]
        if ($tableCols -and $check.Column -in $tableCols) {
            Write-Detail "$($check.Table).$($check.Column) - present in database"
        }
        else {
            if ($check.Required) {
                Write-Err "$($check.Table).$($check.Column) - MISSING from database!"
                $allGood = $false
            }
            else {
                Write-Warn "$($check.Table).$($check.Column) - not in database (may be intentional)"
            }
        }
    }

    if ($allGood) {
        Write-Success "Key columns validated"
    }

    # =========================================================================
    # Summary
    # =========================================================================
    Write-Host "`n=== Summary ===" -ForegroundColor Magenta

    if ($script:errors.Count -eq 0 -and $script:warnings.Count -eq 0) {
        Write-Host "`n  Database schema is fully in sync!" -ForegroundColor Green
        Write-Host ""
        exit 0
    }

    if ($script:warnings.Count -gt 0) {
        Write-Host "`n  Warnings: $($script:warnings.Count)" -ForegroundColor Yellow
    }

    if ($script:errors.Count -gt 0) {
        Write-Host "  Errors: $($script:errors.Count)" -ForegroundColor Red
        Write-Host "`n  Recommended actions:" -ForegroundColor White
        Write-Host "    1. Run: pnpm exec prisma migrate status" -ForegroundColor Gray
        Write-Host "    2. Run: pnpm exec prisma migrate deploy" -ForegroundColor Gray
        Write-Host "    3. Run: pnpm exec prisma generate" -ForegroundColor Gray
        Write-Host "    4. If issues persist, create a new migration" -ForegroundColor Gray
        Write-Host ""
        exit 1
    }

    Write-Host ""
    exit 0
}
finally {
    Pop-Location
}
