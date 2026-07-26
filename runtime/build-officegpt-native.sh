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

echo "OFFICEGPT_BUILD_COMPLETE"
