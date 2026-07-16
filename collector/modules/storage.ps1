<#
.SYNOPSIS
  DispoScan Storage Diagnostic Module
.DESCRIPTION
  Collects storage information: SMART status, SSD wear level, temperature,
  capacity, interface type. Returns structured JSON with status and data.
.EXAMPLE
  Invoke-StorageDiagnostic
#>

function Invoke-StorageDiagnostic {
  $start = Get-Date
  $result = @{ status = 'completed'; data = @{}; warnings = @(); duration = $null }

  try {
    $drives = Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction SilentlyContinue
    if ($drives -and $drives.Count -gt 0) {
      $driveList = @()
      foreach ($disk in $drives) {
        $smartStatus = 'unknown'
        $wearLevel = $null
        $temp = $null
        $hours = $null

        try {
          $smart = Get-CimInstance -Namespace 'root\wmi' -ClassName MSStorageDriver_FailurePredictStatus `
            -Filter "InstanceName LIKE '%$($disk.PNPDeviceID)%'" -ErrorAction SilentlyContinue | Select-Object -First 1
          if ($smart) { $smartStatus = if ($smart.PredictFailure) { 'failing' } else { 'ok' } }
        } catch {}

        try {
          $attr = Get-CimInstance -Namespace 'root\wmi' -ClassName MSStorageDriver_ATAPISmartData `
            -Filter "InstanceName LIKE '%$($disk.PNPDeviceID)%'" -ErrorAction SilentlyContinue | Select-Object -First 1
          if ($attr) {
            $wearLevel = $attr.WearLevel
            $temp = $attr.Temperature
          }
        } catch {}

        try {
          $perf = Get-CimInstance -ClassName Win32_PerfFormattedData_Counters_PhysicalDisk -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match "$($disk.Index)" } | Select-Object -First 1
          if ($perf -and $perf.AvgDiskSecPerRead) { $hours = [math]::Round($perf.AvgDiskSecPerRead * 100, 0) }
        } catch {}

        $type = if ($disk.MediaType) { $disk.MediaType } else { if ($disk.Model -match 'SSD|NVMe|M\.2') { 'SSD' } else { 'HDD' } }

        $d = @{
          model         = $disk.Model.Trim()
          size          = "$([math]::Round($disk.Size / 1GB, 0)) GB"
          type          = $type
          serial        = $disk.SerialNumber.Trim()
          interfaceType = $disk.InterfaceType
          smartStatus   = $smartStatus
          wearLevel     = $wearLevel
          temperature   = $temp
          powerOnHours  = $hours
          partitions    = $disk.Partitions
        }
        $driveList += $d

        if ($smartStatus -eq 'failing') {
          $result.warnings += "SMART failure detected on $($disk.Model.Trim()) (S/N: $($disk.SerialNumber.Trim()))"
        }
        if ($type -eq 'SSD' -and $null -ne $wearLevel -and $wearLevel -gt 80) {
          $result.warnings += "SSD wear level critically high ($wearLevel%) on $($disk.Model.Trim())"
        } elseif ($type -eq 'SSD' -and $null -ne $wearLevel -and $wearLevel -gt 60) {
          $result.warnings += "SSD wear level elevated ($wearLevel%) on $($disk.Model.Trim())"
        }
        if ($null -ne $temp -and $temp -gt 65) {
          $result.warnings += "High drive temperature ($temp°C) on $($disk.Model.Trim())"
        }
      }
      $result.data = @{ drives = $driveList }
    } else {
      $result.status = 'skipped'
      $result.warnings = @('No storage drives detected')
    }
  } catch {
    $result.status = 'failed'
    $result.warnings = @($_.Exception.Message)
  }

  $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)
  return $result
}

if ($MyInvocation.InvocationName -eq '&' -or $MyInvocation.CommandOrigin -eq 'Runspace') {
  Invoke-StorageDiagnostic | ConvertTo-Json -Compress -Depth 5
}
