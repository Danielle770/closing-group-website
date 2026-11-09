#!/usr/bin/env bash
# The Closing Group — one-command server setup / update.
# Run as root from the website folder:
#   cd /var/www/closinggroupisrael.com && git pull && sudo bash server/setup.sh
# Safe to run again after every update: it never overwrites your settings or member data.
set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="/opt/closinggroup"
CONF_DIR="/etc/closinggroup"
DATA_DIR="/var/lib/closinggroup"
ENV_FILE="$CONF_DIR/closinggroup.env"
SERVICE="closinggroup"

echo "==> The Closing Group API setup (site: $SITE_DIR)"

if ! command -v node >/dev/null 2>&1; then
  echo "!! Node.js is not installed. Install Node 20 LTS (e.g. 'apt install nodejs npm' or NodeSource) and run this again."; exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then echo "!! Node $NODE_MAJOR found; version 18 or newer is needed."; exit 1; fi
command -v make >/dev/null 2>&1 || echo "   (note: if npm install fails, run 'apt install build-essential python3' and try again)"

# Service user with no login
id -u closinggroup >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin closinggroup

# App code lives OUTSIDE the public website folder
mkdir -p "$APP_DIR" "$CONF_DIR" "$DATA_DIR"
cp "$SITE_DIR/server/server.js" "$SITE_DIR/server/package.json" "$APP_DIR/"
( cd "$APP_DIR" && npm install --omit=dev --no-audit --no-fund )

# Settings file (created once, never overwritten)
if [ ! -f "$ENV_FILE" ]; then
  cp "$SITE_DIR/server/.env.example" "$ENV_FILE"
  ADMIN_PW="$(head -c 18 /dev/urandom | base64 | tr -d '/+=')"
  sed -i "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$ADMIN_PW/" "$ENV_FILE"
  echo "==> Created $ENV_FILE  (fill in SMTP_* and TWILIO_* there)"
  echo "    Member list password (username: admin): $ADMIN_PW"
fi
chown -R closinggroup:closinggroup "$DATA_DIR"
chown root:closinggroup "$ENV_FILE"; chmod 640 "$ENV_FILE"

# systemd service
cat > /etc/systemd/system/$SERVICE.service <<UNIT
[Unit]
Description=The Closing Group sign-up API
After=network.target

[Service]
Type=simple
User=closinggroup
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=$(command -v node) $APP_DIR/server.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$DATA_DIR
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1 || true
systemctl restart "$SERVICE"
sleep 2
if curl -fsS http://127.0.0.1:3100/api/health >/dev/null; then
  echo "==> API is running: $(curl -fsS http://127.0.0.1:3100/api/health)"
else
  echo "!! API did not start. Check: journalctl -u $SERVICE -n 50"; exit 1
fi

if ! grep -rqs "proxy_pass http://127.0.0.1:3100" /etc/nginx/; then
  echo
  echo "==> One-time step: add the blocks from server/nginx-closinggroup.conf to the closinggroupisrael.com"
  echo "    server block in Nginx, then run: nginx -t && systemctl reload nginx"
fi
echo "==> Done."
