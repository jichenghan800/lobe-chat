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

require_digest() {
  local digest="$1"
  if [[ ! "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    fail "TARGET_DIGEST must be an immutable sha256 digest, got: ${digest:-'(empty)'}"
  fi
}

require_digest "$TARGET_DIGEST"

echo "== 1. Compose status =="
docker compose -f docker-compose.prod.yml --env-file .env ps

echo
echo "== 2. Required service gate =="
REQUIRED_SERVICES=(app postgresql qstash searxng)
COMPOSE_SERVICES="$(
  docker compose -f docker-compose.prod.yml --env-file .env config --services
)"

for service in "${REQUIRED_SERVICES[@]}"; do
  grep -Fqx "$service" <<<"$COMPOSE_SERVICES" \
    || fail "required Compose service is missing: $service"

  container_id="$(
    docker compose -f docker-compose.prod.yml --env-file .env ps -q --all "$service"
  )"
  [[ -n "$container_id" ]] || fail "required container does not exist: $service"

  container_status="$(docker inspect "$container_id" --format '{{.State.Status}}')"
  container_health="$(docker inspect "$container_id" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}')"
  echo "$service status=$container_status health=$container_health"

  [[ "$container_status" == "running" ]] \
    || fail "required container is not running: $service"

  if [[ "$service" == "app" || "$service" == "postgresql" ]]; then
    [[ "$container_health" == "healthy" ]] \
      || fail "required container is not healthy: $service"
  fi
done

echo
echo "== 3. Image check =="
ENV_IMAGE="$(read_env LOBECHAT_IMAGE)"
ENV_DIGEST="$(read_env LOBECHAT_IMAGE_DIGEST)"
CONTAINER_IMAGE="$(docker inspect "$APP_CONTAINER" --format '{{.Config.Image}}')"
LOCAL_REPO_DIGESTS="$(
  docker image inspect "$TARGET_IMAGE" --format '{{range .RepoDigests}}{{println .}}{{end}}'
)"
echo "Expected image: $TARGET_IMAGE"
echo "Expected digest: $TARGET_DIGEST"
echo ".env image: $ENV_IMAGE"
echo ".env digest: $ENV_DIGEST"
echo "Container image: $CONTAINER_IMAGE"
echo "Local RepoDigests:"
printf '%s\n' "${LOCAL_REPO_DIGESTS:-'(none)'}"
[[ "$ENV_IMAGE" == "$TARGET_IMAGE" ]] || fail ".env LOBECHAT_IMAGE does not match target"
[[ "$ENV_DIGEST" == "$TARGET_DIGEST" ]] || fail ".env LOBECHAT_IMAGE_DIGEST does not match target"
[[ "$CONTAINER_IMAGE" == "$TARGET_IMAGE" ]] || fail "running app container image does not match target"
grep -Fq "@${TARGET_DIGEST}" <<<"$LOCAL_REPO_DIGESTS" \
  || fail "locally pulled app image does not match TARGET_DIGEST"

echo
echo "== 4. Platform management build and runtime gate =="
docker exec "$APP_CONTAINER" sh -lc '
asset="$(find /app/public/_spa/assets -maxdepth 1 -type f -name "platformManagement-*.js" | head -n 1)"
test -n "$asset"
if grep -q "NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS" "$asset"; then
  echo "Platform management build flag is unresolved in $asset" >&2
  exit 2
fi
echo "Platform management SPA build flag is compiled."
' || fail "platform management is not enabled in the SPA build"
docker exec "$APP_CONTAINER" /bin/node -e "
const showFlag = process.env.NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS;
const adminEmails = process.env.COTTI_PLATFORM_ANALYTICS_ADMIN_EMAILS;
console.log('NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS=' + (showFlag ?? ''));
console.log('COTTI_PLATFORM_ANALYTICS_ADMIN_EMAILS=' + (adminEmails ? 'set' : 'missing'));
if (showFlag !== '1' || !adminEmails) process.exit(2);
" || fail "platform management runtime configuration is incomplete"

echo
echo "== 5. Runtime env check =="
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
  'INTERNAL_APP_URL',
  'QSTASH_URL',
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
  'AGENT_RUNTIME_MODE',
  'COTTI_AGENT_ACCESS_MODE',
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
echo "== 6. Provider credential presence =="
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
echo "== 7. QStash health =="
docker compose -f docker-compose.prod.yml --env-file .env ps qstash
docker exec "$APP_CONTAINER" /bin/node -e "
const required = ['QSTASH_URL', 'QSTASH_TOKEN', 'QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY'];
const missing = [];
for (const key of required) {
  const present = Boolean(process.env[key]);
  console.log(key + '=' + (present ? 'set' : 'missing'));
  if (!present) missing.push(key);
}
console.log('AGENT_RUNTIME_MODE=' + (process.env.AGENT_RUNTIME_MODE ?? ''));
console.log('INTERNAL_APP_URL=' + (process.env.INTERNAL_APP_URL ?? ''));
if (missing.length > 0 || process.env.AGENT_RUNTIME_MODE !== 'queue') {
  console.error('QStash queue runtime is not fully configured');
  process.exit(2);
}
"
docker exec "$APP_CONTAINER" sh -lc 'wget -qS -O- --timeout=5 "$QSTASH_URL/" 2>&1 | sed -n "1,8p"' | grep -q '401 Unauthorized' \
  || fail "app container cannot reach QStash or QStash did not return expected 401"
