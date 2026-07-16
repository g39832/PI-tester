<#
.SYNOPSIS
  DispoScan SFC (System File Checker) Diagnostic Module
.DESCRIPTION
  Runs SFC /SCANNOW and returns the result. Deep Scan only.
  Requires administrator privileges. May take several minutes.
.EXAMPLE
  Invoke-SfcDiagnostic
#>

function Invoke-SfcDiagnostic {
  $start = Get-Date
  $result = @{ status = 'running'; data = @{}; warnings = @(); duration = $null; progressMessage = 'Starting SFC scan...' }

  try {
    # Check admin
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
      $result.status = 'skipped'
      $result.warnings = @('SFC scan requires administrator privileges')
      $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)
      return $result
    }

    $result.progressMessage = 'Running SFC /SCANNOW (this may take several minutes)...'
    $sfcResult = sfc /SCANNOW 2>&1
    $output = $sfcResult -join "`n"

    $data = @{ rawOutput = $output; exitCode = $LASTEXITCODE }

    if ($LASTEXITCODE -eq 0) {
      $data.summary = 'No integrity violations found'
      $result.status = 'completed'
    } elseif ($LASTEXITCODE -eq 1) {
      $data.summary = 'Corrupted files found and repaired'
      $result.warnings = @('SFC found and repaired corrupted system files')
      $result.status = 'completed'
    } elseif ($LASTEXITCODE -eq 2) {
      $data.summary = 'Corrupted files found but could not be repaired'
      $result.warnings = @('SFC found corrupted files that could not be automatically repaired')
      if ($output -match 'Windows Resource Protection found corrupt files') {
        $result.warnings += 'Review CBS.log for details on unrepaired files'
      }
      $result.status = 'warning'
    } else {
      $data.summary = "SFC completed with exit code $LASTEXITCODE"
      $result.status = 'completed'
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
  Invoke-SfcDiagnostic | ConvertTo-Json -Compress -Depth 5
}
