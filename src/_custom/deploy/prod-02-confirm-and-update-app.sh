#!/usr/bin/env bash
set -euo pipefail

TARGET_IMAGE="${TARGET_IMAGE:-sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com/lobechat/lobehub:v2.2.1-cotti-image-video-audit-20260614-613876cc}"
TARGET_DIGEST="${TARGET_DIGEST:-sha256:0144d6ca270f5397f09103506d4f48e43d32ca52d808f4c8e8088dc585b2af47}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/lobechat-main}"
APP_CONTAINER="${APP_CONTAINER:-lobechat-app}"

cd "$DEPLOY_DIR"

read_env() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { print substr($0, index($0, "=") + 1); exit }' .env
}

set_env() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp="${file}.tmp"

  awk -v key="$key" -v value="$value" '
    BEGIN { done = 0 }
    $0 ~ "^[[:space:]]*" key "=" {
      print key "=" value
      done = 1
      next
    }
    { print }
    END {
      if (!done) print key "=" value
    }
  ' "$file" > "$tmp"

  mv "$tmp" "$file"
}

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $DEPLOY_DIR/$file" >&2
    exit 1
  fi
}

require_file .env
require_file docker-compose.prod.yml

CURRENT_ENV_IMAGE="$(read_env LOBECHAT_IMAGE)"
CURRENT_CONTAINER_IMAGE="$(
  docker inspect "$APP_CONTAINER" --format '{{.Config.Image}}' 2>/dev/null || true
)"

echo "== Production app update confirmation =="
echo "Deploy directory: $DEPLOY_DIR"
echo "Compose file: docker-compose.prod.yml"
echo "Service: app"
echo "Container: $APP_CONTAINER"
echo "Current .env LOBECHAT_IMAGE: ${CURRENT_ENV_IMAGE:-'(empty)'}"
echo "Current running container image: ${CURRENT_CONTAINER_IMAGE:-'(container not found)'}"
echo "Target image: $TARGET_IMAGE"
echo "Expected pushed digest: $TARGET_DIGEST"

echo
echo "== Actual runtime checks =="
docker compose -f docker-compose.prod.yml --env-file .env config >/tmp/lobechat-compose-prod.rendered.yml
docker compose -f docker-compose.prod.yml --env-file .env ps
docker manifest inspect "$TARGET_IMAGE" >/tmp/lobechat-target-manifest.json
echo "Compose render OK and target image manifest is readable."

echo
echo "== Database impact =="
echo "This script updates only the compose app service image."
echo "PostgreSQL and SearXNG images are not changed."
echo "The app container startup runs Drizzle migrations automatically when DATABASE_DRIVER is set."
echo "No manual DML script is required for this release."

echo
echo "== Planned actions =="
echo "1. Backup .env into backups/"
echo "2. Set LOBECHAT_IMAGE to the target image"
echo "3. docker compose pull app"
echo "4. docker compose up -d app"
echo "5. Show app status and recent logs"

if [[ "${AUTO_APPROVE:-0}" != "1" ]]; then
  echo
  read -r -p "Type DEPLOY to continue: " answer
  if [[ "$answer" != "DEPLOY" ]]; then
    echo "Aborted. No changes were made."
    exit 1
  fi
fi

mkdir -p backups
BACKUP_FILE="backups/.env.$(date +%Y%m%d%H%M%S)"
cp .env "$BACKUP_FILE"
echo "Backed up .env to $BACKUP_FILE"

set_env .env LOBECHAT_IMAGE "$TARGET_IMAGE"

echo
echo "Pulling app image..."
docker compose -f docker-compose.prod.yml --env-file .env pull app

echo
echo "Restarting app service..."
docker compose -f docker-compose.prod.yml --env-file .env up -d app

echo
echo "Current compose status:"
docker compose -f docker-compose.prod.yml --env-file .env ps

echo
echo "Recent app logs:"
docker logs --tail 120 "$APP_CONTAINER" || true

echo
echo "Update command finished. Run prod-03-verify-app-update.sh for acceptance checks."
