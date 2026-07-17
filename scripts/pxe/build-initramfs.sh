#!/usr/bin/env bash
# Build the DispoScan PXE diagnostic initramfs
#
# Creates a minimal x86_64 Linux initramfs that:
#   1. Boots into a busybox-based environment
#   2. Auto-runs hardware diagnostics (lshw, dmidecode, smartctl)
#   3. POSTs results to the DispoScan API
#   4. Displays status on screen
#
# This script is called by setup-pxe.sh and can also be run
# standalone to rebuild the initramfs.
#
# Output: /tmp/initramfs-disposcan.gz

set -euo pipefail

ROOTFS="/tmp/initramfs-root"
OUTPUT="/tmp/initramfs-disposcan.gz"
BACKEND_URL="${BACKEND_URL:-http://10.42.40.75:3001}"

rm -rf "$ROOTFS"
mkdir -p "$ROOTFS"

# ────────────────────────────────────────────────────────────
# Create directory structure
# ────────────────────────────────────────────────────────────
mkdir -p "$ROOTFS"/{bin,sbin,etc,dev,proc,sys,mnt/root,tmp,newroot}

# ────────────────────────────────────────────────────────────
# Download busybox (static, x86_64)
# ────────────────────────────────────────────────────────────
BUSYBOX_URL="https://busybox.net/downloads/binaries/1.36.1-x86_64-linux-musl/busybox"
BUSYBOX_PATH="$ROOTFS/bin/busybox"

if [ ! -f "$BUSYBOX_PATH" ]; then
  echo "Downloading busybox..."
  wget -q "$BUSYBOX_URL" -O "$BUSYBOX_PATH" || {
    # Fallback: try Debian busybox-static package
    apt-get download busybox-static 2>/dev/null || true
    dpkg-deb -x busybox-static*.deb "$ROOTFS" 2>/dev/null || true
  }
fi

if [ ! -f "$BUSYBOX_PATH" ]; then
  echo "ERROR: Could not download busybox. Trying apt install..."
  apt-get install -y busybox-static 2>/dev/null || true
  cp /bin/busybox "$BUSYBOX_PATH" 2>/dev/null || true
fi

chmod +x "$BUSYBOX_PATH" 2>/dev/null || true

# Install busybox applets
for applet in sh mount umount cat echo ls mkdir rm cp mv grep sed cut sort head tail dmesg ifconfig ip route udhcpc wget free lsusb lsblk blkid clear sleep printf kill modprobe insmod ln df; do
  ln -sf /bin/busybox "$ROOTFS/bin/$applet" 2>/dev/null || true
done

# ────────────────────────────────────────────────────────────
# Download static binaries for hardware diagnostics
# ────────────────────────────────────────────────────────────

# dmidecode
if ! command -v dmidecode &>/dev/null; then
  apt-get install -y dmidecode 2>/dev/null || true
fi
if [ -f /usr/sbin/dmidecode ]; then
  cp /usr/sbin/dmidecode "$ROOTFS/bin/dmidecode" 2>/dev/null || true
fi

# lshw
if ! command -v lshw &>/dev/null; then
  apt-get install -y lshw 2>/dev/null || true
fi
if [ -f /usr/bin/lshw ]; then
  cp /usr/bin/lshw "$ROOTFS/bin/lshw" 2>/dev/null || true
fi

# smartctl
if ! command -v smartctl &>/dev/null; then
  apt-get install -y smartmontools 2>/dev/null || true
fi
if [ -f /usr/sbin/smartctl ]; then
  cp /usr/sbin/smartctl "$ROOTFS/bin/smartctl" 2>/dev/null || true
fi

# hdparm
if ! command -v hdparm &>/dev/null; then
  apt-get install -y hdparm 2>/dev/null || true
fi
if [ -f /sbin/hdparm ]; then
  cp /sbin/hdparm "$ROOTFS/bin/hdparm" 2>/dev/null || true
fi

# Copy needed libraries for dynamic binaries
mkdir -p "$ROOTFS/lib"

