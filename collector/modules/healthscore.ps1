<#
.SYNOPSIS
  DispoScan Health Score Calculator Module
.DESCRIPTION
  Computes a weighted health score from all diagnostic results.
  Categories: Storage 30%, Battery 20%, Windows Health 20%,
  Hardware 15%, Security 10%, Temperature 5%.
  Produces per-category scores and an overall weighted score.
.EXAMPLE
  $results = @{ cpu = @{...}; storage = @{...}; ... }
  Invoke-HealthScoreCalculation -Results $results
#>

function Invoke-HealthScoreCalculation {
  param(
    [Parameter(Mandatory)]
    [hashtable]$Results
  )

  $start = Get-Date
  $result = @{ status = 'completed'; categories = @{}; overall = $null; duration = $null }

  # Weights
  $weights = @{
    storage        = 0.30
    battery        = 0.20
    windows_health = 0.20
    hardware       = 0.15
    security       = 0.10
    temperature    = 0.05
  }

  # --- Storage Score (30%) ---
  $storageScore = 100
  if ($Results.storage -and $Results.storage.status -eq 'completed') {
    $drives = $Results.storage.data.drives
    if ($drives -and $drives.Count -gt 0) {
      $failingSmart = $drives | Where-Object { $_.smartStatus -eq 'failing' }
      $highWear = $drives | Where-Object { $null -ne $_.wearLevel -and $_.wearLevel -gt 80 }
      $warnWear = $drives | Where-Object { $null -ne $_.wearLevel -and $_.wearLevel -gt 60 }
      if ($failingSmart.Count -gt 0) { $storageScore = 0 }
      elseif ($highWear.Count -gt 0) { $storageScore = 30 }
      elseif ($warnWear.Count -gt 0) { $storageScore = 60 }
    }
  } else { $storageScore = $null }

  # --- Battery Score (20%) ---
  $batteryScore = 100
  if ($Results.battery -and $Results.battery.status -eq 'completed') {
    $bat = $Results.battery.data
    if ($bat.present) {
      $wl = $bat.wearLevel
      if ($null -ne $wl) {
        if ($wl -ge 30) { $batteryScore = 0 }
        elseif ($wl -ge 15) { $batteryScore = 50 }
        elseif ($wl -ge 10) { $batteryScore = 75 }
      }
      if ($bat.health -lt 30) { $batteryScore = 0 }
      elseif ($bat.health -lt 60) { $batteryScore = [math]::Min($batteryScore, 50) }
    }
  } else { $batteryScore = 100 }  # No battery = desktop = no issue

  # --- Windows Health Score (20%) ---
  $winScore = 100
  if ($Results.windows -and $Results.windows.status -eq 'completed') {
    $win = $Results.windows.data
    if ($win.activationStatus -eq 'not_activated') { $winScore -= 20 }
  }
  if ($Results.eventviewer -and $Results.eventviewer.status -eq 'completed') {
    $ev = $Results.eventviewer.data
    if ($ev.criticalCount -gt 0) { $winScore -= 15 }
    if ($ev.errorCount -gt 10) { $winScore -= 10 }
  }
  if ($Results.updates -and $Results.updates.status -eq 'completed') {
    $up = $Results.updates.data
    if ($up.pendingUpdateCount -gt 10) { $winScore -= 15 }
    elseif ($up.pendingUpdateCount -gt 0) { $winScore -= 5 }
    if ($up.daysSinceLastUpdate -and $up.daysSinceLastUpdate -gt 60) { $winScore -= 10 }
  }
  if ($Results.drivers -and $Results.drivers.status -eq 'completed') {
    $dr = $Results.drivers.data
    if ($dr.problemCount -gt 0) { $winScore -= 10 }
  }
  $winScore = [math]::Max(0, $winScore)

  # --- Hardware Score (15%) ---
  $hwScore = 100
  if ($Results.cpu -and $Results.cpu.status -eq 'failed') { $hwScore -= 25 }
  if ($Results.memory -and $Results.memory.status -eq 'failed') { $hwScore -= 25 }
  if ($Results.gpu -and $Results.gpu.status -eq 'failed') { $hwScore -= 25 }
  if ($Results.motherboard -and $Results.motherboard.status -eq 'failed') { $hwScore -= 25 }
  $hwScore = [math]::Max(0, $hwScore)

  # --- Security Score (10%) ---
  $secScore = 100
  if ($Results.windows -and $Results.windows.status -eq 'completed') {
    $win = $Results.windows.data
    if ($win.secureBoot -eq 'disabled') { $secScore -= 30 }
    elseif ($win.secureBoot -eq 'unsupported') { $secScore -= 10 }
    if ($win.tpmPresent -eq $false) { $secScore -= 20 }
    elseif ($win.tpmEnabled -eq $false) { $secScore -= 15 }
    if ($win.bitlockerEnabled -eq $false -and $win.enclosureType -in @('Laptop', 'Notebook', 'Portable')) {
      $secScore -= 10
    }
  }
  if ($Results.updates -and $Results.updates.status -eq 'completed') {
    $up = $Results.updates.data
    if ($up.daysSinceLastUpdate -and $up.daysSinceLastUpdate -gt 30) { $secScore -= 10 }
  }
  $secScore = [math]::Max(0, $secScore)

  # --- Temperature Score (5%) ---
  $tempScore = 100
  if ($Results.storage -and $Results.storage.status -eq 'completed') {
    $drives = $Results.storage.data.drives
    if ($drives) {
      $maxTemp = ($drives | Where-Object { $null -ne $_.temperature } | Measure-Object -Property temperature -Maximum).Maximum
      if ($maxTemp) {
        if ($maxTemp -gt 70) { $tempScore = 0 }
        elseif ($maxTemp -gt 60) { $tempScore = 50 }
        elseif ($maxTemp -gt 50) { $tempScore = 75 }
      }
    }
  }

  # Compute overall weighted score
  $categoryScores = @{
    storage        = $storageScore
    battery        = $batteryScore
    windows_health = $winScore
    hardware       = $hwScore
    security       = $secScore
    temperature    = $tempScore
  }

  $weightedTotal = 0
  $weightSum = 0
  foreach ($cat in $categoryScores.Keys) {
    if ($null -ne $categoryScores[$cat]) {
      $weightedTotal += $categoryScores[$cat] * $weights[$cat]
      $weightSum += $weights[$cat]
    }
  }

  $overallScore = if ($weightSum -gt 0) {
    [math]::Round($weightedTotal / $weightSum, 0)
  } else { $null }

  $result.categories = $categoryScores
  $result.overall = $overallScore
  $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)

  return $result
}

if ($MyInvocation.InvocationName -eq '&' -or $MyInvocation.CommandOrigin -eq 'Runspace') {
  Write-Warning 'healthscore.ps1 expects hashtable input via Invoke-HealthScoreCalculation. Run via collector.ps1.'
}
