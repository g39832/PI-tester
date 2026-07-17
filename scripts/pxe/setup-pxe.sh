#!/usr/bin/env bash
# DispoScan PXE Network Boot Server
#
# Sets up the Raspberry Pi as a PXE boot server so that a target
# laptop connected via Ethernet can network-boot into a diagnostic
# environment that auto-scans hardware and reports back.
#
# Usage:
#   sudo bash scripts/pxe/setup-pxe.sh
#
# After running, connect a laptop to the Pi's Ethernet port, set
# the laptop BIOS to boot from network (PXE), and power on.
# The laptop will boot the DispoScan diagnostic environment,
# run hardware probes, and POST results to the backend API.
#
# Requirements:
#   - Raspberry Pi with Ethernet port
#   - Target laptop with PXE-capable NIC
#   - Pi already running DispoScan backend (deploy-pi.sh)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

PXE_DIR="/opt/disposcan/pxe"
TFTP_ROOT="/srv/tftp"
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    err "This script must be run as root (sudo)."
    exit 1
  fi
}

install_packages() {
  log "Installing PXE dependencies..."
  apt-get install -y -qq dnsmasq syslinux-common pxelinux curl wget xz-utils
}

setup_dirs() {
  log "Creating TFTP directories..."
  mkdir -p "$TFTP_ROOT/pxelinux.cfg"
  mkdir -p "$TFTP_ROOT/boot"
  mkdir -p "$PXE_DIR"
}

configure_dnsmasq() {
  log "Configuring dnsmasq for PXE (integrating with Pi-hole / existing dnsmasq)..."

  # Find the Ethernet interface (not wlan0)
  ETH_IFACE=$(ip -o link show | awk -F': ' '{print $2}' | grep -v lo | grep -v wlan | head -1)
  if [ -z "$ETH_IFACE" ]; then
    ETH_IFACE="eth0"
  fi

  # Bring interface up (even without cable)
  ip link set "$ETH_IFACE" up 2>/dev/null || true

  # If Pi-hole's dnsmasq is running, integrate with it
  local DNSMASQ_D="/etc/dnsmasq.d"
  mkdir -p "$DNSMASQ_D"

  cat > "$DNSMASQ_D/disposcan-pxe.conf" << CONF
# DispoScan PXE Boot — DHCP + TFTP on $ETH_IFACE only
# This config is loaded by the existing dnsmasq (e.g., Pi-hole).
# It only serves PXE requests on the isolated Ethernet port.
interface=$ETH_IFACE
bind-dynamic
domain=disposcan.local
dhcp-range=192.168.2.10,192.168.2.100,12h
dhcp-option=3,192.168.2.1
dhcp-option=6,192.168.2.1
enable-tftp
tftp-root=$TFTP_ROOT
dhcp-boot=pxelinux.0
pxe-service=X86PC, "DispoScan Diagnostics", pxelinux
log-queries
log-dhcp
CONF

  # Restart the existing dnsmasq (Pi-hole or standalone)
  if systemctl is-active --quiet pihole-FTL 2>/dev/null; then
    systemctl restart pihole-FTL
    log "Restarted pihole-FTL with PXE config"
  elif systemctl is-active --quiet dnsmasq 2>/dev/null; then
    systemctl restart dnsmasq
    log "Restarted dnsmasq with PXE config"
  else
    # No existing dnsmasq — start standalone
    systemctl enable dnsmasq
    systemctl restart dnsmasq
    log "Started standalone dnsmasq with PXE config"
  fi
}

copy_bootloader() {
  log "Copying PXELINUX bootloader..."
  cp /usr/lib/PXELINUX/pxelinux.0 "$TFTP_ROOT/"
  cp /usr/lib/syslinux/modules/bios/ldlinux.c32 "$TFTP_ROOT/"
  cp /usr/lib/syslinux/modules/bios/libutil.c32 "$TFTP_ROOT/"
  cp /usr/lib/syslinux/modules/bios/menu.c32 "$TFTP_ROOT/"
}

