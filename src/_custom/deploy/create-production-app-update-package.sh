#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

DEFAULT_TAG="v2.2.8-cotti-$(date +%Y%m%d)-$(git rev-parse --short=10 HEAD)"
TARGET_IMAGE="${TARGET_IMAGE:-sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com/lobechat/lobehub:$DEFAULT_TAG}"
TARGET_DIGEST="${TARGET_DIGEST:-}"
PACKAGE_NAME="${PACKAGE_NAME:-lobechat-prod-app-update-$(date +%Y%m%d-%H%M%S)}"
OUT_ROOT="${OUT_ROOT:-src/_custom/deploy/dist}"
OUT_DIR="$OUT_ROOT/$PACKAGE_NAME"
TARBALL="$OUT_ROOT/$PACKAGE_NAME.tar.gz"
COMPOSE_SOURCE="${COMPOSE_SOURCE:-}"

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file" >&2
    exit 1
  fi
}

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing to package a dirty worktree. Commit or remove all local changes first." >&2
  exit 1
fi

if [[ ! "$TARGET_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  echo "TARGET_DIGEST must be the pushed image's immutable sha256 digest." >&2
  exit 1
fi

if [[ -z "$COMPOSE_SOURCE" ]]; then
  if [[ -f docker-compose.prod.yml ]]; then
    COMPOSE_SOURCE="docker-compose.prod.yml"
  else
    COMPOSE_SOURCE="src/_custom/deploy/docker-compose.prod.yml"
  fi
fi

require_file "$COMPOSE_SOURCE"
require_file src/_custom/deploy/prod-00-configure-warp-exclusions.sh
require_file src/_custom/deploy/prod-01-check-runtime.sh
require_file src/_custom/deploy/prod-02-confirm-and-update-app.sh
require_file src/_custom/deploy/prod-03-verify-app-update.sh

rm -rf "$OUT_DIR" "$TARBALL"
mkdir -p "$OUT_DIR"

cp "$COMPOSE_SOURCE" "$OUT_DIR/docker-compose.prod.yml"
cp src/_custom/deploy/prod-00-configure-warp-exclusions.sh "$OUT_DIR/00-configure-warp-exclusions.sh"
cp src/_custom/deploy/prod-01-check-runtime.sh "$OUT_DIR/01-check-runtime.sh"
cp src/_custom/deploy/prod-02-confirm-and-update-app.sh "$OUT_DIR/02-confirm-and-update-app.sh"
cp src/_custom/deploy/prod-03-verify-app-update.sh "$OUT_DIR/03-verify-app-update.sh"
chmod +x "$OUT_DIR/"*.sh

cat > "$OUT_DIR/release.env" <<EOF
TARGET_IMAGE=$TARGET_IMAGE
TARGET_DIGEST=$TARGET_DIGEST
LOBECHAT_IMAGE=$TARGET_IMAGE
LOBECHAT_IMAGE_DIGEST=$TARGET_DIGEST
RELEASE_TOOLING_COMMIT=$(git rev-parse HEAD)
EOF

cat > "$OUT_DIR/README.txt" <<EOF
LobeChat production app update package

This package intentionally contains no source code and no secrets.

Target image:
$TARGET_IMAGE

Expected pushed digest:
${TARGET_DIGEST:-not provided}

Expected production directory:
/opt/lobechat-main

Files:
- docker-compose.prod.yml
- 00-configure-warp-exclusions.sh
- 01-check-runtime.sh
- 02-confirm-and-update-app.sh
- 03-verify-app-update.sh
- release.env

Run on the production server:

  cd /opt/lobechat-main
  tar -xzf /tmp/$PACKAGE_NAME.tar.gz -C /opt/lobechat-main
  bash 00-configure-warp-exclusions.sh
  bash 01-check-runtime.sh
  bash 02-confirm-and-update-app.sh
  bash 03-verify-app-update.sh

Notes:
- The scripts automatically read release.env when it exists in the deployment directory.
- The existing /opt/lobechat-main/.env stays on the production server.
- 00-configure-warp-exclusions.sh bypasses WARP for the ACR host, its resolved IPv4 addresses, and SSH endpoints 8.222.230.244 and 47.236.135.3 without disabling WARP.
- The target image is pulled and its immutable registry digest is verified before any database or .env changes.
- 02-confirm-and-update-app.sh creates and validates a PostgreSQL dump, then backs up .env before changing LOBECHAT_IMAGE and model exposure env values.
- The app image is pulled directly and digest-verified; Compose reuses authenticated QStash credentials and restarts only app with --no-deps and --pull never.
- PostgreSQL and SearXNG images are not changed.
- Precheck and verification require app, PostgreSQL, QStash, and SearXNG to exist and be running; app and PostgreSQL must also be healthy.
- App startup runs Drizzle migrations automatically when DATABASE_DRIVER is set.
- No manual DML script is required for this release.
EOF

tar -C "$OUT_DIR" -czf "$TARBALL" .

echo "Package directory: $OUT_DIR"
echo "Package tarball: $TARBALL"
echo "Target image: $TARGET_IMAGE"
echo "Digest: $TARGET_DIGEST"
