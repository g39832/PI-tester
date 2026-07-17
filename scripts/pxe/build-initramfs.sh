#!/usr/bin/env bash
# Build the DispoScan PXE diagnostic initramfs (x86_64)
#
# Downloads x86_64 binaries from Debian amd64 .deb packages
# so the initramfs can boot on any standard x86_64 laptop.
#
# Output: /tmp/initramfs-disposcan.gz

set -euo pipefail

ROOTFS="/tmp/initramfs-root"
OUTPUT="/tmp/initramfs-disposcan.gz"
BACKEND_URL="${BACKEND_URL:-http://10.42.40.75:3001}"
DEBIAN_MIRROR="${DEBIAN_MIRROR:-https://deb.debian.org/debian}"
TEMP_DEB="/tmp/pxe-debs"

rm -rf "$ROOTFS" "$TEMP_DEB"
mkdir -p "$ROOTFS"/{bin,sbin,etc,dev,proc,sys,tmp,lib/x86_64-linux-gnu,usr/lib}
mkdir -p "$TEMP_DEB"

# ────────────────────────────────────────────────────────────
# Download and extract x86_64 .deb packages
# ────────────────────────────────────────────────────────────
download_deb() {
  local pkg="$1"
  local url="$DEBIAN_MIRROR/pool/main/$2"
  local deb_file="$TEMP_DEB/${pkg}.deb"

  if [ ! -f "$deb_file" ]; then
    echo "  Downloading $pkg (amd64)..."
    # Try to get the .deb URL via packages.debian.org
    local pkg_url
    pkg_url=$(curl -sL "https://packages.debian.org/trixie/amd64/${pkg}/download" 2>/dev/null | grep -oP 'href="[^"]*\.deb"' | head -1 | sed 's/href="//;s/"//')
    if [ -n "$pkg_url" ]; then
      wget -q --timeout=30 "$pkg_url" -O "$deb_file" || return 1
    else
      # Fallback: construct URL directly
      wget -q --timeout=30 "$url" -O "$deb_file" || return 1
    fi
  fi

  echo "  Extracting $pkg..."
  dpkg-deb -x "$deb_file" "$ROOTFS" 2>/dev/null || true
}

echo ""
echo "Downloading x86_64 tool binaries..."

# busybox-static (provides /bin/busybox for x86_64)
download_deb "busybox-static" "b/busybox" || {
  echo "ERROR: Failed to download busybox-static"
  exit 1
}

# dmidecode
download_deb "dmidecode" "d/dmidecode" || true

# lshw (use lshw-static for static binary)
download_deb "lshw-static" "l/lshw" || true

# smartmontools
download_deb "smartmontools" "s/smartmontools" || true

# hdparm
download_deb "hdparm" "h/hdparm" || true

# libc6 (x86_64) - needed for dynamically linked binaries
download_deb "libc6" "g/glibc" || true

# libgcc-s1
download_deb "libgcc-s1" "g/gcc-defaults" || true

echo ""

# ────────────────────────────────────────────────────────────
# Move binaries to /bin for consistency
# ────────────────────────────────────────────────────────────
for f in "$ROOTFS/usr/sbin/"* "$ROOTFS/sbin/"*; do
  if [ -f "$f" ] && [ ! -f "$ROOTFS/bin/$(basename "$f")" ]; then
    cp "$f" "$ROOTFS/bin/" 2>/dev/null || true
  fi
done

# If busybox wasn't found in the expected location, try alternatives
if [ ! -f "$ROOTFS/bin/busybox" ]; then
  find "$ROOTFS" -name 'busybox' -exec cp {} "$ROOTFS/bin/busybox" \; 2>/dev/null || true
fi

chmod +x "$ROOTFS/bin/busybox" 2>/dev/null || true

# Install busybox applets
if [ -f "$ROOTFS/bin/busybox" ]; then
  for applet in sh mount umount cat echo ls mkdir rm cp mv grep sed cut sort head tail dmesg ifconfig ip route udhcpc wget free lsusb sleep clear printf kill modprobe insmod ln df blockdev poweroff; do
    ln -sf /bin/busybox "$ROOTFS/bin/$applet" 2>/dev/null || true
  done
fi