# Try to copy libraries dynamically linked binaries need
for bin in "$ROOTFS/bin/"*; do
  if [ -f "$bin" ]; then
    ldd "$bin" 2>/dev/null | awk '{print $3}' | grep -v '^$' | while read -r lib; do
      if [ -f "$lib" ]; then
        mkdir -p "$ROOTFS/$(dirname "${lib#/}")"
        cp "$lib" "$ROOTFS$lib" 2>/dev/null || true
      fi
    done || true
  fi
done

# Also copy ld-linux
cp /lib/*/ld-linux-x86-64* "$ROOTFS/lib/" 2>/dev/null || true
cp /lib/x86_64-linux-gnu/libc.so* "$ROOTFS/lib/x86_64-linux-gnu/" 2>/dev/null || true
cp /lib/x86_64-linux-gnu/libm.so* "$ROOTFS/lib/x86_64-linux-gnu/" 2>/dev/null || true
cp /lib/x86_64-linux-gnu/libpthread.so* "$ROOTFS/lib/x86_64-linux-gnu/" 2>/dev/null || true
cp /lib/x86_64-linux-gnu/libdl.so* "$ROOTFS/lib/x86_64-linux-gnu/" 2>/dev/null || true

# ────────────────────────────────────────────────────────────
# Write the /init script
# ────────────────────────────────────────────────────────────
cat > "$ROOTFS/init" << 'INITSCRIPT'
#!/bin/sh

# DispoScan PXE Diagnostic Boot
# Auto-runs hardware probes and POSTs results to the backend

export PATH=/bin:/sbin:/usr/bin:/usr/sbin
BACKEND_URL="${BACKEND_URL:-http://10.42.40.75:3001}"

echo "╔══════════════════════════════════════════════╗"
echo "║     DispoScan Hardware Diagnostics            ║"
echo "║     Running hardware probes...                ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Mount essential filesystems
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev

echo "[1/4] Detecting hardware..."

# Determine hostname
echo "disposcan-pxe" > /etc/hostname
hostname -F /etc/hostname

# Configure loopback
ifconfig lo 127.0.0.1 up

# Bring up Ethernet and get IP via DHCP
echo "[2/4] Connecting to network..."
ifconfig eth0 0.0.0.0 up
udhcpc -i eth0 -s /bin/sh -q -n 2>/dev/null || true

# Try to get an IP (wait up to 10 seconds)
for i in $(seq 1 10); do
  IP=$(ip -4 addr show eth0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
  if [ -n "$IP" ]; then
    break
  fi
  sleep 1
done

echo "IP: ${IP:-DHCP failed (using link-local)}"

# Hardware collection
echo "[3/4] Collecting hardware data..."

# lshw - full hardware tree (JSON)
LSHW_JSON=""
if command -v lshw >/dev/null 2>&1; then
  LSHW_JSON=$(lshw -json 2>/dev/null || echo "{}")
else
  # Minimal hardware detection via /proc and /sys
  LSHW_JSON="{ \"error\": \"lshw not available\" }"
fi

# dmidecode - DMI/SMBIOS table
DMIDECODE_OUT=""
if command -v dmidecode >/dev/null 2>&1; then
  DMIDECODE_OUT=$(dmidecode 2>/dev/null || echo "dmidecode failed")
fi

# CPU info from /proc/cpuinfo
CPU_INFO=$(cat /proc/cpuinfo 2>/dev/null || echo "")

# Memory info
MEM_TOTAL=$(free -m 2>/dev/null | grep Mem | awk '{print $2}' || echo "")
MEM_INFO=$(cat /proc/meminfo 2>/dev/null || echo "")

# Storage - look for drives
STORAGE_INFO=""
for dev in /dev/sd[a-z] /dev/nvme[0-9]n[0-9] /dev/mmcblk[0-9]; do
  if [ -b "$dev" ]; then
    DEV_NAME=$(basename "$dev")
    SIZE=$(( $(blockdev --getsize64 "$dev" 2>/dev/null || echo 0) / 1024 / 1024 / 1024 ))
    MODEL=$(cat "/sys/block/$DEV_NAME/device/model" 2>/dev/null || echo "")
    VENDOR=$(cat "/sys/block/$DEV_NAME/device/vendor" 2>/dev/null || echo "")
    STORAGE_INFO="${STORAGE_INFO}${DEV_NAME}: ${SIZE}GB ${VENDOR} ${MODEL}
"

    # SMART data
    if command -v smartctl >/dev/null 2>&1; then
      SMART_DATA=$(smartctl -a "$dev" 2>/dev/null || true)
    fi
  fi
done

# PCI devices
PCI_INFO=$(cat /proc/bus/pci/devices 2>/dev/null || lspci 2>/dev/null || echo "")

# USB devices
USB_INFO=$(lsusb 2>/dev/null || echo "")

# GPU - get from /proc or lshw
GPU_INFO=""
if command -v lshw >/dev/null 2>&1; then
  GPU_INFO=$(echo "$LSHW_JSON" | grep -o '"product":"[^"]*"' | head -5 || echo "")
fi

# Build JSON payload
PAYLOAD=$(cat << PAYLOAD_EOF
{
  "lshwJson": $(echo "$LSHW_JSON" | tr -d '\n'),
  "dmidecode": $(echo "$DMIDECODE_OUT" | head -200 | tr -d '\n' | sed 's/"/\\"/g' | awk '{printf "\"%s\"", $0}'),
  "cpuInfo": $(echo "$CPU_INFO" | head -50 | tr -d '\n' | sed 's/"/\\"/g' | awk '{printf "\"%s\"", $0}'),
  "memTotalMb": "${MEM_TOTAL}",
  "memInfo": $(echo "$MEM_INFO" | head -30 | tr -d '\n' | sed 's/"/\\"/g' | awk '{printf "\"%s\"", $0}'),
  "storage": $(echo "$STORAGE_INFO" | tr -d '\n' | sed 's/"/\\"/g' | awk '{printf "\"%s\"", $0}'),
  "pciDevices": $(echo "$PCI_INFO" | head -50 | tr -d '\n' | sed 's/"/\\"/g' | awk '{printf "\"%s\"", $0}'),
  "usbDevices": $(echo "$USB_INFO" | head -30 | tr -d '\n' | sed 's/"/\\"/g' | awk '{printf "\"%s\"", $0}'),
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source": "pxe-boot"
}
PAYLOAD_EOF
)

# Save payload for debugging
echo "$PAYLOAD" > /tmp/payload.json 2>/dev/null || true

# Send to backend
echo "[4/4] Sending results to DispoScan server..."
echo ""

RESULT=""
if command -v wget >/dev/null 2>&1; then
  RESULT=$(wget -q -O- --post-data="$PAYLOAD" --header="Content-Type: application/json" "$BACKEND_URL/api/v1/collector/network-boot" 2>/dev/null || echo "FAILED")
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     DispoScan Diagnostics Complete            ║"
echo "║                                              ║"
if echo "$RESULT" | grep -q '"deviceId"'; then
  echo "║  ✓ Results sent successfully!                ║"
  DEVICE_ID=$(echo "$RESULT" | grep -o '"deviceId":"[^"]*"' | cut -d'"' -f4)
  echo "║  Device ID: $DEVICE_ID"
else
  echo "║  ⚠ Results may not have been sent             ║"
  echo "║  Check that the Pi is reachable at:           ║"
  echo "║    $BACKEND_URL"
fi
echo "║                                              ║"
echo "║  You can now power off this computer.         ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Keep display up for 30 seconds then power off
sleep 30
echo "Powering off..."
poweroff -f
INITSCRIPT

chmod +x "$ROOTFS/init"

# ────────────────────────────────────────────────────────────
# Create essential device nodes (some kernels need this)
# ────────────────────────────────────────────────────────────
mknod -m 0666 "$ROOTFS/dev/null" c 1 3 2>/dev/null || true
mknod -m 0600 "$ROOTFS/dev/console" c 5 1 2>/dev/null || true

# ────────────────────────────────────────────────────────────
# /etc/resolv.conf for DNS
# ────────────────────────────────────────────────────────────
echo "nameserver 8.8.8.8" > "$ROOTFS/etc/resolv.conf"
echo "nameserver 1.1.1.1" >> "$ROOTFS/etc/resolv.conf"

# ────────────────────────────────────────────────────────────
# /etc/hosts
# ────────────────────────────────────────────────────────────
echo "127.0.0.1 localhost" > "$ROOTFS/etc/hosts"

# ────────────────────────────────────────────────────────────
# Pack initramfs
# ────────────────────────────────────────────────────────────
echo "Packing initramfs..."
cd "$ROOTFS"
find . | cpio -H newc -o 2>/dev/null | gzip -9 > "$OUTPUT"
cd /

echo "Initramfs built: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
