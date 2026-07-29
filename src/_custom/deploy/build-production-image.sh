#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

TARGET_IMAGE="${TARGET_IMAGE:?Set TARGET_IMAGE to an immutable production image tag}"
ENV_FILE="${ENV_FILE:-.env}"
PLATFORM="${PLATFORM:-linux/amd64}"

read_env() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { print substr($0, index($0, "=") + 1); exit }' "$ENV_FILE"
}

require_file() {
  local file="$1"
  [[ -f "$file" ]] || {
    echo "Missing required file: $file" >&2
    exit 1
  }
}

PUBLIC_BUILD_ENV_KEYS=(
  NEXT_PUBLIC_BRAND_ASSISTANT_NAME
  NEXT_PUBLIC_BRAND_LOGO_URL
  NEXT_PUBLIC_BRAND_NAME
  NEXT_PUBLIC_COTTI_FEEDBACK_EMAIL
  NEXT_PUBLIC_COTTI_HIDE_AGENT_CHANNELS
  NEXT_PUBLIC_COTTI_HIDE_API_KEY_SETTINGS
  NEXT_PUBLIC_COTTI_HIDE_MESSENGER_SETTINGS
  NEXT_PUBLIC_COTTI_HIDE_MODEL_PROVIDER_SETTINGS
  NEXT_PUBLIC_COTTI_HIDE_SERVICE_MODEL_SETTINGS
  NEXT_PUBLIC_COTTI_HOME_HIDDEN_BLOCKS
  NEXT_PUBLIC_COTTI_HOME_HIDDEN_STARTER_MODELS
  NEXT_PUBLIC_COTTI_MODEL_BUILTIN_SEARCH_ALLOW
  NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS
  NEXT_PUBLIC_MODEL_DISPLAY_NAMES
  NEXT_PUBLIC_MODEL_VISIBLE_ALLOW
  NEXT_PUBLIC_NAV_HIDE_VIDEO
)

require_file "$ENV_FILE"

PLATFORM_ANALYTICS_FLAG="$(read_env NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS)"
[[ "$PLATFORM_ANALYTICS_FLAG" == "1" ]] || {
  echo "NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS must be 1 in $ENV_FILE" >&2
  exit 1
}

BUILD_ARGS=(--platform "$PLATFORM" --tag "$TARGET_IMAGE")

echo "== Public Docker build configuration =="
for key in "${PUBLIC_BUILD_ENV_KEYS[@]}"; do
  value="$(read_env "$key")"
  if [[ -n "$value" ]]; then
    BUILD_ARGS+=(--build-arg "${key}=${value}")
    echo "$key=set(length=${#value})"
  else
    echo "$key=empty(source default applies)"
  fi
done

docker build "${BUILD_ARGS[@]}" .

echo
echo "== Verify platform management was enabled in the SPA build =="
PLATFORM_ASSET="$(
  docker run --rm --entrypoint sh "$TARGET_IMAGE" -lc \
    'find /app/public/_spa/assets -maxdepth 1 -type f -name "platformManagement-*.js" | head -n 1'
)"
[[ -n "$PLATFORM_ASSET" ]] || {
  echo "Platform management SPA asset is missing from $TARGET_IMAGE" >&2
  exit 1
}

if docker run --rm --entrypoint sh "$TARGET_IMAGE" -lc \
  "grep -q 'NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS' '$PLATFORM_ASSET'"; then
  echo "Platform management build flag was not replaced in the SPA asset" >&2
  exit 1
fi

echo "Platform management SPA build flag is enabled."
echo "Built image: $TARGET_IMAGE"
