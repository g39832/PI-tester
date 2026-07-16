#!/usr/bin/env bash
# DispoScan Raspberry Pi Deployment Script
# One-step production setup for a fresh Raspberry Pi OS (Bookworm).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/your-org/disposcan/main/scripts/deploy-pi.sh | sudo bash
#   # OR locally:
#   sudo bash scripts/deploy-pi.sh
#
# The script is idempotent — safe to re-run on an already-configured Pi.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/your-org/disposcan.git}"
REPO_DIR="${REPO_DIR:-/opt/disposcan}"
KIOSK_URL="${KIOSK_URL:-http://localhost:3001}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
WS_PORT="${WS_PORT:-3002}"
NODE_VERSION="${NODE_VERSION:-20}"
PI_USER="${PI_USER:-pi}"
ADVERTISED_HOSTNAME="${ADVERTISED_HOSTNAME:-disposcan}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    err "This script must be run as root (sudo)."
    exit 1
  fi
}

# ──────────────────────────────────────────────────────────────────────
# 1. System packages
# ──────────────────────────────────────────────────────────────────────
install_system_packages() {
  log "Installing system packages..."
  apt-get update -qq
  apt-get install -y -qq \
    curl git build-essential \
    chromium-browser unclutter xdotool \
    xserver-xorg x11-xserver-utils xinit \
    raspberrypi-ui-mods policykit-1 \
    avahi-daemon libnss-mdns \
    sqlite3 jq

  # Enable mDNS (avahi) on boot
  systemctl enable avahi-daemon
  systemctl start avahi-daemon
}

# ──────────────────────────────────────────────────────────────────────
# 2. Install Node.js and pnpm
# ──────────────────────────────────────────────────────────────────────
install_node() {
  if command -v node &>/dev/null && [ "$(node --version | cut -d. -f1 | tr -d v)" -ge "$NODE_VERSION" ]; then
    log "Node.js $(node --version) already installed."
  else
    log "Installing Node.js $NODE_VERSION..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
    apt-get install -y -qq nodejs
  fi

  if ! command -v pnpm &>/dev/null; then
    log "Installing pnpm..."
    npm install -g pnpm
  fi
  log "Node: $(node --version) | pnpm: $(pnpm --version)"
}

# ──────────────────────────────────────────────────────────────────────
# 3. Clone / pull repository
# ──────────────────────────────────────────────────────────────────────
setup_repo() {
  if [ ! -d "$REPO_DIR" ]; then
    log "Cloning repository..."
    git clone "$REPO_URL" "$REPO_DIR"
  else
    log "Repository exists. Updating..."
    cd "$REPO_DIR"
    git pull --ff-only || warn "Could not pull latest changes (continuing with local copy)."
  fi
  chown -R "$PI_USER:$PI_USER" "$REPO_DIR"
  chmod -R o-rwx "$REPO_DIR"
}

# ──────────────────────────────────────────────────────────────────────
# 4. Build the project
# ──────────────────────────────────────────────────────────────────────
build_project() {
  log "Installing dependencies and building..."
  cd "$REPO_DIR"
  sudo -u "$PI_USER" pnpm install --frozen-lockfile || sudo -u "$PI_USER" pnpm install
  sudo -u "$PI_USER" pnpm -r build
  log "Build complete."
}

# ──────────────────────────────────────────────────────────────────────
# 5. Avahi mDNS advertisement
# ──────────────────────────────────────────────────────────────────────
setup_mdns() {
  local service_file="/etc/avahi/services/disposcan.service"
  if [ ! -f "$service_file" ]; then
    log "Configuring mDNS advertisement..."
    mkdir -p /etc/avahi/services
    cat > "$service_file" << AVAHI
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>DispoScan Diagnostic Appliance</name>
  <service>
    <type>_disposcan._tcp</type>
    <port>$BACKEND_PORT</port>
    <txt-record>path=/api/v1/health</txt-record>
    <txt-record>version=3.0.0</txt-record>
  </service>
</service-group>
AVAHI
    systemctl restart avahi-daemon
  else
    log "mDNS service already configured."
  fi
}

