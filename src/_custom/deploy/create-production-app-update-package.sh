#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

APP_SOURCE_COMMIT="${APP_SOURCE_COMMIT:-$(git rev-parse HEAD)}"
git cat-file -e "${APP_SOURCE_COMMIT}^{commit}" 2>/dev/null || {
  echo "Unknown APP_SOURCE_COMMIT: $APP_SOURCE_COMMIT" >&2
  exit 1
}
APP_SOURCE_COMMIT="$(git rev-parse "${APP_SOURCE_COMMIT}^{commit}")"
APP_SOURCE_SHORT="$(git rev-parse --short=10 "$APP_SOURCE_COMMIT")"
DEFAULT_TAG="v2.2.13-cotti-prod-$(date +%Y%m%d)-${APP_SOURCE_SHORT}"
TARGET_IMAGE="${TARGET_IMAGE:-sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com/lobechat/lobehub:$DEFAULT_TAG}"
TARGET_DIGEST="${TARGET_DIGEST:-}"
PACKAGE_NAME="${PACKAGE_NAME:-lobechat-prod-v2213-$(date +%Y%m%d)-${APP_SOURCE_SHORT}}"
OUT_ROOT="${OUT_ROOT:-src/_custom/deploy/dist}"
OUT_DIR="$OUT_ROOT/$PACKAGE_NAME"
TARBALL="$OUT_ROOT/$PACKAGE_NAME.tar.gz"
ENV_FILE="${ENV_FILE:-.env}"

[[ -z "$(git status --porcelain)" ]] || {
  echo "Refusing to package a dirty worktree." >&2
  exit 1
}
[[ "$TARGET_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || {
  echo "TARGET_DIGEST must be the pushed image's immutable sha256 digest." >&2
  exit 1
}
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

IMAGE_REVISION="$(docker image inspect "$TARGET_IMAGE" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' 2>/dev/null || true)"
[[ "$IMAGE_REVISION" == "$APP_SOURCE_COMMIT" ]] || {
  echo "Local target image revision does not match APP_SOURCE_COMMIT." >&2
  echo "Expected: $APP_SOURCE_COMMIT" >&2
  echo "Image label: ${IMAGE_REVISION:-missing}" >&2
  exit 1
}
LOCAL_REPO_DIGESTS="$(docker image inspect "$TARGET_IMAGE" --format '{{range .RepoDigests}}{{println .}}{{end}}')"
grep -Fq "@${TARGET_DIGEST}" <<<"$LOCAL_REPO_DIGESTS" || {
  echo "Local target image does not carry the pushed TARGET_DIGEST." >&2
  printf '%s\n' "${LOCAL_REPO_DIGESTS:-'(none)'}" >&2
  exit 1
}

FILES=(
  docker-compose.prod.yml
  release-lib.sh
  prod-00-configure-warp-exclusions.sh
  prod-01-check-runtime.sh
  prod-02-backup-and-migrate.sh
  prod-03-switch-app.sh
  prod-04-verify-app-update.sh
  prod-05-rollback-app.sh
)
for file in "${FILES[@]}"; do
  [[ -f "src/_custom/deploy/$file" ]] || { echo "Missing release file: $file" >&2; exit 1; }
done

rm -rf "$OUT_DIR" "$TARBALL" "$TARBALL.sha256"
mkdir -p "$OUT_DIR"
for file in "${FILES[@]}"; do
  cp "src/_custom/deploy/$file" "$OUT_DIR/$file"
done
chmod 755 "$OUT_DIR"/*.sh

cat > "$OUT_DIR/release.env" <<EOF
TARGET_IMAGE=$TARGET_IMAGE
TARGET_DIGEST=$TARGET_DIGEST
LOBECHAT_IMAGE=$TARGET_IMAGE
LOBECHAT_IMAGE_DIGEST=$TARGET_DIGEST
RELEASE_TOOLING_COMMIT=$(git rev-parse HEAD)
APP_SOURCE_COMMIT=$APP_SOURCE_COMMIT
EXPECTED_PRE_MIGRATION=1784687043746
EXPECTED_RECONCILIATION_MIGRATION=1785724387923
EXPECTED_FINAL_MIGRATION=1786088099399
EOF

# Only non-secret product/runtime settings are staged. Production credentials
# remain in /opt/lobechat-main/.env and are checked, never copied from dev.
awk -F= '
  /^NEXT_PUBLIC_[A-Z0-9_]+=/ ||
  /^AI_IMAGE_DEFAULT_IMAGE_NUM=/ ||
  /^COTTI_AGENT_ACCESS_MODE=/ ||
  /^COTTI_AUDIT_RISK_MODEL(_PROVIDER)?=/ ||
  /^COMPOSIO_AUTH_CONFIG_IDS=/ ||
  /^AUTH_SSO_PROVIDERS=/ ||
  /^ENABLED_[A-Z0-9_]+=/ ||
  /^[A-Z0-9_]+_MODEL_LIST=/ ||
  /^DEFAULT_AGENT_CONFIG=/ ||
  /^SYSTEM_AGENT=/ {
    print
  }
' "$ENV_FILE" > "$OUT_DIR/release-config.env"

cat > "$OUT_DIR/README.txt" <<EOF
LobeHub v2.2.13 COTTI production release package

Target image: $TARGET_IMAGE
Target digest: $TARGET_DIGEST
App source commit: $APP_SOURCE_COMMIT
Release tooling commit: $(git rev-parse HEAD)

This package contains no database dump and no production secret.

Extract into an isolated release directory so the current Compose file and
runtime scripts are not overwritten before backup:

  cd /tmp
  sha256sum -c $PACKAGE_NAME.tar.gz.sha256
  mkdir -p /opt/lobechat-main/releases/$PACKAGE_NAME
  tar -xzf /tmp/$PACKAGE_NAME.tar.gz -C /opt/lobechat-main/releases/$PACKAGE_NAME
  cd /opt/lobechat-main/releases/$PACKAGE_NAME

Run on production in this exact order:

  bash prod-00-configure-warp-exclusions.sh
  bash prod-01-check-runtime.sh
  bash prod-02-backup-and-migrate.sh
  bash prod-03-switch-app.sh
  bash prod-04-verify-app-update.sh

Rollback only the app and runtime env:

  bash prod-05-rollback-app.sh

Data safety:
- PostgreSQL, QStash, and SearXNG are never recreated by these scripts.
- Migration is blocked until a custom-format dump is created and fully restored
  into a temporary validation database.
- Historical row fingerprints are checked before app switch and during final verification.
- Database restore is intentionally not automated because it would overwrite new
  writes made after deployment. Use the validated dump only after an explicit incident decision.
EOF

tar -C "$OUT_DIR" -czf "$TARBALL" .
(
  cd "$OUT_ROOT"
  sha256sum "$PACKAGE_NAME.tar.gz" > "$PACKAGE_NAME.tar.gz.sha256"
)

echo "Package: $TARBALL"
echo "Checksum: $TARBALL.sha256"
echo "Target: $TARGET_IMAGE@$TARGET_DIGEST"
