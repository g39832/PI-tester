<#
.SYNOPSIS
  DispoScan DISM Health Diagnostic Module
.DESCRIPTION
  Runs DISM /Online /Cleanup-Image /RestoreHealth and returns result.
  Deep Scan only. Requires administrator privileges.
  Should be run BEFORE SFC scan (Microsoft guidance).
.EXAMPLE
  Invoke-DismDiagnostic
#>

function Invoke-DismDiagnostic {
  $start = Get-Date
  $result = @{ status = 'running'; data = @{}; warnings = @(); duration = $null; progressMessage = 'Starting DISM health check...' }

  try {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
      $result.status = 'skipped'
      $result.warnings = @('DISM scan requires administrator privileges')
      $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)
      return $result
    }

    # First run CheckHealth (fast)
    $result.progressMessage = 'Checking image health...'
    $checkHealth = dism /Online /Cleanup-Image /CheckHealth 2>&1
    $checkOutput = $checkHealth -join "`n"

    # Then run ScanHealth (medium)
    $result.progressMessage = 'Scanning image for corruption...'
    $scanHealth = dism /Online /Cleanup-Image /ScanHealth 2>&1
    $scanOutput = $scanHealth -join "`n"

    # Finally run RestoreHealth (may take long, download files)
    $result.progressMessage = 'Restoring image health (this may take a while with internet download)...'
    $restoreHealth = dism /Online /Cleanup-Image /RestoreHealth 2>&1
    $restoreOutput = $restoreHealth -join "`n"

    $data = @{
      checkHealthOutput  = $checkOutput
      scanHealthOutput   = $scanOutput
      restoreHealthOutput = $restoreOutput
      exitCode           = $LASTEXITCODE
    }

    if ($LASTEXITCODE -eq 0) {
      $data.summary = 'Image healthy — no corruption detected'
      $result.status = 'completed'
    } elseif ($LASTEXITCODE -eq 2) {
      $data.summary = 'Image corruption detected'
      $result.warnings = @('DISM detected component store corruption')
      if ($restoreOutput -match 'The restore operation completed successfully') {
        $result.warnings = @('Component store corruption was repaired successfully')
        $result.status = 'completed'
      } else {
        $result.status = 'warning'
      }
    } else {
      $data.summary = "DISM completed with exit code $LASTEXITCODE"
      $result.status = 'warning'
      $result.warnings = @("DISM scan completed with exit code $LASTEXITCODE. Review output for details.")
    }

    $result.data = $data
  } catch {
    $result.status = 'failed'
    $result.warnings = @($_.Exception.Message)
  }

  $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)
  $result.progressMessage = $null
  return $result
}

if ($MyInvocation.InvocationName -eq '&' -or $MyInvocation.CommandOrigin -eq 'Runspace') {
  Invoke-DismDiagnostic | ConvertTo-Json -Compress -Depth 5
}