# ──────────────────────────────────────────────────────────────────────
# 6. Create backend systemd service
# ──────────────────────────────────────────────────────────────────────
setup_backend_service() {
  log "Creating backend systemd service..."
  cat > /etc/systemd/system/disposcan-backend.service << SVC
[Unit]
Description=DispoScan Diagnostic Backend (Express + WebSocket)
Documentation=https://github.com/your-org/disposcan
After=network.target avahi-daemon.service
Wants=avahi-daemon.service

[Service]
Type=simple
User=$PI_USER
WorkingDirectory=$REPO_DIR
ExecStart=$(which node) $REPO_DIR/apps/backend/dist/index.js
Restart=always
RestartSec=5
LimitNOFILE=65536
Environment=NODE_ENV=production
Environment=PORT=$BACKEND_PORT
Environment=WS_PORT=$WS_PORT
Environment=DATABASE_PATH=$REPO_DIR/data/disposcan.db
Environment=CORS_ORIGIN=http://localhost:5173
Environment=REPORTS_DIR=$REPO_DIR/data/reports
Environment=ATTACHMENTS_DIR=$REPO_DIR/data/attachments
Environment=BACKUP_DIR=$REPO_DIR/data/backups
Environment=LOG_LEVEL=info

[Install]
WantedBy=multi-user.target
SVC
}

# ──────────────────────────────────────────────────────────────────────
# 7. Create kiosk systemd service
# ──────────────────────────────────────────────────────────────────────
setup_kiosk_service() {
  log "Creating kiosk systemd service..."
  cat > /etc/systemd/system/disposcan-kiosk.service << SVC
[Unit]
Description=DispoScan Kiosk (Chromium full-screen)
Documentation=https://github.com/your-org/disposcan
After=graphical.target disposcan-backend.service
Requires=disposcan-backend.service

[Service]
Type=simple
User=$PI_USER
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/$PI_USER/.Xauthority
ExecStartPre=/bin/bash -c 'while ! curl -s http://localhost:$BACKEND_PORT/api/v1/health >/dev/null 2>&1; do sleep 1; done'
ExecStart=/bin/bash -c '
  xset s off 2>/dev/null || true
  xset -dpms 2>/dev/null || true
  xset s noblank 2>/dev/null || true
  unclutter -idle 0.1 -root &
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
    "$KIOSK_URL"
'
Restart=always
RestartSec=5

[Install]
WantedBy=graphical.target
SVC
}

# ──────────────────────────────────────────────────────────────────────
# 8. Create data directories and configure
# ──────────────────────────────────────────────────────────────────────
setup_data_dirs() {
  log "Creating data directories..."
  mkdir -p "$REPO_DIR/data/reports"
  mkdir -p "$REPO_DIR/data/attachments"
  mkdir -p "$REPO_DIR/data/backups"
  chown -R "$PI_USER:$PI_USER" "$REPO_DIR/data"
}

# ──────────────────────────────────────────────────────────────────────
# 9. Enable services, configure auto-login
# ──────────────────────────────────────────────────────────────────────
enable_services() {
  log "Enabling services..."
  systemctl daemon-reload
  systemctl enable disposcan-backend.service
  systemctl enable disposcan-kiosk.service

  log "Configuring auto-login..."
  raspi-config nonint do_boot_behaviour B2 || true

  # Disable screen blanking at boot level
  local config_file="/boot/firmware/config.txt"
  if [ ! -f "$config_file" ]; then
    config_file="/boot/config.txt"
  fi
  for opt in disable_splash=1 boot_delay=0; do
    if ! grep -q "$opt" "$config_file" 2>/dev/null; then
      echo "$opt" >> "$config_file"
    fi
  done

  # Reduce swap for SD card longevity
  if grep -q "CONF_SWAPSIZE=100" /etc/dphys-swapfile 2>/dev/null; then
    sed -i 's/CONF_SWAPSIZE=100/CONF_SWAPSIZE=512/' /etc/dphys-swapfile
    systemctl restart dphys-swapfile || true
  fi
}

