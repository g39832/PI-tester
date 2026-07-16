<#
.SYNOPSIS
  DispoScan GPU Diagnostic Module
.DESCRIPTION
  Collects GPU information: model, VRAM, driver version, resolution.
  Returns structured JSON with status and data.
.EXAMPLE
  Invoke-GpuDiagnostic
#>

function Invoke-GpuDiagnostic {
  $start = Get-Date
  $result = @{ status = 'completed'; data = @{}; warnings = @(); duration = $null }

  try {
    $gpu = Get-CimInstance -ClassName Win32_VideoController -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($gpu) {
      $result.data = @{
        model       = $gpu.Name.Trim()
        vram        = if ($gpu.AdapterRAM) { "$([math]::Round($gpu.AdapterRAM / 1MB, 0)) MB" } else { 'unknown' }
        driver      = $gpu.DriverVersion
        driverDate  = "$($gpu.DriverDate)"
        resolution  = "$($gpu.CurrentHorizontalResolution)x$($gpu.CurrentVerticalResolution)"
        refreshRate = if ($gpu.CurrentRefreshRate) { "$($gpu.CurrentRefreshRate) Hz" } else { $null }
      }
      if ($gpu.ConfigManagerErrorCode -and $gpu.ConfigManagerErrorCode -ne 0) {
        $result.warnings += "GPU has device error code $($gpu.ConfigManagerErrorCode)"
      }
    } else {
      $result.status = 'skipped'
      $result.warnings = @('No GPU detected')
    }
  } catch {
    $result.status = 'failed'
    $result.warnings = @($_.Exception.Message)
  }

  $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)
  return $result
}

if ($MyInvocation.InvocationName -eq '&' -or $MyInvocation.CommandOrigin -eq 'Runspace') {
  Invoke-GpuDiagnostic | ConvertTo-Json -Compress -Depth 5
}
