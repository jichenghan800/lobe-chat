#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/lobechat-main}"
APP_CONTAINER="${APP_CONTAINER:-lobechat-app}"

cd "$DEPLOY_DIR"

if [[ -f release.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source release.env
  set +a
fi

TARGET_IMAGE="${TARGET_IMAGE:-${LOBECHAT_IMAGE:-sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com/lobechat/lobehub:v2.2.8-cotti-20260626-b2976351ad}}"
TARGET_DIGEST="${TARGET_DIGEST:-${LOBECHAT_IMAGE_DIGEST:-}}"

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

require_env_value() {
  local key="$1"
  local label="$2"
  local value
  value="$(read_env "$key")"
  if [[ -z "$value" ]]; then
    echo "Missing required env for $label: $key" >&2
    exit 1
  fi
}

wait_for_qstash_credentials() {
  local container="$1"

  for _ in $(seq 1 60); do
    if docker logs "$container" 2>&1 | grep -q '^QSTASH_NEXT_SIGNING_KEY='; then
      return 0
    fi
    sleep 1
  done

  echo "Timed out waiting for QStash credentials in $container logs" >&2
  exit 1
}

read_qstash_log_value() {
  local container="$1"
  local key="$2"
  docker logs "$container" 2>&1 | sed -n "s/^${key}=//p" | tail -n 1
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
echo "Expected pushed digest: ${TARGET_DIGEST:-'(not provided)'}"

echo
echo "== Actual runtime checks =="
docker compose -f docker-compose.prod.yml --env-file .env config >/tmp/lobechat-compose-prod.rendered.yml
docker compose -f docker-compose.prod.yml --env-file .env ps
docker manifest inspect "$TARGET_IMAGE" >/tmp/lobechat-target-manifest.json
echo "Compose render OK and target image manifest is readable."

echo
echo "== Provider credential gate =="
require_env_value OPENAI_API_KEY "全能效率"
echo "OPENAI_API_KEY=set"
require_env_value OPENAI_PROXY_URL "全能效率"
echo "OPENAI_PROXY_URL=$(read_env OPENAI_PROXY_URL)"
require_env_value AZURE_API_KEY "GPT Image 2"
echo "AZURE_API_KEY=set"
require_env_value VERTEXAI_CREDENTIALS "COTTI-快速/COTTI-专业"
echo "VERTEXAI_CREDENTIALS=set"
require_env_value VOLCENGINE_API_KEY "豆包1.6-Flash/Seedream 5.0 Lite"
echo "VOLCENGINE_API_KEY=set"
require_env_value QWEN_API_KEY "千问3.7-Plus"
echo "QWEN_API_KEY=set"

echo
echo "== Database impact =="
echo "This script updates the compose app service image and ensures local QStash is running."
echo "PostgreSQL and SearXNG images are not changed."
echo "The app container startup runs Drizzle migrations automatically when DATABASE_DRIVER is set."
echo "No manual DML script is required for this release."

echo
echo "== Planned actions =="
echo "1. Backup .env into backups/"
echo "2. Sync image/chat model exposure env values"
echo "3. Set LOBECHAT_IMAGE to the target image"
echo "4. Start local QStash and sync QStash credentials into .env"
echo "5. docker compose pull app qstash"
echo "6. docker compose up -d app"
echo "7. Show app status and recent logs"

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

set_env .env AI_IMAGE_DEFAULT_IMAGE_NUM "1"
set_env .env NEXT_PUBLIC_NAV_HIDE_IMAGE "0"
set_env .env NEXT_PUBLIC_HOME_STARTER_HIDE_IMAGE "0"
set_env .env NEXT_PUBLIC_NAV_HIDE_VIDEO "1"
set_env .env NEXT_PUBLIC_HOME_STARTER_HIDE_VIDEO "1"
set_env .env NEXT_PUBLIC_COTTI_HOME_HIDDEN_STARTER_MODELS "deepseek-v4-pro,image,image2,video"
set_env .env NEXT_PUBLIC_COTTI_HOME_HIDDEN_BLOCKS "messengerBanner,botIntegrationBanner"
set_env .env COTTI_AGENT_ACCESS_MODE "open"

set_env .env NEXT_PUBLIC_MODEL_VISIBLE_ALLOW "vertexai/gemini-3.1-flash-lite,vertexai/gemini-3.5-flash,volcengine/doubao-seed-1.6-flash,qwen/qwen3.7-plus,azure/gpt-5.5"
set_env .env NEXT_PUBLIC_MODEL_DISPLAY_NAMES "vertexai/gemini-3.1-flash-lite=COTTI-快速,vertexai/gemini-3.5-flash=COTTI-专业,volcengine/doubao-seed-1.6-flash=豆包1.6-Flash,qwen/qwen3.7-plus=千问3.7-Plus,azure/gpt-5.5=全能效率"
set_env .env NEXT_PUBLIC_COTTI_MODEL_BUILTIN_SEARCH_ALLOW "vertexai/gemini-*,google/gemini-*,volcengine/doubao-seed-1.6-flash,qwen/qwen3.7-plus"

set_env .env ENABLED_VERTEXAI "1"
set_env .env VERTEXAI_MODEL_LIST "-all,gemini-3.1-flash-lite=COTTI-快速<1114112:reasoning:vision:fc:video:search>,gemini-3.5-flash=COTTI-专业<1114112:reasoning:vision:fc:video:search>,gemini-3.1-flash-image-preview:image=Nano Banana 2"
set_env .env ENABLED_AZURE_OPENAI "1"
set_env .env AZURE_MODEL_LIST "-all,+gpt-5.5=全能效率<1050000:reasoning:vision:fc>,+gpt-image-2=GPT Image 2"
set_env .env ENABLED_OPENAI "1"
set_env .env OPENAI_MODEL_LIST "-all"
set_env .env ENABLED_VOLCENGINE "1"
set_env .env VOLCENGINE_MODEL_LIST "-all,+doubao-seed-1.6-flash=豆包1.6-Flash,+doubao-seedream-5-0-260128=Seedream 5.0 Lite"
set_env .env ENABLED_QWEN "1"
set_env .env QWEN_MODEL_LIST "-all,+qwen3.7-plus=千问3.7-Plus<262144:reasoning:vision:fc:search>"
set_env .env COTTI_AUDIT_RISK_MODEL_PROVIDER "vertexai"
set_env .env COTTI_AUDIT_RISK_MODEL "gemini-3.1-flash-lite"
set_env .env LOBECHAT_IMAGE "$TARGET_IMAGE"
set_env .env INTERNAL_APP_URL "http://lobechat-app:3210"
set_env .env QSTASH_URL "http://qstash:8080"
set_env .env AGENT_RUNTIME_MODE "queue"

echo
echo "Starting local QStash..."
docker compose -f docker-compose.prod.yml --env-file .env up -d qstash
wait_for_qstash_credentials lobechat-qstash

QSTASH_TOKEN_VALUE="$(read_qstash_log_value lobechat-qstash QSTASH_TOKEN)"
QSTASH_CURRENT_SIGNING_KEY_VALUE="$(read_qstash_log_value lobechat-qstash QSTASH_CURRENT_SIGNING_KEY)"
QSTASH_NEXT_SIGNING_KEY_VALUE="$(read_qstash_log_value lobechat-qstash QSTASH_NEXT_SIGNING_KEY)"

if [[ -z "$QSTASH_TOKEN_VALUE" || -z "$QSTASH_CURRENT_SIGNING_KEY_VALUE" || -z "$QSTASH_NEXT_SIGNING_KEY_VALUE" ]]; then
  echo "Failed to parse QStash credentials from lobechat-qstash logs" >&2
  exit 1
fi

set_env .env QSTASH_TOKEN "$QSTASH_TOKEN_VALUE"
set_env .env QSTASH_CURRENT_SIGNING_KEY "$QSTASH_CURRENT_SIGNING_KEY_VALUE"
set_env .env QSTASH_NEXT_SIGNING_KEY "$QSTASH_NEXT_SIGNING_KEY_VALUE"
echo "QStash credentials synced into .env"

echo
echo "Pulling app and QStash images..."
docker compose -f docker-compose.prod.yml --env-file .env pull app qstash

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
echo "Recent QStash logs:"
docker logs --tail 40 lobechat-qstash || true

echo
echo "Update command finished. Run prod-03-verify-app-update.sh for acceptance checks."