# ──────────────────────────────────────────────────────────────────────
# 10. Verify installation
# ──────────────────────────────────────────────────────────────────────
verify_installation() {
  log "Verifying installation..."
  local errors=0

  echo ""
  echo "  ┌─────────────────────────────────────────────┐"
  echo "  │       DispoScan Deployment Verification      │"
  echo "  └─────────────────────────────────────────────┘"
  echo ""

  # Check services exist
  for svc in disposcan-backend.service disposcan-kiosk.service; do
    if systemctl list-unit-files "$svc" | grep -q enabled; then
      echo "  ✓ $svc — enabled"
    else
      echo "  ✗ $svc — NOT enabled"
      errors=$((errors + 1))
    fi
  done

  # Check backend binary
  if [ -f "$REPO_DIR/apps/backend/dist/index.js" ]; then
    echo "  ✓ Backend build — present"
  else
    echo "  ✗ Backend build — MISSING"
    errors=$((errors + 1))
  fi

  # Check pnpm
  if command -v pnpm &>/dev/null; then
    echo "  ✓ pnpm — $(pnpm --version)"
  else
    echo "  ✗ pnpm — not found"
    errors=$((errors + 1))
  fi

  # Check data directories
  for d in reports attachments backups; do
    if [ -d "$REPO_DIR/data/$d" ]; then
      echo "  ✓ data/$d — present"
    else
      echo "  ✗ data/$d — MISSING"
      errors=$((errors + 1))
    fi
  done

  # Check mDNS
  if systemctl is-active avahi-daemon &>/dev/null; then
    echo "  ✓ avahi-daemon — running"
  else
    echo "  ✗ avahi-daemon — not running"
    errors=$((errors + 1))
  fi

  # Check auto-login
  if systemctl get-default | grep -q graphical; then
    echo "  ✓ graphical.target — default"
  else
    echo "  ✗ graphical.target — NOT default"
    errors=$((errors + 1))
  fi

  echo ""
  if [ $errors -eq 0 ]; then
    echo -e "${GREEN}  ✓ All checks passed.${NC}"
  else
    echo -e "${YELLOW}  ⚠ $errors check(s) failed. Review output above.${NC}"
  fi
  echo ""
}

# ──────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo "╔══════════════════════════════════════════════╗"
  echo "║      DispoScan Raspberry Pi Deployment       ║"
  echo "║         v3.0 — Production Install             ║"
  echo "╚══════════════════════════════════════════════╝"
  echo ""

  require_root

  install_system_packages
  install_node
  setup_repo
  build_project
  setup_mdns
  setup_data_dirs
  setup_backend_service
  setup_kiosk_service
  enable_services
  verify_installation

  log "Starting backend service..."
  systemctl start disposcan-backend.service || warn "Backend service failed to start. Check 'journalctl -u disposcan-backend'."

  echo ""
  echo "╔══════════════════════════════════════════════╗"
  echo "║        Deployment Complete!                   ║"
  echo "║                                               ║"
  echo "║  The Pi will boot into kiosk mode on next     ║"
  echo "║  reboot. To start now, run:                   ║"
  echo "║    systemctl start disposcan-kiosk.service    ║"
  echo "║                                               ║"
  echo "║  Access the backend API at:                   ║"
  echo "║    http://$(hostname -I | awk '{print $1}'):$BACKEND_PORT/api/v1/health"
  echo "║                                               ║"
  echo "║  mDNS: disposcan.local                        ║"
  echo "╚══════════════════════════════════════════════╝"
  echo ""
}

main "$@"
