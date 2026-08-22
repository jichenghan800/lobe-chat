#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

TARGET_IMAGE="${TARGET_IMAGE:?Set TARGET_IMAGE to an immutable production image tag}"
ENV_FILE="${ENV_FILE:-.env}"
PLATFORM="${PLATFORM:-linux/amd64}"
SOURCE_COMMIT="${SOURCE_COMMIT:-$(git rev-parse HEAD)}"

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || {
  echo "Refusing to build a release image from a dirty worktree." >&2
  exit 1
}
git cat-file -e "${SOURCE_COMMIT}^{commit}" 2>/dev/null || {
  echo "Unknown SOURCE_COMMIT: $SOURCE_COMMIT" >&2
  exit 1
}
SOURCE_COMMIT="$(git rev-parse "${SOURCE_COMMIT}^{commit}")"

BUILD_CONTEXT="$(mktemp -d /tmp/lobehub-prod-build.XXXXXX)"
cleanup() { rm -rf "$BUILD_CONTEXT"; }
trap cleanup EXIT

echo "Creating a clean build context from app commit $SOURCE_COMMIT..."
git archive --format=tar "$SOURCE_COMMIT" | tar -xf - -C "$BUILD_CONTEXT"

# The upstream Dockerfile copies the build context before compiling the SPA.
# Provide only explicitly public build-time settings, never the development
# secrets from the repository .env file.
awk -F= '
  /^NEXT_PUBLIC_[A-Z0-9_]+=/ || /^FEATURE_FLAGS=/ {
    print
  }
' "$ENV_FILE" > "$BUILD_CONTEXT/.env"
chmod 600 "$BUILD_CONTEXT/.env"

[[ "$(awk -F= '$1 == "NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS" { value=$2 } END { print value }' "$BUILD_CONTEXT/.env")" == "1" ]] || {
  echo "NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS must be 1 for the production build." >&2
  exit 1
}

docker build \
  --label "org.opencontainers.image.revision=$SOURCE_COMMIT" \
  --label "com.cotti.release.source=production" \
  --platform "$PLATFORM" \
  --tag "$TARGET_IMAGE" \
  "$BUILD_CONTEXT"

echo "Verifying final image contents..."
docker run --rm --entrypoint /bin/sh "$TARGET_IMAGE" -lc '
  test ! -e /app/.env
  asset="$(find /app/public/_spa/assets -maxdepth 1 -type f -name "platform-analytics-*.js" | head -n 1)"
  test -n "$asset"
  ! grep -q "NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS" "$asset"
  test -f /app/docker.cjs
  test -d /app/migrations
'

IMAGE_ARCH="$(docker image inspect "$TARGET_IMAGE" --format '{{.Architecture}}')"
[[ "$IMAGE_ARCH" == "amd64" ]] || {
  echo "Expected amd64 image, got $IMAGE_ARCH" >&2
  exit 1
}

echo "Built and verified: $TARGET_IMAGE"
echo "App revision: $SOURCE_COMMIT"
