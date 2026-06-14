#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

TARGET_IMAGE="${TARGET_IMAGE:-sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com/lobechat/lobehub:v2.2.1-cotti-image-video-audit-ui-env-models-v2-20260614}"
TARGET_DIGEST="${TARGET_DIGEST:-sha256:01a1ade52b127fa116a3acd67710c3444efacb46e1e39e158daf49f26bf38f0d}"
PACKAGE_NAME="${PACKAGE_NAME:-lobechat-prod-app-update-20260614-ui-env-models-v2}"
OUT_ROOT="${OUT_ROOT:-src/_custom/deploy/dist}"
OUT_DIR="$OUT_ROOT/$PACKAGE_NAME"
TARBALL="$OUT_ROOT/$PACKAGE_NAME.tar.gz"

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file" >&2
    exit 1
  fi
}

require_file docker-compose.prod.yml
require_file src/_custom/deploy/prod-01-check-runtime.sh
require_file src/_custom/deploy/prod-02-confirm-and-update-app.sh
require_file src/_custom/deploy/prod-03-verify-app-update.sh

rm -rf "$OUT_DIR" "$TARBALL"
mkdir -p "$OUT_DIR"

cp docker-compose.prod.yml "$OUT_DIR/docker-compose.prod.yml"
cp src/_custom/deploy/prod-01-check-runtime.sh "$OUT_DIR/01-check-runtime.sh"
cp src/_custom/deploy/prod-02-confirm-and-update-app.sh "$OUT_DIR/02-confirm-and-update-app.sh"
cp src/_custom/deploy/prod-03-verify-app-update.sh "$OUT_DIR/03-verify-app-update.sh"
chmod +x "$OUT_DIR/"*.sh

cat > "$OUT_DIR/release.env" <<EOF
LOBECHAT_IMAGE=$TARGET_IMAGE
LOBECHAT_IMAGE_DIGEST=$TARGET_DIGEST
EOF

cat > "$OUT_DIR/README.txt" <<EOF
LobeChat production app update package

This package intentionally contains no source code and no secrets.

Target image:
$TARGET_IMAGE

Expected pushed digest:
$TARGET_DIGEST

Expected production directory:
/opt/lobechat-main

Files:
- docker-compose.prod.yml
- 01-check-runtime.sh
- 02-confirm-and-update-app.sh
- 03-verify-app-update.sh
- release.env

Run on the production server:

  cd /opt/lobechat-main
  tar -xzf /tmp/$PACKAGE_NAME.tar.gz -C /opt/lobechat-main
  bash 01-check-runtime.sh
  bash 02-confirm-and-update-app.sh
  bash 03-verify-app-update.sh

Notes:
- The existing /opt/lobechat-main/.env stays on the production server.
- 02-confirm-and-update-app.sh backs up .env before changing LOBECHAT_IMAGE and model exposure env values.
- Only the compose app service image is pulled and restarted.
- PostgreSQL and SearXNG images are not changed.
- App startup runs Drizzle migrations automatically when DATABASE_DRIVER is set.
- No manual DML script is required for this release.
EOF

tar -C "$OUT_DIR" -czf "$TARBALL" .

echo "Package directory: $OUT_DIR"
echo "Package tarball: $TARBALL"
echo "Target image: $TARGET_IMAGE"
echo "Digest: $TARGET_DIGEST"
