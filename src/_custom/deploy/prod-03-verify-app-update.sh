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

fail() {
  echo "VERIFY FAILED: $*" >&2
  exit 1
}

echo "== 1. Compose status =="
docker compose -f docker-compose.prod.yml --env-file .env ps

echo
echo "== 2. Image check =="
ENV_IMAGE="$(read_env LOBECHAT_IMAGE)"
CONTAINER_IMAGE="$(docker inspect "$APP_CONTAINER" --format '{{.Config.Image}}')"
echo "Expected image: $TARGET_IMAGE"
echo ".env image: $ENV_IMAGE"
echo "Container image: $CONTAINER_IMAGE"
[[ "$ENV_IMAGE" == "$TARGET_IMAGE" ]] || fail ".env LOBECHAT_IMAGE does not match target"
[[ "$CONTAINER_IMAGE" == "$TARGET_IMAGE" ]] || fail "running app container image does not match target"

echo
echo "== 3. Runtime env check =="
docker exec "$APP_CONTAINER" /bin/node -e "
const keys = [
  'NEXT_PUBLIC_NAV_HIDE_IMAGE',
  'NEXT_PUBLIC_NAV_HIDE_VIDEO',
  'NEXT_PUBLIC_HOME_STARTER_HIDE_IMAGE',
  'NEXT_PUBLIC_HOME_STARTER_HIDE_VIDEO',
  'NEXT_PUBLIC_COTTI_HOME_HIDDEN_STARTER_MODELS',
  'NEXT_PUBLIC_COTTI_HOME_HIDDEN_BLOCKS',
  'NEXT_PUBLIC_MODEL_VISIBLE_ALLOW',
  'NEXT_PUBLIC_MODEL_DISPLAY_NAMES',
  'NEXT_PUBLIC_COTTI_MODEL_BUILTIN_SEARCH_ALLOW',
  'ENABLED_OPENAI',
  'OPENAI_PROXY_URL',
  'OPENAI_MODEL_LIST',
  'ENABLED_VERTEXAI',
  'VERTEXAI_MODEL_LIST',
  'ENABLED_AZURE_OPENAI',
  'AZURE_MODEL_LIST',
  'ENABLED_VOLCENGINE',
  'VOLCENGINE_MODEL_LIST',
  'ENABLED_QWEN',
  'QWEN_MODEL_LIST',
  'COTTI_AUDIT_RISK_MODEL_PROVIDER',
  'COTTI_AUDIT_RISK_MODEL',
];
for (const key of keys) console.log(key + '=' + (process.env[key] ?? ''));
"

echo
echo "== 4. Provider credential presence =="
docker exec "$APP_CONTAINER" /bin/node -e "
const required = ['OPENAI_API_KEY', 'OPENAI_PROXY_URL', 'AZURE_API_KEY', 'VERTEXAI_CREDENTIALS', 'VOLCENGINE_API_KEY', 'QWEN_API_KEY'];
const missing = [];
for (const key of required) {
  const present = Boolean(process.env[key]);
  console.log(key + '=' + (present ? 'set' : 'missing'));
  if (!present) missing.push(key);
}
if (missing.length > 0) {
  console.error('Missing provider credentials: ' + missing.join(', '));
  process.exit(2);
}
"

echo
echo "== 5. App health =="
PORT="$(read_env LOBECHAT_PORT)"
PORT="${PORT:-3210}"
curl -fsSI --max-time 20 "http://127.0.0.1:${PORT}/" | sed -n '1,12p'

echo
echo "== 6. Migration and startup logs =="
docker logs --tail 200 "$APP_CONTAINER" | grep -E 'Start to migration|database migration pass|Ready|Gateway|migrate failed|ERROR|Error' || true
docker logs --tail 200 "$APP_CONTAINER" | grep -q 'database migration pass' \
  || fail "database migration success log not found in recent app logs"
docker logs --tail 200 "$APP_CONTAINER" | grep -q 'Ready' \
  || fail "Next.js Ready log not found in recent app logs"

echo
echo "== 7. Database tables used by this release =="
POSTGRES_USER="$(read_env_default POSTGRES_USER paradedb)"
POSTGRES_DB="$(read_env_default POSTGRES_DB lobehub)"
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgresql \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('cotti_audit_view_logs', 'cotti_audit_risk_analyses')
order by table_name;
" | tee /tmp/lobechat-audit-tables.txt

grep -q '^cotti_audit_risk_analyses$' /tmp/lobechat-audit-tables.txt \
  || fail "missing table cotti_audit_risk_analyses"
grep -q '^cotti_audit_view_logs$' /tmp/lobechat-audit-tables.txt \
  || fail "missing table cotti_audit_view_logs"

echo
echo "Acceptance checks passed."
