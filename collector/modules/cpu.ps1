<#
.SYNOPSIS
  DispoScan CPU Diagnostic Module
.DESCRIPTION
  Collects CPU information: model, cores, threads, speed, architecture, cache.
  Returns structured JSON with status and data.
.EXAMPLE
  Invoke-CpuDiagnostic
#>

function Invoke-CpuDiagnostic {
  $start = Get-Date
  $result = @{ status = 'completed'; data = @{}; warnings = @(); duration = $null }

  try {
    $cpu = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cpu) {
      $result.data = @{
        model        = ($cpu.Name -replace '\s+', ' ').Trim()
        cores        = $cpu.NumberOfCores
        threads      = $cpu.NumberOfLogicalProcessors
        speed        = "$($cpu.MaxClockSpeed) MHz"
        architecture = @{ 0='x86'; 1='MIPS'; 2='Alpha'; 3='PowerPC'; 5='ARM'; 6='x64'; 9='ARM64' }[[int]$cpu.Architecture]
        l2Cache      = "$($cpu.L2CacheSize) KB"
        l3Cache      = "$($cpu.L3CacheSize) KB"
        socket       = $cpu.SocketDesignation
      }
      if ($cpu.LoadPercentage -ge 0) { $result.data.load = $cpu.LoadPercentage }
    } else {
      $result.status = 'skipped'
      $result.warnings = @('No CPU information available')
    }
  } catch {
    $result.status = 'failed'
    $result.warnings = @($_.Exception.Message)
  }

  $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)
  return $result
}

if ($MyInvocation.InvocationName -eq '&' -or $MyInvocation.CommandOrigin -eq 'Runspace') {
  Invoke-CpuDiagnostic | ConvertTo-Json -Compress -Depth 5
}
