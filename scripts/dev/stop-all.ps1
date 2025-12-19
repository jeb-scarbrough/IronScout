# stop-all.ps1
# Stop all running IronScout services with graceful shutdown
# Usage: .\scripts\dev\stop-all.ps1
#
# Options:
#   -Force    Skip graceful shutdown and force kill immediately
#   -Timeout  Seconds to wait for graceful shutdown (default: 10)

param(
    [switch]$Force,
    [int]$Timeout = 10
)

$ErrorActionPreference = "SilentlyContinue"

# Colors for output
function Write-Success { param($msg) Write-Host "[PASS] $msg" -ForegroundColor Green }
function Write-Failure { param($msg) Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Header { param($msg) Write-Host "`n========== $msg ==========`n" -ForegroundColor Yellow }

Write-Header "Stopping All IronScout Services"

if ($Force) {
    Write-Warning "Force mode enabled - skipping graceful shutdown"
}

# Helper function to send Ctrl+C to a process (Windows SIGINT equivalent)
# This uses a small C# snippet to call GenerateConsoleCtrlEvent
$sendCtrlCDefined = $false
function Send-CtrlC {
    param([int]$ProcessId)

    # Define the P/Invoke signature if not already done
    if (-not ([System.Management.Automation.PSTypeName]'ConsoleCtrl').Type) {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class ConsoleCtrl {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GenerateConsoleCtrlEvent(uint dwCtrlEvent, uint dwProcessGroupId);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool AttachConsole(uint dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool FreeConsole();

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetConsoleCtrlHandler(IntPtr HandlerRoutine, bool Add);

    public const uint CTRL_C_EVENT = 0;
    public const uint CTRL_BREAK_EVENT = 1;
}
"@
    }

    try {
        # Disable Ctrl+C handling in our own process so we don't kill ourselves
        [ConsoleCtrl]::SetConsoleCtrlHandler([IntPtr]::Zero, $true) | Out-Null

        # Attach to the target process's console
        [ConsoleCtrl]::FreeConsole() | Out-Null
        $attached = [ConsoleCtrl]::AttachConsole($ProcessId)

        if ($attached) {
            # Send Ctrl+C to the process group (0 = all processes attached to console)
            [ConsoleCtrl]::GenerateConsoleCtrlEvent([ConsoleCtrl]::CTRL_C_EVENT, 0) | Out-Null
            Start-Sleep -Milliseconds 100
            [ConsoleCtrl]::FreeConsole() | Out-Null
        }

        # Re-enable Ctrl+C handling
        [ConsoleCtrl]::SetConsoleCtrlHandler([IntPtr]::Zero, $false) | Out-Null

        return $attached
    } catch {
        return $false
    }
}

# Helper function to gracefully stop a process
function Stop-ProcessGracefully {
    param(
        [int]$ProcessId,
        [string]$ProcessName,
        [int]$TimeoutSeconds,
        [switch]$ForceImmediate
    )

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $process) {
        return $false
    }

    if ($ForceImmediate) {
        Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
        return $true
    }

    Write-Info "    Sending graceful shutdown signal (Ctrl+C)..."

    # Try to send Ctrl+C signal (SIGINT equivalent on Windows)
    $signalSent = Send-CtrlC -ProcessId $ProcessId

    if (-not $signalSent) {
        Write-Host "    (Could not attach to console, will force kill)" -ForegroundColor Gray
    }

    # Wait for process to exit gracefully
    $waited = 0
    while ($waited -lt $TimeoutSeconds) {
        Start-Sleep -Seconds 1
        $waited++

        $stillRunning = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if (-not $stillRunning) {
            Write-Success "    Graceful shutdown complete (${waited}s)"
            return $true
        }

        if ($waited % 3 -eq 0) {
            Write-Host "    Waiting for graceful shutdown... (${waited}s/$TimeoutSeconds)" -ForegroundColor Gray
        }
    }

    # Process didn't exit gracefully, force kill
    Write-Warning "    Timeout reached, forcing shutdown..."
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500

    $stillRunning = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $stillRunning) {
        Write-Success "    Force shutdown complete"
        return $true
    }

    Write-Failure "    Failed to stop process"
    return $false
}

