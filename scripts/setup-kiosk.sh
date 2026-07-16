#!/usr/bin/env bash
# DispoScan Raspberry Pi Kiosk Setup
# Run this ONCE on a fresh Raspberry Pi OS (Lite or Desktop) to configure
# auto-launch of the DispoScan diagnostic appliance in full-screen kiosk mode.
#
# Usage: sudo bash scripts/setup-kiosk.sh
#
# This script:
#   1. Installs Chromium and unclutter (hides mouse cursor)
#   2. Creates a systemd service that auto-launches Chromium in kiosk mode
#   3. Disables screen blanking / DPMS
#   4. Configures the Pi to auto-login and start the X session
#   5. Installs Node.js 20 and pnpm if not already present
#   6. Clones or pulls the DispoScan repo and builds the frontend
#   7. Starts the backend API server as a systemd service

set -euo pipefail

KIOSK_URL="${KIOSK_URL:-http://localhost:5173}"
REPO_DIR="${REPO_DIR:-/home/pi/disposcan}"
NODE_VERSION="20"

echo "=== DispoScan Kiosk Setup ==="
echo "Target URL: $KIOSK_URL"
echo "Repo dir:   $REPO_DIR"

# ── 1. System packages ────────────────────────────────────────────────
echo "[1/7] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  chromium-browser \
  unclutter \
  xdotool \
  curl \
  git \
  build-essential \
  xserver-xorg \
  x11-xserver-utils \
  xinit \
  raspberrypi-ui-mods \
  policykit-1

# ── 2. Install Node.js via NodeSource ──────────────────────────────────
echo "[2/7] Installing Node.js $NODE_VERSION..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo bash -
  sudo apt-get install -y -qq nodejs
fi
if ! command -v pnpm &>/dev/null; then
  sudo npm install -g pnpm
fi

echo "Node: $(node --version)"
echo "pnpm: $(pnpm --version)"

# ── 3. Clone / pull repo ──────────────────────────────────────────────
echo "[3/7] Setting up repository..."
if [ ! -d "$REPO_DIR" ]; then
  sudo -u pi git clone https://github.com/your-org/disposcan.git "$REPO_DIR"
fi
sudo chown -R pi:pi "$REPO_DIR"
cd "$REPO_DIR"
sudo -u pi git pull --ff-only || true

# ── 4. Build the project ──────────────────────────────────────────────
echo "[4/7] Building project..."
sudo -u pnpm install
sudo -u pnpm build

# ── 5. Create backend systemd service ──────────────────────────────────
echo "[5/7] Creating backend service..."
sudo tee /etc/systemd/system/disposcan-backend.service > /dev/null <<SVC
[Unit]
Description=DispoScan Diagnostic Backend
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=$REPO_DIR
ExecStart=$(which node) $REPO_DIR/apps/backend/dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=DATABASE_PATH=$REPO_DIR/disposcan.db
Environment=CORS_ORIGIN=http://localhost:5173
Environment=REPORTS_DIR=$REPO_DIR/reports

[Install]
WantedBy=multi-user.target
SVC

# ── 6. Create kiosk systemd service ────────────────────────────────────
echo "[6/7] Creating kiosk service..."
sudo tee /etc/systemd/system/disposcan-kiosk.service > /dev/null <<SVC
[Unit]
Description=DispoScan Kiosk (Chromium)
After=graphical.target disposcan-backend.service
Requires=disposcan-backend.service

[Service]
Type=simple
User=pi
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/pi/.Xauthority
ExecStartPre=/usr/bin/sleep 5
ExecStart=/bin/bash -c ' \
  xset s off && \
  xset -dpms && \
  xset s noblank && \
  unclutter -idle 0.1 -root & \
  chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-session-crashed-bubble \
    --disable-infobars \
    --disable-restore-session-state \
    --disable-features=TranslateUI \
    --no-first-run \
    --check-for-update-interval=604800 \
    --touch-events=enabled \
    --fast \
    --fast-start \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --disable-features=TouchpadOverscrollHistoryNavigation \
    "$KIOSK_URL" \
'
Restart=always
RestartSec=5

[Install]
WantedBy=graphical.target
SVC

# ── 7. Enable services and configure auto-login ────────────────────────
echo "[7/7] Enabling services and configuring auto-login..."
sudo systemctl daemon-reload
sudo systemctl enable disposcan-backend.service
sudo systemctl enable disposcan-kiosk.service

# Enable auto-login on tty1
sudo raspi-config nonint do_boot_behaviour B2 || true

# Add to /boot/config.txt if not present
if ! grep -q "disable_splash=1" /boot/config.txt 2>/dev/null; then
  echo "disable_splash=1" | sudo tee -a /boot/config.txt
fi
if ! grep -q "boot_delay=0" /boot/config.txt 2>/dev/null; then
  echo "boot_delay=0" | sudo tee -a /boot/config.txt
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "The system will boot directly into the DispoScan appliance."
echo "Reboot now? (y/N)"
read -r REPLY
if [[ "$REPLY" =~ ^[Yy]$ ]]; then
  sudo reboot
fi
