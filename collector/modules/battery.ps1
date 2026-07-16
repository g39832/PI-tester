<#
.SYNOPSIS
  DispoScan Battery Diagnostic Module
.DESCRIPTION
  Collects battery information: health, cycle count, design vs full charge capacity,
  wear level, chemistry. Returns structured JSON with status and data.
.EXAMPLE
  Invoke-BatteryDiagnostic
#>

function Invoke-BatteryDiagnostic {
  $start = Get-Date
  $result = @{ status = 'completed'; data = @{}; warnings = @(); duration = $null }

  try {
    $bat = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($bat) {
      $designCap = $bat.DesignCapacity
      $fullCap = $bat.FullChargeCapacity
      $wearLevel = if ($designCap -and $designCap -gt 0) {
        [math]::Round((1 - ($fullCap / $designCap)) * 100, 1)
      } else { $null }

      $result.data = @{
        present             = $true
        health             = [math]::Round($bat.EstimatedChargeRemaining)
        status             = if ($bat.BatteryStatus -eq 2) { 'charging' } else { 'discharging' }
        chemistry          = $bat.Chemistry
        designCapacity     = $designCap
        fullChargeCapacity = $fullCap
        designCapacityStr  = if ($designCap) { "$designCap mWh" } else { 'unknown' }
        fullChargeStr      = if ($fullCap) { "$fullCap mWh" } else { 'unknown' }
        cycleCount         = $bat.CycleCount
        wearLevel          = $wearLevel
        estimatedRunTime   = $bat.EstimatedRunTime
        voltage            = if ($bat.DesignVoltage) { "$($bat.DesignVoltage) mV" } else { $null }
      }

      if ($wearLevel -ge 30) {
        $result.warnings += "Battery wear level critically high ($wearLevel%). Consider replacement."
      } elseif ($wearLevel -ge 15) {
        $result.warnings += "Battery wear level elevated ($wearLevel%). Schedule replacement."
      }
      if ($bat.EstimatedChargeRemaining -lt 30) {
        $result.warnings += "Battery charge remaining critically low ($($bat.EstimatedChargeRemaining)%)"
      }
      if ($bat.CycleCount -and $bat.CycleCount -gt 500) {
        $result.warnings += "Battery cycle count high ($($bat.CycleCount) cycles)"
      }
    } else {
      $result.data = @{ present = $false }
    }
  } catch {
    $result.status = 'failed'
    $result.warnings = @($_.Exception.Message)
  }

  $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)
  return $result
}

if ($MyInvocation.InvocationName -eq '&' -or $MyInvocation.CommandOrigin -eq 'Runspace') {
  Invoke-BatteryDiagnostic | ConvertTo-Json -Compress -Depth 5
}
