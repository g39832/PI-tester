<#
.SYNOPSIS
  DispoScan Driver Diagnostic Module
.DESCRIPTION
  Scans for missing, outdated, or problematic drivers.
  Returns structured JSON with status and data.
.EXAMPLE
  Invoke-DriverDiagnostic
#>

function Invoke-DriverDiagnostic {
  $start = Get-Date
  $result = @{ status = 'completed'; data = @{}; warnings = @(); duration = $null }

  try {
    $problemDrivers = @()
    $allDrivers = @()

    try {
      $devices = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue
      if ($devices) {
        foreach ($dev in $devices) {
          $status = if ($dev.Status -eq 'OK') { 'ok' } else { 'problem' }
          $allDrivers += @{
            name        = $dev.FriendlyName
            class       = $dev.Class
            status      = $status
            problem     = $dev.Problem
            problemText = if ($dev.Problem) { (Get-PnpDeviceProperty -InstanceId $dev.InstanceId -KeyName 'DEVPKEY_Device_ProblemText' -ErrorAction SilentlyContinue).Data } else { $null }
            driverDate  = $dev.DriverDate
            driverVersion = $dev.DriverVersion
          }
          if ($status -eq 'problem') {
            $problemDrivers += $dev
            $result.warnings += "Problematic driver: $($dev.FriendlyName) (Problem: $($dev.Problem))"
          }
        }
      }
    } catch {}

    # Check for missing drivers via PnP
    try {
      $unknown = Get-PnpDevice -InstanceId 'ROOT\*' -ErrorAction SilentlyContinue | Where-Object { $_.Class -eq 'Unknown' }
      if ($unknown) {
        foreach ($unk in $unknown) {
          $result.warnings += "Unknown device detected: $($unk.FriendlyName)"
        }
      }
    } catch {}

    $result.data = @{
      totalDrivers    = $allDrivers.Count
      problemCount    = $problemDrivers.Count
      problemDrivers  = $allDrivers | Where-Object { $_.status -eq 'problem' }
      allDrivers      = $allDrivers
    }
  } catch {
    $result.status = 'failed'
    $result.warnings = @($_.Exception.Message)
  }

  $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)
  return $result
}

if ($MyInvocation.InvocationName -eq '&' -or $MyInvocation.CommandOrigin -eq 'Runspace') {
  Invoke-DriverDiagnostic | ConvertTo-Json -Compress -Depth 5
}