docker exec "$APP_CONTAINER" /bin/node -e "
const url = new URL('/v2/topics', process.env.QSTASH_URL);
fetch(url, {
  headers: { authorization: 'Bearer ' + process.env.QSTASH_TOKEN },
  signal: AbortSignal.timeout(5000),
}).then((response) => {
  console.log('Authenticated QStash HTTP status=' + response.status);
  if (response.status !== 200) process.exit(2);
}).catch((error) => {
  console.error('Authenticated QStash request failed: ' + error.message);
  process.exit(2);
});
" || fail "QStash rejected the configured token"

echo
echo "== 8. App health =="
PORT="$(read_env LOBECHAT_PORT)"
PORT="${PORT:-3210}"
curl -fsSI --max-time 20 "http://127.0.0.1:${PORT}/" | sed -n '1,12p'

echo
echo "== 9. Migration and startup logs =="
docker logs --tail 200 "$APP_CONTAINER" | grep -E 'Start to migration|database migration pass|Ready|Gateway|migrate failed|ERROR|Error' || true
docker logs --tail 200 "$APP_CONTAINER" | grep -q 'database migration pass' \
  || fail "database migration success log not found in recent app logs"
docker logs --tail 200 "$APP_CONTAINER" | grep -q 'Ready' \
  || fail "Next.js Ready log not found in recent app logs"

echo
echo "== 10. Database tables used by this release =="
POSTGRES_USER="$(read_env_default POSTGRES_USER paradedb)"
POSTGRES_DB="$(read_env_default POSTGRES_DB lobehub)"
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgresql \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'cotti_audit_view_logs',
    'cotti_audit_risk_analyses',
    'cotti_home_notification_settings',
    'cotti_model_display_settings'
  )
order by table_name;
" | tee /tmp/lobechat-release-tables.txt

grep -q '^cotti_audit_risk_analyses$' /tmp/lobechat-release-tables.txt \
  || fail "missing table cotti_audit_risk_analyses"
grep -q '^cotti_audit_view_logs$' /tmp/lobechat-release-tables.txt \
  || fail "missing table cotti_audit_view_logs"
grep -q '^cotti_home_notification_settings$' /tmp/lobechat-release-tables.txt \
  || fail "missing table cotti_home_notification_settings"
grep -q '^cotti_model_display_settings$' /tmp/lobechat-release-tables.txt \
  || fail "missing table cotti_model_display_settings"

echo
echo "== 11. COTTI Gemini model migration =="
MIGRATION_CREATED_AT="1784687043746"
MIGRATION_COUNT="$(
  docker compose -f docker-compose.prod.yml --env-file .env exec -T postgresql \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "
select count(*)
from drizzle.__drizzle_migrations
where created_at = ${MIGRATION_CREATED_AT};
"
)"
[[ "$MIGRATION_COUNT" == "1" ]] \
  || fail "migration 0118_cotti_gemini_model_upgrade is not recorded"

OLD_AGENT_MODEL_COUNT="$(
  docker compose -f docker-compose.prod.yml --env-file .env exec -T postgresql \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "
select count(*)
from agents
where lower(provider) = 'vertexai'
  and lower(model) in ('gemini-3.1-flash-lite', 'gemini-3.5-flash');
"
)"
[[ "$OLD_AGENT_MODEL_COUNT" == "0" ]] \
  || fail "old COTTI Gemini model ids remain on agents rows"

MODEL_DISPLAY_ROW_COUNT="$(
  docker compose -f docker-compose.prod.yml --env-file .env exec -T postgresql \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "
select count(*)
from cotti_model_display_settings
where id = 'default';
"
)"

if [[ "$MODEL_DISPLAY_ROW_COUNT" == "0" ]]; then
  echo "No persisted COTTI model display row; application defaults are in effect."
else
  [[ "$MODEL_DISPLAY_ROW_COUNT" == "1" ]] \
    || fail "unexpected number of default COTTI model display rows"

  docker compose -f docker-compose.prod.yml --env-file .env exec -T postgresql \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "
select section || '|' || display_name || '|' || provider || '|' || model
from (
  select
    section,
    entry->>'displayName' as display_name,
    lower(entry->>'provider') as provider,
    lower(entry->>'model') as model
  from cotti_model_display_settings
  cross join lateral (
    values
      ('chat', config->'chat'),
      ('agent', config->'agent')
  ) sections(section, entries)
  cross join lateral jsonb_array_elements(coalesce(entries, '[]'::jsonb)) entry
  where id = 'default'
    and entry->>'displayName' in ('COTTI-快速', 'COTTI-专业')
) mappings
order by section, display_name;
" | tee /tmp/lobechat-cotti-gemini-mappings.txt

  grep -Fqx 'chat|COTTI-快速|vertexai|gemini-3.5-flash-lite' \
    /tmp/lobechat-cotti-gemini-mappings.txt \
    || fail "incorrect COTTI-快速 mapping in chat"
  grep -Fqx 'chat|COTTI-专业|vertexai|gemini-3.6-flash' \
    /tmp/lobechat-cotti-gemini-mappings.txt \
    || fail "incorrect COTTI-专业 mapping in chat"
  grep -Fqx 'agent|COTTI-专业|vertexai|gemini-3.6-flash' \
    /tmp/lobechat-cotti-gemini-mappings.txt \
    || fail "incorrect COTTI-专业 mapping in agent"
fi

echo
echo "Acceptance checks passed."
