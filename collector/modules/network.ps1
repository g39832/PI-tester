<#
.SYNOPSIS
  DispoScan Network Diagnostic Module
.DESCRIPTION
  Collects network adapter information: interfaces, MAC, speed, DHCP status.
  Returns structured JSON with status and data.
.EXAMPLE
  Invoke-NetworkDiagnostic
#>

function Invoke-NetworkDiagnostic {
  $start = Get-Date
  $result = @{ status = 'completed'; data = @{}; warnings = @(); duration = $null }

  try {
    $adapters = Get-CimInstance -ClassName Win32_NetworkAdapter -ErrorAction SilentlyContinue |
      Where-Object { $_.NetEnabled -eq $true -and $null -ne $_.MACAddress }
    if ($adapters -and $adapters.Count -gt 0) {
      $ifList = @()
      foreach ($adapter in $adapters) {
        $ipInfo = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue |
          Where-Object { $_.Index -eq $adapter.Index } | Select-Object -First 1
        $ifList += @{
          name   = $adapter.ProductName.Trim()
          mac    = $adapter.MACAddress
          speed  = if ($adapter.Speed) { "$([math]::Round($adapter.Speed / 1Gbps, 1)) Gbps" } else { 'unknown' }
          dhcp   = if ($adapter.DHCPEnabled) { $true } else { $false }
          ip     = if ($ipInfo -and $ipInfo.IPAddress) { ($ipInfo.IPAddress | Where-Object { $_ -notmatch ':' }) -join ', ' } else { $null }
          status = $adapter.NetConnectionStatus
        }
      }
      $result.data = @{ interfaces = $ifList; interfaceCount = $ifList.Count }
    } else {
      $result.status = 'skipped'
      $result.warnings = @('No active network adapters detected')
    }
  } catch {
    $result.status = 'failed'
    $result.warnings = @($_.Exception.Message)
  }

  $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)
  return $result
}

if ($MyInvocation.InvocationName -eq '&' -or $MyInvocation.CommandOrigin -eq 'Runspace') {
  Invoke-NetworkDiagnostic | ConvertTo-Json -Compress -Depth 5
}
