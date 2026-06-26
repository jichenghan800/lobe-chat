#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/lobechat-main}"

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

read_env_default() {
  local key="$1"
  local default_value="$2"
  local value
  value="$(read_env "$key")"
  printf '%s' "${value:-$default_value}"
}

mask_value() {
  local value="$1"
  if [[ -z "$value" ]]; then
    printf '(empty)'
  else
    printf 'set(length=%s)' "${#value}"
  fi
}

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $DEPLOY_DIR/$file" >&2
    exit 1
  fi
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing command: $command_name" >&2
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

validate_redis_url() {
  local value
  value="$(read_env REDIS_URL)"

  if [[ -z "$value" || "$value" == "CHANGE_ME" ]]; then
    echo "REDIS_URL=(not configured)"
    return
  fi

  if [[ ! "$value" =~ ^rediss?:// ]]; then
    echo "Invalid REDIS_URL: value is set but missing URL scheme. Use redis://... or rediss://..." >&2
    exit 1
  fi

  if [[ "$value" =~ ^rediss:// ]]; then
    echo "REDIS_URL=set(scheme=rediss)"
  else
    echo "REDIS_URL=set(scheme=redis)"
  fi
}

echo "== 1. Host and Docker runtime =="
hostname
date '+%Y-%m-%d %H:%M:%S %z'
df -h / /var/lib/docker 2>/dev/null || df -h
free -h || true

require_command docker
docker version --format 'Docker client={{.Client.Version}} server={{.Server.Version}}'
docker compose version

echo
echo "== 2. Required deployment files =="
require_file .env
require_file docker-compose.prod.yml
require_file searxng-settings.yml
ls -l .env docker-compose.prod.yml searxng-settings.yml

echo
echo "== 3. Sanitized env check =="
for key in \
  LOBECHAT_IMAGE LOBECHAT_BIND LOBECHAT_PORT \
  POSTGRES_USER POSTGRES_DB POSTGRES_PASSWORD DATABASE_DRIVER \
  APP_URL AUTH_TRUSTED_ORIGINS KEY_VAULTS_SECRET \
  REDIS_URL REDIS_PREFIX REDIS_DATABASE REDIS_TLS \
  OPENAI_API_KEY OPENAI_PROXY_URL AZURE_API_KEY VERTEXAI_CREDENTIALS VOLCENGINE_API_KEY QWEN_API_KEY \
  NEXT_PUBLIC_NAV_HIDE_IMAGE NEXT_PUBLIC_NAV_HIDE_VIDEO \
  NEXT_PUBLIC_COTTI_HOME_HIDDEN_STARTER_MODELS NEXT_PUBLIC_COTTI_HOME_HIDDEN_BLOCKS \
  NEXT_PUBLIC_MODEL_VISIBLE_ALLOW NEXT_PUBLIC_MODEL_DISPLAY_NAMES \
  ENABLED_OPENAI OPENAI_MODEL_LIST ENABLED_VERTEXAI VERTEXAI_MODEL_LIST ENABLED_AZURE_OPENAI AZURE_MODEL_LIST \
  ENABLED_VOLCENGINE VOLCENGINE_MODEL_LIST ENABLED_QWEN QWEN_MODEL_LIST \
  COTTI_AUDIT_RISK_MODEL_PROVIDER COTTI_AUDIT_RISK_MODEL; do
  value="$(read_env "$key")"
  case "$key" in
    POSTGRES_PASSWORD|KEY_VAULTS_SECRET|AUTH_TRUSTED_ORIGINS|REDIS_URL|OPENAI_API_KEY|AZURE_API_KEY|VERTEXAI_CREDENTIALS|VOLCENGINE_API_KEY|QWEN_API_KEY)
      printf '%s=%s\n' "$key" "$(mask_value "$value")"
      ;;
    *)
      printf '%s=%s\n' "$key" "${value:-'(empty)'}"
      ;;
  esac
done

echo
echo "== 4. Provider credential gate =="
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
echo "== 5. Redis configuration gate =="
validate_redis_url

echo
echo "== 6. SearXNG settings gate =="
if ! awk '
  $1 == "formats:" { in_formats = 1; next }
  in_formats && /^[^[:space:]-]/ { in_formats = 0 }
  in_formats && $0 ~ /^[[:space:]]*-[[:space:]]*json[[:space:]]*$/ { found = 1 }
  END { exit found ? 0 : 1 }
' searxng-settings.yml; then
  echo "SearXNG settings must enable search.formats json for LobeChat search" >&2
  exit 1
fi
echo "SearXNG JSON search format is enabled"

echo
echo "== 7. Compose render check =="
docker compose -f docker-compose.prod.yml --env-file .env config >/tmp/lobechat-compose-prod.rendered.yml
echo "Rendered compose written to /tmp/lobechat-compose-prod.rendered.yml"
docker compose -f docker-compose.prod.yml --env-file .env ps || true

echo
echo "== 8. Current containers =="
docker ps -a \
  --filter name='lobechat' \
  --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' || true

echo
echo "== 9. Registry access check =="
echo "Target image: $TARGET_IMAGE"
echo "Expected pushed digest: ${TARGET_DIGEST:-'(not provided)'}"
docker manifest inspect "$TARGET_IMAGE" >/tmp/lobechat-target-manifest.json
echo "Registry manifest is readable: /tmp/lobechat-target-manifest.json"

echo
echo "== 10. Database readiness check =="
if docker compose -f docker-compose.prod.yml --env-file .env ps postgresql >/dev/null 2>&1; then
  docker compose -f docker-compose.prod.yml --env-file .env exec -T postgresql \
    pg_isready -U "$(read_env_default POSTGRES_USER paradedb)" -d "$(read_env_default POSTGRES_DB lobehub)"
else
  echo "postgresql service is not available through this compose file"
fi

echo
echo "Precheck passed. No changes were made."
