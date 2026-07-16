<#
.SYNOPSIS
  DispoScan Motherboard & BIOS Diagnostic Module
.DESCRIPTION
  Collects motherboard and BIOS information.
  Returns structured JSON with status and data.
.EXAMPLE
  Invoke-MotherboardDiagnostic
#>

function Invoke-MotherboardDiagnostic {
  $start = Get-Date
  $result = @{ status = 'completed'; data = @{}; warnings = @(); duration = $null }

  try {
    $board = Get-CimInstance -ClassName Win32_BaseBoard -ErrorAction SilentlyContinue | Select-Object -First 1
    $bios = Get-CimInstance -ClassName Win32_BIOS -ErrorAction SilentlyContinue | Select-Object -First 1

    if ($board -or $bios) {
      $result.data = @{
        manufacturer = if ($board) { $board.Manufacturer } else { $null }
        product      = if ($board) { $board.Product } else { $null }
        version      = if ($board) { $board.Version } else { $null }
        serial       = if ($board) { $board.SerialNumber } else { $null }
        biosVendor   = if ($bios) { $bios.Manufacturer } else { $null }
        biosVersion  = if ($bios) { $bios.SMBIOSBIOSVersion } else { $null }
        biosDate     = if ($bios) { "$($bios.ReleaseDate)" } else { $null }
        smbiosMajor  = if ($bios) { $bios.SMBIOSMajorVersion } else { $null }
        smbiosMinor  = if ($bios) { $bios.SMBIOSMinorVersion } else { $null }
      }
    } else {
      $result.status = 'skipped'
      $result.warnings = @('No motherboard/BIOS information available')
    }
  } catch {
    $result.status = 'failed'
    $result.warnings = @($_.Exception.Message)
  }

  $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)
  return $result
}

if ($MyInvocation.InvocationName -eq '&' -or $MyInvocation.CommandOrigin -eq 'Runspace') {
  Invoke-MotherboardDiagnostic | ConvertTo-Json -Compress -Depth 5
}
