<#
.SYNOPSIS
  DispoScan Windows Update Diagnostic Module
.DESCRIPTION
  Collects Windows Update status: pending updates, last update date,
  update history. Returns structured JSON with status and data.
.EXAMPLE
  Invoke-UpdateDiagnostic
#>

function Invoke-UpdateDiagnostic {
  $start = Get-Date
  $result = @{ status = 'completed'; data = @{}; warnings = @(); duration = $null }

  try {
    $data = @{}

    # Last update date from registry
    try {
      $wuReg = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate' -Name 'LastSuccessfulUpdate' -ErrorAction SilentlyContinue
      if ($wuReg -and $wuReg.LastSuccessfulUpdate) {
        $epoch = [DateTime]::new(1601, 1, 1, 0, 0, 0, [DateTimeKind]::Utc)
        $lastUpdate = $epoch.AddTicks($wuReg.LastSuccessfulUpdate)
        $data.lastUpdateDate = $lastUpdate.ToString('o')
        $daysSince = [math]::Round((Get-Date).Subtract($lastUpdate).TotalDays, 0)
        $data.daysSinceLastUpdate = $daysSince
        if ($daysSince -gt 30) {
          $result.warnings += "Last Windows Update was $daysSince days ago ($($lastUpdate.ToString('yyyy-MM-dd')))"
        }
      } else {
        $data.lastUpdateDate = $null
        $data.daysSinceLastUpdate = $null
      }
    } catch {}

    # Pending updates via COM
    try {
      $session = New-Object -ComObject Microsoft.Update.Session -ErrorAction SilentlyContinue
      if ($session) {
        $searcher = $session.CreateUpdateSearcher()
        $searchResult = $searcher.Search("IsInstalled=0 AND IsHidden=0")
        $pendingCount = $searchResult.Updates.Count
        $data.pendingUpdateCount = $pendingCount
        $data.pendingUpdates = @()
        for ($i = 0; $i -lt [math]::Min($pendingCount, 20); $i++) {
          $update = $searchResult.Updates.Item($i)
          $data.pendingUpdates += @{
            title    = $update.Title
            severity = $update.MsrcSeverity
            kb       = if ($update.KBArticleIDs) { $update.KBArticleIDs.Item(0) } else { $null }
            size     = if ($update.MaxDownloadSize) { "$([math]::Round($update.MaxDownloadSize / 1MB, 1)) MB" } else { $null }
          }
        }
        if ($pendingCount -gt 0) {
          $result.warnings += "$pendingCount pending Windows updates detected"
        }
      }
    } catch {
      try {
        $data.updateServiceState = 'com_unavailable'
      } catch {}
    }

    # Windows Update service status
    try {
      $wuService = Get-Service -Name wuauserv -ErrorAction SilentlyContinue
      if ($wuService) {
        $data.wuServiceStatus = $wuService.Status.ToString()
        $data.wuServiceStartType = $wuService.StartType.ToString()
      }
    } catch {}

    $result.data = $data
    if (-not $data.ContainsKey('pendingUpdateCount')) { $data.pendingUpdateCount = 0 }
  } catch {
    $result.status = 'failed'
    $result.warnings = @($_.Exception.Message)
  }

  $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)
  return $result
}

if ($MyInvocation.InvocationName -eq '&' -or $MyInvocation.CommandOrigin -eq 'Runspace') {
  Invoke-UpdateDiagnostic | ConvertTo-Json -Compress -Depth 5
}
