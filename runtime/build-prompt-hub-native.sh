#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/prompt-hub/releases/initial
cd "$APP_DIR"

export NODE_OPTIONS=--max-old-space-size=1024
set -a
source /opt/prompt-hub/shared/.env.production
set +a

npm ci
npm run build

ln -sfn "$APP_DIR" /opt/prompt-hub/current
echo "PROMPT_HUB_BUILD_COMPLETE"
