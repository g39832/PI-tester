<#
.SYNOPSIS
  DispoScan Collector Version Module
.DESCRIPTION
  Defines the collector version and compatibility range.
  Used by collector.ps1 to announce version to the Pi server.
  The server checks this to ensure compatibility.
#>

function Get-CollectorVersion {
  return @{
    version = '3.0.0'
    protocol = 'disposcan-v1'
    minServerVersion = '2.0.0'
    features = @(
      'quick_scan',
      'deep_scan',
      'health_score',
      'progress_streaming'
    )
  }
}
