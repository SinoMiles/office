#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/officegpt/releases/initial
cd "$APP_DIR"

ENV_FILE=/opt/officegpt/shared/.env.production bash runtime/verify-officegpt-secrets.sh

export NODE_OPTIONS=--max-old-space-size=1024
export AIONCORE_VERSION=v0.1.52

npm ci
npm run prepare:aioncore
npm run build

mkdir -p storage uploads
ln -sfn "$APP_DIR" /opt/officegpt/current

install -d -o officegpt -g officegpt /opt/officegpt/shared/officecli-runtime
chmod +x runtime/update-officecli.sh
runtime/update-officecli.sh --force

# Remove the legacy system-level scheduler. Update checks now run inside the app.
systemctl disable --now officegpt-officecli-update.timer 2>/dev/null || true
rm -f /etc/systemd/system/officegpt-officecli-update.timer /etc/systemd/system/officegpt-officecli-update.service
systemctl daemon-reload

echo "OFFICEGPT_BUILD_COMPLETE"
