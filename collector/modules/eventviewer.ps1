<#
.SYNOPSIS
  DispoScan Event Viewer Diagnostic Module
.DESCRIPTION
  Collects recent critical and error events from the System and Application
  logs (last 7 days only). Returns structured JSON with status and data.
.DESCRIPTION
  Quick scan: last 7 days, System + Application logs only.
  Deep scan: last 30 days, System + Application + Security + Setup logs.
.EXAMPLE
  Invoke-EventViewerDiagnostic
#>

function Invoke-EventViewerDiagnostic {
  param([switch]$DeepScan)
  $start = Get-Date
  $result = @{ status = 'completed'; data = @{}; warnings = @(); duration = $null }

  try {
    $maxAge = if ($DeepScan) { [TimeSpan]::FromDays(30) } else { [TimeSpan]::FromDays(7) }
    $since = (Get-Date).Subtract($maxAge)
    $logNames = if ($DeepScan) { @('System', 'Application', 'Security', 'Setup') } else { @('System', 'Application') }

    $events = @()
    $criticalCount = 0; $errorCount = 0
    foreach ($log in $logNames) {
      try {
        $logEvents = Get-WmiObject -Class Win32_NTLogEvent -Filter "LogFile='$log' AND TimeGenerated >= '$($since.ToString('yyyyMMddHHmmss'))' AND (Type='Error' OR Type='Critical')" -ErrorAction SilentlyContinue
        if ($logEvents) {
          foreach ($evt in $logEvents) {
            if ($evt.Type -eq 'Critical') { $criticalCount++ } else { $errorCount++ }
            $events += @{
              log      = $log
              type     = $evt.Type
              time     = $evt.TimeGenerated
              source   = $evt.SourceName
              eventId  = $evt.EventCode
              message  = ($evt.Message -replace '\s+', ' ').Substring(0, [math]::Min(200, $evt.Message.Length))
              category = $evt.CategoryString
            }
          }
        }
      } catch {}
    }

    $result.data = @{
      totalEvents    = $events.Count
      criticalCount  = $criticalCount
      errorCount     = $errorCount
      oldestEvent    = if ($events.Count -gt 0) { ($events | Sort-Object time | Select-Object -First 1).time } else { $null }
      newestEvent    = if ($events.Count -gt 0) { ($events | Sort-Object time -Descending | Select-Object -First 1).time } else { $null }
      events         = $events | Sort-Object time -Descending | Select-Object -First 50
      scanRangeDays  = $maxAge.TotalDays
    }

    if ($criticalCount -gt 0) {
      $result.warnings += "$criticalCount critical system events detected in the last $($maxAge.TotalDays) days"
    }
    if ($errorCount -gt 5) {
      $result.warnings += "$errorCount application errors detected in the last $($maxAge.TotalDays) days"
    }
  } catch {
    $result.status = 'failed'
    $result.warnings = @($_.Exception.Message)
  }

  $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)
  return $result
}

if ($MyInvocation.InvocationName -eq '&' -or $MyInvocation.CommandOrigin -eq 'Runspace') {
  Invoke-EventViewerDiagnostic | ConvertTo-Json -Compress -Depth 5
}