# Copy x86_64 libraries to the right place
mkdir -p "$ROOTFS/lib/x86_64-linux-gnu"
if [ -d "$ROOTFS/lib/x86_64-linux-gnu" ]; then
  find "$ROOTFS" -name 'ld-linux-x86-64*' -exec cp {} "$ROOTFS/lib/" \; 2>/dev/null || true
  find "$ROOTFS" -name 'libc.so*' -path '*/x86_64*' -exec cp {} "$ROOTFS/lib/x86_64-linux-gnu/" \; 2>/dev/null || true
  find "$ROOTFS" -name 'libm.so*' -path '*/x86_64*' -exec cp {} "$ROOTFS/lib/x86_64-linux-gnu/" \; 2>/dev/null || true
  find "$ROOTFS" -name 'libpthread.so*' -path '*/x86_64*' -exec cp {} "$ROOTFS/lib/x86_64-linux-gnu/" \; 2>/dev/null || true
  find "$ROOTFS" -name 'libdl.so*' -path '*/x86_64*' -exec cp {} "$ROOTFS/lib/x86_64-linux-gnu/" \; 2>/dev/null || true
  find "$ROOTFS" -name 'libgcc_s.so*' -exec cp {} "$ROOTFS/lib/x86_64-linux-gnu/" \; 2>/dev/null || true
fi

# Clean up unused architectures (remove ARM/ARM64 libs)
find "$ROOTFS/lib" -name '*-linux-arm*' -type d -exec rm -rf {} + 2>/dev/null || true
find "$ROOTFS/usr/lib" -name '*-linux-arm*' -type d -exec rm -rf {} + 2>/dev/null || true

# ────────────────────────────────────────────────────────────
# Write the /init script
# ────────────────────────────────────────────────────────────
cat > "$ROOTFS/init" << 'INITSCRIPT'
#!/bin/sh

export PATH=/bin:/sbin:/usr/bin:/usr/sbin
BACKEND_URL="${BACKEND_URL:-http://10.42.40.75:3001}"
LOG="/tmp/disposcan.log"

echo "╔══════════════════════════════════════════════╗"
echo "║     DispoScan Hardware Diagnostics            ║"
echo "║     Running hardware probes...                ║"
echo "╚══════════════════════════════════════════════╝" | tee "$LOG"

# Mount essential filesystems
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev

echo "[1/4] Detecting hardware..." | tee -a "$LOG"

# Configure loopback
ifconfig lo 127.0.0.1 up

# Bring up Ethernet and get IP via DHCP
echo "[2/4] Connecting to network..." | tee -a "$LOG"
ifconfig eth0 0.0.0.0 up
udhcpc -i eth0 -s /bin/sh -q -n 2>/dev/null || true

