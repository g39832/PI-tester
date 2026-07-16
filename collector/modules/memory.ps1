<#
.SYNOPSIS
  DispoScan Memory Diagnostic Module
.DESCRIPTION
  Collects RAM information: total capacity, modules, speeds, form factor.
  Returns structured JSON with status and data.
.EXAMPLE
  Invoke-MemoryDiagnostic
#>

function Invoke-MemoryDiagnostic {
  $start = Get-Date
  $result = @{ status = 'completed'; data = @{}; warnings = @(); duration = $null }

  try {
    $modules = Get-CimInstance -ClassName Win32_PhysicalMemory -ErrorAction SilentlyContinue
    if ($modules -and $modules.Count -gt 0) {
      $totalBytes = 0
      $moduleList = @()
      foreach ($mod in $modules) {
        $totalBytes += $mod.Capacity
        $moduleList += @{
          capacity = "$([math]::Round($mod.Capacity / 1GB, 0)) GB"
          speed    = "$($mod.Speed) MHz"
          manufacturer = $mod.Manufacturer
          partNumber   = $mod.PartNumber
          slot         = $mod.ConfiguredClockSpeed
        }
      }
      $result.data = @{
        totalGb     = [math]::Round($totalBytes / 1GB, 1)
        moduleCount = $modules.Count
        modules     = $moduleList
        formFactor  = if ($modules.Count -gt 1) { "Multiple" } else { "Single" }
      }
    } else {
      $result.status = 'skipped'
      $result.warnings = @('No memory modules detected')
    }
  } catch {
    $result.status = 'failed'
    $result.warnings = @($_.Exception.Message)
  }

  $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)
  return $result
}

if ($MyInvocation.InvocationName -eq '&' -or $MyInvocation.CommandOrigin -eq 'Runspace') {
  Invoke-MemoryDiagnostic | ConvertTo-Json -Compress -Depth 5
}
