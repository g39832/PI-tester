<#
.SYNOPSIS
  DispoScan Diagnostic Collector — Module Coordinator
.DESCRIPTION
  Auto-discovers the DispoScan Pi appliance, loads individual diagnostic
  modules from collector/modules/, runs them in sequence, and streams
  results back over WebSocket with live per-module progress.
.PARAMETER PiIp
  Optional: IP address of the DispoScan Pi. Omit for auto-discovery.
.PARAMETER SessionCode
  Optional: Session code. Omit for auto-discovery.
.PARAMETER DeepScan
  If set, runs extended diagnostics (DISM, SFC, deep event log).
  Default is Quick Scan (30-90 seconds).
.PARAMETER NoAutoDiscovery
  If set, require both PiIp and SessionCode.
#>

param(
  [string]$PiIp = "",
  [string]$SessionCode = "",
  [switch]$DeepScan,
  [switch]$NoAutoDiscovery
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$script:WebSocket = $null
$script:Results = @{}

$WS_PORT = 3002
$WS_PATH = "/collect"
$RECONNECT_DELAYS = @(0, 2, 4, 8, 15, 15, 30, 60)

$MODULES_DIR = if (Test-Path "$PSScriptRoot\modules") { "$PSScriptRoot\modules" } else { "$PSScriptRoot\modules" }
$RESUME_FILE = if ($env:TEMP) { "$env:TEMP\disposcan_resume.json" } else { "$PSScriptRoot\.resume.json" }

# ── Logging ──────────────────────────────────────────────────────────

function Write-Log($Message) {
  Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message"
}

# ── Network Discovery ────────────────────────────────────────────────

function Find-PiByMDNS {
  Write-Log "Scanning mDNS for _disposcan._tcp.local..."
  try {
    if (Get-Command Resolve-DnsName -ErrorAction SilentlyContinue) {
      $r = Resolve-DnsName -Name "_disposcan._tcp.local" -Type ANY -ErrorAction SilentlyContinue
      if ($r -and $r.IPAddress) { Write-Log "mDNS: Found $($r.IPAddress.IPAddressToString)"; return $r.IPAddress.IPAddressToString }
    }
    $r = nslookup -type=ptr "_disposcan._tcp.local" 2>$null
    if ($LASTEXITCODE -eq 0 -and $r -match "(\d+\.\d+\.\d+\.\d+)") { Write-Log "mDNS: Found $($matches[1])"; return $matches[1] }
  } catch {}
  return $null
}

function Find-PiByTcpScan {
  Write-Log "TCP scanning subnet for port $WS_PORT..."
  try {
    $gw = (Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue | Select-Object -First 1).NextHop
    if (-not $gw) { return $null }
    $parts = $gw.ToString().Split('.')
    $subnet = "$($parts[0]).$($parts[1]).$($parts[2])."
    $jobs = @()
    for ($i = 1; $i -le 254; $i++) {
      $ip = "$subnet$i"
      $jobs += Start-Job -ScriptBlock { param($t, $p) try { $c = New-Object System.Net.Sockets.TcpClient; $a = $c.BeginConnect($t, $p, $null, $null); $w = $a.AsyncWaitHandle.WaitOne(30, $false); if ($w -and $c.Connected) { $c.EndConnect($a); $c.Close(); return $t }; $c.Close() } catch {} return $null } -ArgumentList $ip, $WS_PORT
    }
    $results = $jobs | Wait-Job -Timeout 25 | Receive-Job
    $jobs | Where-Object { $_.State -eq 'Running' } | Stop-Job | Remove-Job -Force
    $jobs | Remove-Job -Force
    foreach ($r in $results) { if ($r) { Write-Log "TCP scan: Found $r"; return $r } }
  } catch {}
  return $null
}

function Find-PiByGatewayProbe {
  try {
    $route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($route) {
      $ip = $route.NextHop.ToString()
      try { $c = New-Object System.Net.Sockets.TcpClient; $a = $c.BeginConnect($ip, $WS_PORT, $null, $null); $w = $a.AsyncWaitHandle.WaitOne(80, $false); if ($w -and $c.Connected) { $c.EndConnect($a); $c.Close(); Write-Log "Gateway: Found $ip"; return $ip }; $c.Close() } catch {}
    }
  } catch {}
  return $null
}

function Get-Discovery {
  if ($PiIp) { return $PiIp }
  if ($NoAutoDiscovery) { throw "NoAutoDiscovery set and no PiIp provided" }
  $ip = Find-PiByMDNS
  if (-not $ip) { $ip = Find-PiByTcpScan }
  if (-not $ip) { $ip = Find-PiByGatewayProbe }
  if (-not $ip) { throw "Could not discover DispoScan Pi. Ensure it's on the same network." }
  return $ip
}

function Get-SessionCode($Ip) {
  if ($SessionCode) { return $SessionCode }
  Write-Log "Fetching session code from Pi..."
  try {
    $r = Invoke-RestMethod -Uri "http://${Ip}:3001/api/v1/collector/current" -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($r -and $r.success -and $r.data.code) { Write-Log "Code: $($r.data.code)"; return $r.data.code }
  } catch {}
  throw "Could not obtain session code from Pi."
}

# ── WebSocket ────────────────────────────────────────────────────────

function Send-Message($Type, $Payload) {
  if (-not $script:WebSocket -or $script:WebSocket.State -ne 'Open') { throw "WebSocket not connected" }
  $msg = @{ type = $Type } + $Payload
  $json = $msg | ConvertTo-Json -Compress -Depth 10
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
  $script:WebSocket.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
}

function Receive-Message {
  $buffer = New-Object byte[] 65536
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buffer)
  $r = $script:WebSocket.ReceiveAsync($seg, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
  return ([System.Text.Encoding]::UTF8.GetString($buffer, 0, $r.Count) | ConvertFrom-Json)
}

function Connect-WebSocket($Ip, $Code) {
  $uri = "ws://${Ip}:${WS_PORT}${WS_PATH}"
  Write-Log "Connecting to $uri ..."
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.Options.SetRequestHeader("X-Session-Code", $Code)
  $ws.Options.AddSubProtocol("disposcan-v1")
  $cts = New-Object System.Threading.CancellationTokenSource
  $cts.CancelAfter(10000)
  try { $ws.ConnectAsync([System.Uri]$uri, $cts.Token).GetAwaiter().GetResult() } catch { $ws.Dispose(); throw }
  if ($ws.State -ne 'Open') { $ws.Dispose(); throw "WebSocket did not open" }
  Write-Log "Connected."
  return $ws
}

# ── Module Loader ────────────────────────────────────────────────────

function Get-ModuleList {
  $quick = @(
    @{ id = 'cpu';         label = 'CPU';               file = 'cpu.ps1';         fn = 'Invoke-CpuDiagnostic' }
    @{ id = 'memory';      label = 'Memory';            file = 'memory.ps1';      fn = 'Invoke-MemoryDiagnostic' }
    @{ id = 'storage';     label = 'Storage';           file = 'storage.ps1';     fn = 'Invoke-StorageDiagnostic' }
    @{ id = 'gpu';         label = 'GPU';               file = 'gpu.ps1';         fn = 'Invoke-GpuDiagnostic' }
    @{ id = 'motherboard'; label = 'Motherboard & BIOS'; file = 'motherboard.ps1'; fn = 'Invoke-MotherboardDiagnostic' }
    @{ id = 'battery';     label = 'Battery';           file = 'battery.ps1';     fn = 'Invoke-BatteryDiagnostic' }
    @{ id = 'network';     label = 'Network';           file = 'network.ps1';     fn = 'Invoke-NetworkDiagnostic' }
    @{ id = 'windows';     label = 'Windows OS';        file = 'windows.ps1';     fn = 'Invoke-WindowsDiagnostic' }
    @{ id = 'updates';     label = 'Windows Updates';   file = 'updates.ps1';     fn = 'Invoke-UpdateDiagnostic' }
    @{ id = 'drivers';     label = 'Drivers';           file = 'drivers.ps1';     fn = 'Invoke-DriverDiagnostic' }
    @{ id = 'eventviewer'; label = 'Event Log';         file = 'eventviewer.ps1'; fn = 'Invoke-EventViewerDiagnostic' }
  )

  $deep = @(
    @{ id = 'sfc';         label = 'SFC Scan';          file = 'sfc.ps1';         fn = 'Invoke-SfcDiagnostic' }
    @{ id = 'dism';        label = 'DISM Health';       file = 'dism.ps1';        fn = 'Invoke-DismDiagnostic' }
    @{ id = 'eventviewer_deep'; label = 'Deep Event Log'; file = 'eventviewer.ps1'; fn = 'Invoke-EventViewerDeepDiagnostic' }
    @{ id = 'fscheck';     label = 'File System Check'; file = 'fscheck.ps1';     fn = 'Invoke-FileSystemCheck' }
  )

  $modules = @() + $quick
  if ($DeepScan) { $modules += $deep }
  return $modules
}

function Run-Module($Module) {
  $start = Get-Date
  $modulePath = Join-Path $MODULES_DIR $Module.file

  try {
    if (-not (Test-Path $modulePath)) {
      return @{ status = 'skipped'; data = @{}; warnings = @("Module $($Module.file) not found"); duration = 0 }
    }

    $scriptBlock = [ScriptBlock]::Create((Get-Content $modulePath -Raw) + "`n$($Module.fn)")

    if ($Module.id -eq 'eventviewer') {
      $result = if ($DeepScan) { & $scriptBlock -DeepScan } else { & $scriptBlock }
    } else {
      $result = & $scriptBlock
    }

    if (-not $result -or -not $result.ContainsKey('status')) {
      return @{ status = 'failed'; data = @{}; warnings = @("Module returned no result"); duration = $null }
    }

    return $result
  } catch {
    return @{ status = 'failed'; data = @{}; warnings = @($_.Exception.Message); duration = $null }
  }
}

# ── Health Score Calculation ─────────────────────────────────────────

function Calculate-HealthScore {
  $hsp = Join-Path $MODULES_DIR 'healthscore.ps1'
  if (Test-Path $hsp) {
    try {
      $scriptBlock = [ScriptBlock]::Create((Get-Content $hsp -Raw) + "`nInvoke-HealthScoreCalculation -Results `$script:Results")
      return & $scriptBlock
    } catch { Write-Log "Health score error: $_" }
  }
  return $null
}

# ── Main Flow ────────────────────────────────────────────────────────

function Save-ResumeState {
  $state = @{
    sessionCode = $Code
    ip = $Ip
    deepScan = $DeepScan -eq $true
    results = $script:Results
    completedTests = @($script:Results.Keys)
    timestamp = (Get-Date -Format 'o')
  }
  $state | ConvertTo-Json -Compress -Depth 6 | Set-Content -Path $RESUME_FILE -Force
}

function Clear-ResumeState {
  if (Test-Path $RESUME_FILE) { Remove-Item $RESUME_FILE -Force }
}

function Load-ResumeState {
  if (Test-Path $RESUME_FILE) {
    try {
      $state = Get-Content $RESUME_FILE -Raw | ConvertFrom-Json
      return $state
    } catch { Write-Log "Corrupt resume file, starting fresh." }
  }
  return $null
}

function Get-CollectorVersion {
  $verPath = Join-Path $MODULES_DIR '_version.ps1'
  if (Test-Path $verPath) {
    try {
      $sb = [ScriptBlock]::Create((Get-Content $verPath -Raw) + "`nGet-CollectorVersion")
      return & $sb
    } catch {}
  }
  return @{ version = '3.0.0'; protocol = 'disposcan-v1'; minServerVersion = '2.0.0'; features = @() }
}

function Run-Diagnostics($Ip, $Code) {
  try { $script:WebSocket = Connect-WebSocket $Ip $Code } catch { Write-Log "Connection failed: $_"; return $false }

  try {
    $resumeState = Load-ResumeState
    if ($resumeState -and $resumeState.completedTests -and @($resumeState.completedTests).Count -gt 0) {
      Write-Log "Found partial results from previous interrupted session. Resuming..."
    }

    $versionInfo = Get-CollectorVersion

    Send-Message 'hello' @{
      sessionCode = $Code
      collectorVersion = $versionInfo.version
      protocol = $versionInfo.protocol
      features = $versionInfo.features
      resumeSessionId = if ($resumeState -and $resumeState.sessionId) { $resumeState.sessionId } else { $null }
    }
    $ack = Receive-Message
    if ($ack.type -ne 'hello_ack') { Write-Log "Unexpected: $($ack.type)"; return $false }

    if ($ack.versionWarning) { Write-Log "WARNING: $($ack.versionWarning)" }

    if ($ack.resumeAccepted -and $resumeState -and $resumeState.results) {
      Write-Log "Resume accepted. Restoring $($resumeState.completedTests.Count) previously completed tests."
      $script:Results = @{}
      $resumeState.results.PSObject.Properties | ForEach-Object { $script:Results[$_.Name] = $_.Value }

      foreach ($modId in $resumeState.completedTests) {
        if ($script:Results.ContainsKey($modId)) {
          $mr = $script:Results[$modId]
          $h = switch ($mr.status) {
            'completed' { if ($mr.warnings -and $mr.warnings.Count -gt 0) { 'warning' } else { 'good' } }
            'failed'    { 'critical' }
            'skipped'   { 'unknown' }
            default     { 'unknown' }
          }
          Send-Message 'test_result' @{
            testId   = $modId
            label    = $modId
            status   = $mr.status
            health   = $h
            data     = $mr.data
            warnings = $mr.warnings
            duration = $mr.duration
            restored = $true
          }
          try { Receive-Message } catch {}
        }
      }
    }

    # Hardware metadata
    try {
      $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue | Select-Object -First 1
      $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue | Select-Object -First 1
      Send-Message 'session_meta' @{
        deviceName     = $env:COMPUTERNAME
        manufacturer   = if ($cs) { $cs.Manufacturer } else { '' }
        model          = if ($cs) { $cs.Model } else { '' }
        serialNumber   = ''
        windowsVersion = if ($os) { "$($os.Caption) $($os.Version)" } else { '' }
        scanMode       = if ($DeepScan) { 'deep' } else { 'quick' }
      }
    } catch {}

    # Run each module
    $modules = Get-ModuleList
    $moduleCount = $modules.Count
    $completedCount = 0

    foreach ($mod in $modules) {
      if ($script:Results.ContainsKey($mod.id) -and $script:Results[$mod.id].status -ne 'running') {
        Write-Log "[$($completedCount+1)/$moduleCount] $($mod.label)... (already completed, skipping)"
        $completedCount++
        continue
      }

      Write-Log "[$($completedCount+1)/$moduleCount] $($mod.label)..."
      Send-Message 'progress' @{ testId = $mod.id; label = $mod.label; status = 'running'; progress = @{ current = $completedCount; total = $moduleCount } }

      $moduleResult = Run-Module $mod
      $script:Results[$mod.id] = $moduleResult

      Save-ResumeState

      $sendStatus = $moduleResult.status
      $health = switch ($moduleResult.status) {
        'completed' { if ($moduleResult.warnings.Count -gt 0) { 'warning' } else { 'good' } }
        'failed'    { 'critical' }
        'skipped'   { 'unknown' }
        default     { 'unknown' }
      }

      Send-Message 'test_result' @{
        testId   = $mod.id
        label    = $mod.label
        status   = $sendStatus
        health   = $health
        data     = $moduleResult.data
        warnings = $moduleResult.warnings
        duration = $moduleResult.duration
      }

      $completedCount++
      try { $ack = Receive-Message } catch { Write-Log "Ack failed: $_" }
    }

    # Calculate and send health score
    try {
      $hs = Calculate-HealthScore
      if ($hs) {
        $script:Results['healthscore'] = $hs
        Save-ResumeState
        Send-Message 'health_score' @{
          categoryScores = $hs.categories
          overall        = $hs.overall
        }
        try { Receive-Message } catch {}
      }
    } catch { Write-Log "Health score send failed: $_" }

    Send-Message 'complete' @{}
    try { Receive-Message } catch {}
    Clear-ResumeState
    Write-Log "All diagnostics complete."
    return $true
  } catch {
    Write-Log "Error: $_"
    try { Send-Message 'error' @{ code = 'COLLECTOR_ERROR'; message = $_.Exception.Message } } catch {}
    return $false
  } finally {
    try { if ($script:WebSocket -and $script:WebSocket.State -eq 'Open') { $script:WebSocket.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'Done', [System.Threading.CancellationToken]::None).GetAwaiter().GetResult() } } catch {}
    if ($script:WebSocket) { $script:WebSocket.Dispose(); $script:WebSocket = $null }
  }
}

# ── Entry ────────────────────────────────────────────────────────────

function Main {
  Write-Host "`n╔══════════════════════════════════════╗"
  Write-Host "║  DispoScan Diagnostic Collector v3  ║"
  if ($DeepScan) { Write-Host "║           DEEP SCAN MODE              ║" }
  Write-Host "╚══════════════════════════════════════╝`n"

  try { $null = [System.Net.WebSockets.ClientWebSocket] } catch { Write-Log "WebSocket not available. PowerShell 5+ required."; return 1 }

  $ip = Get-Discovery
  Write-Log "Pi found at $ip"

  $code = Get-SessionCode $ip
  Write-Log "Session: $code"

  $success = $false
  foreach ($delay in $RECONNECT_DELAYS) {
    if ($delay -gt 0) { Write-Log "Retry in ${delay}s..."; Start-Sleep -Seconds $delay }
    $success = Run-Diagnostics $ip $code
    if ($success) { break }
  }

  if ($success) { Write-Log "Done."; return 0 }
  else { Write-Log "Failed."; return 2 }
}

exit Main