IP=""
for i in 1 2 3 4 5 6 7 8 9 10; do
  IP=$(ip -4 addr show eth0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
  if [ -n "$IP" ]; then break; fi
  sleep 1
done
echo "  IP: ${IP:-not assigned}" | tee -a "$LOG"

# Hardware collection
echo "[3/4] Collecting hardware data..." | tee -a "$LOG"

# lshw - full hardware tree (JSON)
LSHW_JSON="{}"
if command -v lshw >/dev/null 2>&1; then
  LSHW_JSON=$(lshw -json 2>/dev/null || echo "{}")
fi

# dmidecode
DMIDECODE_OUT=""
if command -v dmidecode >/dev/null 2>&1; then
  DMIDECODE_OUT=$(dmidecode 2>/dev/null || echo "")
fi

# CPU info
CPU_INFO=$(cat /proc/cpuinfo 2>/dev/null || echo "")
MEM_TOTAL=$(free -m 2>/dev/null | grep Mem | awk '{print $2}' || echo "")
MEM_INFO=$(cat /proc/meminfo 2>/dev/null || echo "")

# Storage
STORAGE_INFO=""
SMART_DATA=""
for dev in /dev/sd[a-z] /dev/nvme[0-9]n[0-9] /dev/mmcblk[0-9]; do
  if [ -b "$dev" ]; then
    DEV_NAME=$(basename "$dev")
    SIZE=$(( $(blockdev --getsize64 "$dev" 2>/dev/null || echo 0) / 1024 / 1024 / 1024 ))
    MODEL=$(cat "/sys/block/$DEV_NAME/device/model" 2>/dev/null || echo "")
    VENDOR=$(cat "/sys/block/$DEV_NAME/device/vendor" 2>/dev/null || echo "")
    STORAGE_INFO="${STORAGE_INFO}${DEV_NAME}: ${SIZE}GB ${VENDOR} ${MODEL}"$'\n'
    if command -v smartctl >/dev/null 2>&1; then
      SMART_DATA="${SMART_DATA}$DEV_NAME: $(smartctl -H "$dev" 2>/dev/null | grep 'SMART overall-health' || echo 'N/A')"$'\n'
    fi
  fi
done

# PCI / USB
PCI_INFO=$(cat /proc/bus/pci/devices 2>/dev/null || lspci 2>/dev/null || echo "")
USB_INFO=$(lsusb 2>/dev/null || echo "")

# Build JSON payload
PAYLOAD=$(cat << PAYLOAD_EOF
{
  "lshwJson": $(echo "$LSHW_JSON" | tr -d '\n'),
  "dmidecode": $(echo "$DMIDECODE_OUT" | head -200 | tr -d '\n' | sed 's/"/\\"/g' | awk '{printf "\"%s\"", $0}'),
  "cpuInfo": $(echo "$CPU_INFO" | head -50 | tr -d '\n' | sed 's/"/\\"/g' | awk '{printf "\"%s\"", $0}'),
  "memTotalMb": "${MEM_TOTAL}",
  "memInfo": $(echo "$MEM_INFO" | head -30 | tr -d '\n' | sed 's/"/\\"/g' | awk '{printf "\"%s\"", $0}'),
  "storage": $(echo "$STORAGE_INFO" | tr -d '\n' | sed 's/"/\\"/g' | awk '{printf "\"%s\"", $0}'),
  "smartData": $(echo "$SMART_DATA" | tr -d '\n' | sed 's/"/\\"/g' | awk '{printf "\"%s\"", $0}'),
  "pciDevices": $(echo "$PCI_INFO" | head -50 | tr -d '\n' | sed 's/"/\\"/g' | awk '{printf "\"%s\"", $0}'),
  "usbDevices": $(echo "$USB_INFO" | head -30 | tr -d '\n' | sed 's/"/\\"/g' | awk '{printf "\"%s\"", $0}'),
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source": "pxe-boot"
}
PAYLOAD_EOF
)

echo "$PAYLOAD" > /tmp/payload.json 2>/dev/null || true

# Send to backend
echo "[4/4] Sending results to DispoScan server..." | tee -a "$LOG"
echo "" | tee -a "$LOG"

RESULT=""
if command -v wget >/dev/null 2>&1; then
  RESULT=$(wget -q -O- --post-data="$PAYLOAD" --header="Content-Type: application/json" "$BACKEND_URL/api/v1/collector/network-boot" 2>/dev/null || echo "FAILED")
fi

echo "" >> "$LOG"
if echo "$RESULT" | grep -q '"deviceId"'; then
  echo "  ✓ Results sent successfully!" | tee -a "$LOG"
  DEVICE_ID=$(echo "$RESULT" | grep -o '"deviceId":"[^"]*"' | cut -d'"' -f4)
  echo "  Device ID: $DEVICE_ID" | tee -a "$LOG"
else
  echo "  ⚠ Failed to send results" | tee -a "$LOG"
  echo "  Check Pi is reachable at: $BACKEND_URL" | tee -a "$LOG"
fi

echo "" | tee -a "$LOG"
echo "╔══════════════════════════════════════════════╗" | tee -a "$LOG"
echo "║     Diagnostics Complete — You can power off  ║" | tee -a "$LOG"
echo "╚══════════════════════════════════════════════╝" | tee -a "$LOG"

# Show on screen for 30 seconds, then power off
sleep 30
echo "Powering off..." | tee -a "$LOG"
poweroff -f
INITSCRIPT

chmod +x "$ROOTFS/init"

# ────────────────────────────────────────────────────────────
# Device nodes
# ────────────────────────────────────────────────────────────
mknod -m 0666 "$ROOTFS/dev/null" c 1 3 2>/dev/null || true
mknod -m 0600 "$ROOTFS/dev/console" c 5 1 2>/dev/null || true

# ────────────────────────────────────────────────────────────
# Network config
# ────────────────────────────────────────────────────────────
echo "nameserver 8.8.8.8" > "$ROOTFS/etc/resolv.conf"
echo "nameserver 1.1.1.1" >> "$ROOTFS/etc/resolv.conf"
echo "127.0.0.1 localhost" > "$ROOTFS/etc/hosts"

# ────────────────────────────────────────────────────────────
# Pack initramfs
# ────────────────────────────────────────────────────────────
echo ""
echo "Packing initramfs..."
cd "$ROOTFS"
find . | cpio -H newc -o 2>/dev/null | gzip -9 > "$OUTPUT"
cd /

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "Done: $OUTPUT ($SIZE)"

# Cleanup
rm -rf "$TEMP_DEB"
