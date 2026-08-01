#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/officegpt/current
RUNTIME_DIR=/opt/officegpt/shared/officecli-runtime

mkdir -p "$RUNTIME_DIR"
chown officegpt:officegpt "$RUNTIME_DIR"

before=$(readlink -f "$RUNTIME_DIR/current" 2>/dev/null || true)
runuser -u officegpt -- env \
  OFFICECLI_RUNTIME_DIR="$RUNTIME_DIR" \
  OFFICECLI_UPDATE_MIN_AGE_HOURS="${OFFICECLI_UPDATE_MIN_AGE_HOURS:-24}" \
  OFFICECLI_KEEP_VERSIONS="${OFFICECLI_KEEP_VERSIONS:-3}" \
  npm_config_cache="$RUNTIME_DIR/npm-cache" \
  /usr/bin/node "$APP_DIR/scripts/update-officecli.mjs" "$@"
after=$(readlink -f "$RUNTIME_DIR/current" 2>/dev/null || true)

if [[ -n "$after" && "$after" != "$before" ]]; then
  echo "[officecli:update] runtime changed; restarting OfficeGPT"
  systemctl try-restart officegpt.service
fi
