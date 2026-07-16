<#
.SYNOPSIS
  DispoScan File System Check Diagnostic Module
.DESCRIPTION
  Runs chkdsk on the system drive in read-only mode to check for
  file system errors. Deep Scan only. Requires administrator privileges.
.EXAMPLE
  Invoke-FileSystemCheck
#>

function Invoke-FileSystemCheck {
  $start = Get-Date
  $result = @{ status = 'running'; data = @{}; warnings = @(); duration = $null; progressMessage = 'Starting file system check...' }

  try {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
      $result.status = 'skipped'
      $result.warnings = @('File system check requires administrator privileges')
      $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)
      return $result
    }

    $systemDrive = $env:SystemDrive
    $result.progressMessage = "Checking file system on $systemDrive (read-only)..."

    $chkdsk = chkdsk $systemDrive 2>&1
    $output = $chkdsk -join "`n"

    $data = @{
      drive    = $systemDrive
      rawOutput = $output
      exitCode = $LASTEXITCODE
    }

    if ($output -match 'No further action is required' -or $output -match 'Windows has checked the file system and found no problems') {
      $data.summary = 'File system clean — no errors found'
      $result.status = 'completed'
    } elseif ($output -match 'found' -and $output -match 'bad') {
      $data.summary = 'File system errors detected'
      $result.warnings = @('chkdsk found file system errors on the system drive')
      $result.status = 'warning'
    } else {
      $data.summary = "File system check completed (exit code $LASTEXITCODE)"
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
  Invoke-FileSystemCheck | ConvertTo-Json -Compress -Depth 5
}
