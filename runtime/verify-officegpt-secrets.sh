#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=${ENV_FILE:-/opt/officegpt/shared/.env.production}

if [[ ! -r "$ENV_FILE" ]]; then
  echo "Missing readable OfficeGPT environment file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required_values=(
  JWT_SECRET
  WECHAT_PAY_APP_ID
  WECHAT_PAY_MCH_ID
  WECHAT_PAY_CERT_SERIAL_NO
  WECHAT_PAY_API_V3_KEY
  WECHAT_PAY_PLATFORM_SERIAL_NO
  WECHAT_PAY_NOTIFY_URL
)

for name in "${required_values[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required production setting: $name" >&2
    exit 1
  fi
done

if [[ ${#WECHAT_PAY_API_V3_KEY} -ne 32 ]]; then
  echo "WECHAT_PAY_API_V3_KEY must contain exactly 32 characters" >&2
  exit 1
fi

required_files=(
  "${WECHAT_PAY_PRIVATE_KEY_FILE:-}"
  "${WECHAT_PAY_PLATFORM_PUBLIC_KEY_FILE:-}"
)

for file in "${required_files[@]}"; do
  if [[ -z "$file" || ! -r "$file" ]]; then
    echo "Missing readable WeChat Pay key/certificate file: ${file:-<unset>}" >&2
    exit 1
  fi
done

private_key_public_hash=$(
  openssl pkey -in "$WECHAT_PAY_PRIVATE_KEY_FILE" -pubout -outform DER 2>/dev/null |
    sha256sum | cut -d' ' -f1
)
merchant_certificate_public_hash=$(
  openssl x509 -in /opt/officegpt/shared/wechat-pay/apiclient_cert.pem -pubkey -noout 2>/dev/null |
    openssl pkey -pubin -outform DER 2>/dev/null |
    sha256sum | cut -d' ' -f1
)

if [[ "$private_key_public_hash" != "$merchant_certificate_public_hash" ]]; then
  echo "WeChat Pay merchant certificate and private key do not match" >&2
  exit 1
fi

platform_serial=$(
  openssl x509 -in "$WECHAT_PAY_PLATFORM_PUBLIC_KEY_FILE" -noout -serial |
    cut -d= -f2
)

if [[ "$platform_serial" != "$WECHAT_PAY_PLATFORM_SERIAL_NO" ]]; then
  echo "Configured WeChat Pay platform certificate serial does not match its file" >&2
  exit 1
fi

echo "OfficeGPT production secrets verified"