# Define ports used by services
$servicePorts = @(
    @{ Name = "API"; Port = 8000 },
    @{ Name = "Web"; Port = 3000 },
    @{ Name = "Admin"; Port = 3002 },
    @{ Name = "Dealer"; Port = 3003 }
)

$stoppedCount = 0

# Stop processes by port using Get-NetTCPConnection (more reliable on Windows)
foreach ($service in $servicePorts) {
    $name = $service.Name
    $port = $service.Port

    Write-Info "Checking $name on port $port..."

    try {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

        if ($connections) {
            foreach ($conn in $connections) {
                $processId = $conn.OwningProcess
                if ($processId -and $processId -gt 0) {
                    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-Info "  Stopping $($process.ProcessName) (PID: $processId)..."
                        $stopped = Stop-ProcessGracefully -ProcessId $processId -ProcessName $process.ProcessName -TimeoutSeconds $Timeout -ForceImmediate:$Force
                        if ($stopped) {
                            $stoppedCount++
                            Write-Success "  Stopped $name"
                        }
                    }
                }
            }
        } else {
            Write-Host "  Not running" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  Not running" -ForegroundColor Gray
    }
}

# Stop any node processes running IronScout apps (including harvester worker)
Write-Info "Checking for Node.js processes (including harvester)..."

$nodeStoppedCount = 0
try {
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue

    if ($nodeProcesses) {
        foreach ($proc in $nodeProcesses) {
            try {
                $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)" -ErrorAction SilentlyContinue).CommandLine
                if ($cmdLine -and ($cmdLine -match "ironscout|@ironscout" -or $cmdLine -match "apps[\\/](web|api|admin|dealer|harvester)")) {
                    $appName = if ($cmdLine -match "harvester") { "Harvester" }
                               elseif ($cmdLine -match "apps[\\/]web") { "Web" }
                               elseif ($cmdLine -match "apps[\\/]api") { "API" }
                               elseif ($cmdLine -match "apps[\\/]admin") { "Admin" }
                               elseif ($cmdLine -match "apps[\\/]dealer") { "Dealer" }
                               else { "IronScout" }
                    Write-Info "  Stopping $appName node process (PID: $($proc.Id))..."
                    $stopped = Stop-ProcessGracefully -ProcessId $proc.Id -ProcessName $appName -TimeoutSeconds $Timeout -ForceImmediate:$Force
                    if ($stopped) {
                        $stoppedCount++
                        $nodeStoppedCount++
                    }
                }
            } catch {
                # Skip this process
            }
        }
        if ($nodeStoppedCount -gt 0) {
            Write-Success "Stopped $nodeStoppedCount IronScout Node.js process(es)"
        } else {
            Write-Host "  No IronScout Node.js processes found" -ForegroundColor Gray
        }
    } else {
        Write-Host "  No Node.js processes found" -ForegroundColor Gray
    }
} catch {
    Write-Host "  No Node.js processes found" -ForegroundColor Gray
}

# Stop PowerShell background jobs from start-all.ps1
Write-Info "Checking for background jobs..."

try {
    $jobs = Get-Job | Where-Object { $_.Name -in @("api", "web", "admin", "dealer", "harvester") }
    if ($jobs) {
        foreach ($job in $jobs) {
            Write-Info "  Stopping job: $($job.Name)..."
            Stop-Job -Job $job -ErrorAction SilentlyContinue
            Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
            $stoppedCount++
        }
        Write-Success "Stopped background jobs"
    } else {
        Write-Host "  No background jobs found" -ForegroundColor Gray
    }
} catch {
    Write-Host "  No background jobs found" -ForegroundColor Gray
}

Write-Header "Summary"

if ($stoppedCount -gt 0) {
    Write-Success "Stopped $stoppedCount process(es)/job(s)"
    if (-not $Force) {
        Write-Info "Used graceful shutdown with ${Timeout}s timeout"
    }
} else {
    Write-Info "No IronScout services were running"
}

Write-Host ""
Write-Info "Tip: Use -Force for immediate shutdown, -Timeout N to change wait time"
