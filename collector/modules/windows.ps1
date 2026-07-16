<#
.SYNOPSIS
  DispoScan Windows OS Diagnostic Module
.DESCRIPTION
  Collects Windows information: version, edition, activation status,
  Secure Boot, TPM version, BitLocker status, BIOS version.
  Returns structured JSON with status and data.
.EXAMPLE
  Invoke-WindowsDiagnostic
#>

function Invoke-WindowsDiagnostic {
  $start = Get-Date
  $result = @{ status = 'completed'; data = @{}; warnings = @(); duration = $null }

  try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
    $cs = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue | Select-Object -First 1
    $bios = Get-CimInstance -ClassName Win32_BIOS -ErrorAction SilentlyContinue | Select-Object -First 1
    $board = Get-CimInstance -ClassName Win32_BaseBoard -ErrorAction SilentlyContinue | Select-Object -First 1

    $data = @{
      osCaption      = if ($os) { $os.Caption } else { $null }
      osVersion      = if ($os) { $os.Version } else { $null }
      osBuildNumber  = if ($os) { $os.BuildNumber } else { $null }
      osArchitecture = if ($os) { $os.OSArchitecture } else { $null }
      osEdition      = if ($os) { (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -Name EditionID -ErrorAction SilentlyContinue).EditionID } else { $null }
      manufacturer   = if ($cs) { $cs.Manufacturer } else { $null }
      model          = if ($cs) { $cs.Model } else { $null }
      biosVendor     = if ($bios) { $bios.Manufacturer } else { $null }
      biosVersion    = if ($bios) { "$($bios.SMBIOSBIOSVersion)" } else { $null }
      biosDate       = if ($bios) { "$($bios.ReleaseDate)" } else { $null }
      serialNumber   = if ($cs) { $cs.SerialNumber } else { $null }
      enclosureType  = $null
    }

    try {
      $enc = Get-CimInstance -ClassName Win32_SystemEnclosure -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($enc) {
        $typeMap = @{ 3='Desktop'; 4='Low Profile'; 6='Mini Tower'; 7='Tower'; 8='Portable';
          9='Laptop'; 10='Notebook'; 13='All-in-One'; 14='Sub-Notebook'; 23='Rack Mount'; 24='Sealed' }
        $data.enclosureType = $typeMap[[int]$enc.ChassisTypes[0]] ?? "Unknown ($($enc.ChassisTypes[0]))"
      }
    } catch {}

    # Windows activation
    try {
      $activation = Get-CimInstance -ClassName SoftwareLicensingProduct -ErrorAction SilentlyContinue |
        Where-Object { $_.PartialProductKey -and $_.ApplicationID -eq '55c92734-d682-4d71-983e-d6ec3f16059f' } |
        Select-Object -First 1
      if ($activation) {
        $data.activationStatus = if ($activation.LicenseStatus -eq 1) { 'activated' } else { 'not_activated' }
        $data.activationId = $activation.ID
      } else {
        $data.activationStatus = 'unknown'
      }
    } catch { $data.activationStatus = 'unknown' }

    # Secure Boot
    try {
      $sb = Confirm-SecureBootUEFI -ErrorAction SilentlyContinue
      $data.secureBoot = if ($sb -eq $true) { 'enabled' } elseif ($sb -eq $false) { 'disabled' } else { 'unsupported' }
    } catch { $data.secureBoot = 'unknown' }

    # TPM
    try {
      $tpm = Get-CimInstance -Namespace 'root\cimv2\Security\MicrosoftTpm' -ClassName Win32_Tpm -ErrorAction SilentlyContinue |
        Select-Object -First 1
      if ($tpm) {
        $data.tpmPresent = $true
        $data.tpmVersion = "$($tpm.SpecVersion)"
        $data.tpmEnabled = if ($tpm.IsEnabled_InitialValue -eq $true) { $true } else { $false }
        $data.tpmActivated = if ($tpm.IsActivated_InitialValue -eq $true) { $true } else { $false }
        $data.tpmManufacturerId = $tpm.ManufacturerId
      } else {
        # Fallback: check registry
        $tpmReg = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\TPM\WMI' -Name 'DriverVersion' -ErrorAction SilentlyContinue
        if ($tpmReg) {
          $data.tpmPresent = $true
          $data.tpmVersion = $tpmReg.DriverVersion
          $data.tpmEnabled = $true
        } else {
          $data.tpmPresent = $false
          $data.tpmVersion = $null
        }
      }
    } catch { $data.tpmPresent = $false }

    # BitLocker
    try {
      $bl = Get-BitLockerVolume -ErrorAction SilentlyContinue
      if ($bl) {
        $data.bitlockerStatus = @($bl | ForEach-Object { @{ drive = $_.MountPoint; status = "$($_.ProtectionStatus)" } })
        $data.bitlockerEnabled = $true
      } else {
        $data.bitlockerEnabled = $false
      }
    } catch { $data.bitlockerEnabled = 'unknown' }

    $result.data = $data
  } catch {
    $result.status = 'failed'
    $result.warnings = @($_.Exception.Message)
  }

  $result.duration = [math]::Round((Get-Date).Subtract($start).TotalSeconds, 2)
  return $result
}

if ($MyInvocation.InvocationName -eq '&' -or $MyInvocation.CommandOrigin -eq 'Runspace') {
  Invoke-WindowsDiagnostic | ConvertTo-Json -Compress -Depth 5
}