download_kernel() {
  local kernel_out="$TFTP_ROOT/boot/vmlinuz-disposcan"
  if [ -f "$kernel_out" ] && [ "$(stat -c%s "$kernel_out" 2>/dev/null || echo 0)" -gt 5000000 ]; then
    log "Kernel already exists at $kernel_out"
    return 0
  fi

  log "Downloading Debian netboot kernel (amd64)..."
  # Use Debian installer's netboot kernel — guaranteed to work with PXE
  local KERNEL_URL="https://ftp.debian.org/debian/dists/trixie/main/installer-amd64/current/images/netboot/debian-installer/amd64/linux"
  echo "  URL: $KERNEL_URL"
  wget -q --timeout=60 "$KERNEL_URL" -O "$kernel_out" || {
    # Fallback to security.debian.org kernel package
    err "Netboot kernel download failed, trying package approach..."
    local kernel_deb="/tmp/linux-image-amd64.deb"
    KERNEL_URL="https://security.debian.org/debian-security/pool/updates/main/l/linux-signed-amd64/linux-image-6.12.95-amd64_6.12.95-1_amd64.deb"
    wget -q --timeout=60 "$KERNEL_URL" -O "$kernel_deb" || {
      err "Kernel download failed."
      err "Try manually: cd /tmp && wget https://ftp.debian.org/debian/dists/trixie/main/installer-amd64/current/images/netboot/debian-installer/amd64/linux"
      return 1
    }
    mkdir -p /tmp/kernel-extract
    cd /tmp/kernel-extract
    dpkg-deb -x "$kernel_deb" .
    find . -name 'vmlinuz-*' -exec cp {} "$kernel_out" \;
    cd /
    rm -rf /tmp/kernel-extract
  }

  if [ -f "$kernel_out" ] && [ "$(stat -c%s "$kernel_out" 2>/dev/null || echo 0)" -gt 5000000 ]; then
    log "Kernel extracted to $kernel_out ($(stat -c%s "$kernel_out")B)"
  else
    err "Kernel file is too small or missing."
    return 1
  fi
}

write_pxelinux_config() {
  log "Writing PXELINUX configuration..."
  cat > "$TFTP_ROOT/pxelinux.cfg/default" << CFG
DEFAULT disposcan
PROMPT 0
TIMEOUT 30

LABEL disposcan
  MENU LABEL ^DispoScan Hardware Diagnostics
  KERNEL boot/vmlinuz-disposcan
  INITRD boot/initramfs-disposcan.gz
  APPEND console=ttyS0,115200 console=tty0 quiet
CFG
}

build_initramfs() {
  log "Building diagnostic initramfs (this may take a minute)..."
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  bash "$script_dir/build-initramfs.sh"
  cp /tmp/initramfs-disposcan.gz "$TFTP_ROOT/boot/initramfs-disposcan.gz"
  log "Initramfs built and copied to $TFTP_ROOT/boot/initramfs-disposcan.gz"
}

verify() {
  log "Verifying PXE setup..."
  local errors=0

  for f in "$TFTP_ROOT/pxelinux.0" "$TFTP_ROOT/ldlinux.c32" "$TFTP_ROOT/boot/vmlinuz-disposcan" "$TFTP_ROOT/boot/initramfs-disposcan.gz" "$TFTP_ROOT/pxelinux.cfg/default"; do
    if [ -f "$f" ]; then
      echo "  ✓ $(basename "$f") — present"
    else
      echo "  ✗ $(basename "$f") — MISSING"
      errors=$((errors + 1))
    fi
  done

  if systemctl is-active dnsmasq &>/dev/null; then
    echo "  ✓ dnsmasq — running"
  else
    echo "  ✗ dnsmasq — not running"
    errors=$((errors + 1))
  fi

  echo ""
  if [ $errors -eq 0 ]; then
    echo -e "${GREEN}  ✓ PXE setup complete.${NC}"
    echo ""
    echo "  Connect a laptop to the Pi's Ethernet port,"
    echo "  set BIOS to network boot, and power on."
    echo "  Results appear in the DispoScan kiosk."
  else
    echo -e "${YELLOW}  ⚠ $errors check(s) failed.${NC}"
  fi
}

main() {
  echo ""
  echo "╔══════════════════════════════════════════════╗"
  echo "║     DispoScan PXE Boot Server Setup          ║"
  echo "╚══════════════════════════════════════════════╝"
  echo ""

  require_root
  install_packages
  setup_dirs
  configure_dnsmasq
  copy_bootloader
  download_kernel
  write_pxelinux_config
  build_initramfs
  verify

  echo ""
  echo "╔══════════════════════════════════════════════╗"
  echo "║     PXE Boot Server Ready!                   ║"
  echo "║                                              ║"
  echo "║  Connect a laptop to the Pi's Ethernet port   ║"
  echo "║  Set the laptop BIOS to boot from network     ║"
  echo "║  Results automatically appear in the kiosk    ║"
  echo "╚══════════════════════════════════════════════╝"
  echo ""
}

main "$@"
