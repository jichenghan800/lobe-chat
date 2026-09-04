#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/release-lib.sh"

require_file "$RELEASE_STATE_FILE"
# shellcheck disable=SC1090
source "$RELEASE_STATE_FILE"
[[ "${APP_SWITCHED:-0}" == "1" ]] || fail "release state does not record an app switch"
require_digest

echo "== 1. Required containers =="
required_service_gate
compose ps

echo
echo "== 2. Immutable image identity =="
ENV_IMAGE="$(read_env LOBECHAT_IMAGE)"
ENV_DIGEST="$(read_env LOBECHAT_IMAGE_DIGEST)"
CONTAINER_IMAGE="$(docker inspect "$APP_CONTAINER" --format '{{.Config.Image}}')"
REVISION="$(docker image inspect "$TARGET_IMAGE" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')"
echo "expected_image=$TARGET_IMAGE"
echo "running_image=$CONTAINER_IMAGE"
echo "expected_digest=$TARGET_DIGEST"
echo "image_revision=$REVISION"
[[ "$ENV_IMAGE" == "$TARGET_IMAGE" ]] || fail ".env image does not match target"
[[ "$ENV_DIGEST" == "$TARGET_DIGEST" ]] || fail ".env digest does not match target"
[[ "$CONTAINER_IMAGE" == "$TARGET_IMAGE" ]] || fail "running image does not match target"
[[ "$REVISION" == "${APP_SOURCE_COMMIT:-}" ]] || fail "image revision does not match app source commit"
verify_local_image_digest

echo
echo "== 3. SearXNG image, health, and functional search =="
SEARXNG_RUNNING_IMAGE="$(docker inspect "$SEARXNG_CONTAINER" --format '{{.Config.Image}}')"
echo "expected_searxng_image=$SEARXNG_IMAGE"
echo "running_searxng_image=$SEARXNG_RUNNING_IMAGE"
[[ "$SEARXNG_RUNNING_IMAGE" == "$SEARXNG_IMAGE" ]] || fail "running SearXNG image does not match target"
wait_for_searxng_health || fail "SearXNG is not healthy"
verify_searxng_search || fail "SearXNG functional search failed"

echo
echo "== 4. Database lineage and schema =="
LATEST_MIGRATION="$(db_scalar 'SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1;')"
echo "latest_migration=$LATEST_MIGRATION"
[[ "$LATEST_MIGRATION" == "${EXPECTED_FINAL_MIGRATION:-1786088099399}" ]] \
  || fail "database is not at migration 0120"

REQUIRED_TABLE_COUNT="$(db_scalar "
  SELECT count(*) FROM information_schema.tables
  WHERE table_schema='public' AND table_name = ANY(ARRAY[
    'acceptances','agent_account_bindings','agent_provider_accounts','agent_quota_calibrations',
    'agent_quota_snapshots','agent_quota_usage_ledger','agent_quota_windows','resource_permissions',
    'topic_comment_mentions','topic_comments','verify_evidence','verify_reports','verify_runs',
    'work_versions','works','workspace_user_settings','cotti_login_access_rules',
    'cotti_login_access_settings','cotti_platform_admin_assignments'
  ]::text[]);
")"
[[ "$REQUIRED_TABLE_COUNT" == "19" ]] || fail "v2.2.13 required tables are incomplete"

NULL_VISIBILITY="$(db_scalar 'SELECT count(*) FROM devices WHERE visibility IS NULL;')"
[[ "$NULL_VISIBILITY" == "0" ]] || fail "device visibility backfill is incomplete"

PERMISSION_COUNT="$(db_scalar "SELECT count(*) FROM rbac_permissions WHERE code LIKE 'topic_comment:%';")"
[[ "$PERMISSION_COUNT" == "8" ]] || fail "Topic Comment RBAC permissions are incomplete"

echo
echo "== 5. Historical data preservation =="
sha256sum -c "$DB_BACKUP_SHA"
assert_history_not_decreased "$HISTORY_FINGERPRINT_FILE"

echo
echo "== 6. Platform, connectors, unified login, and environment isolation =="
docker exec "$APP_CONTAINER" /bin/node -e "
const required = [
  'NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS',
  'NEXT_PUBLIC_COTTI_FEISHU_SUPPORT_URL',
  'COTTI_PLATFORM_ANALYTICS_ADMIN_EMAILS',
  'COTTI_SSO_NANO_CLIENT_SECRET',
  'COTTI_SSO_PPT_CLIENT_SECRET',
  'AUTH_FEISHU_BLUE_APP_ID',
  'AUTH_FEISHU_BLUE_APP_SECRET',
  'AUTH_SSO_PROVIDERS',
  'COMPOSIO_API_KEY',
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
];
const missing = [];
for (const key of required) {
  const set = Boolean(process.env[key]);
  console.log(key + '=' + (set ? 'set' : 'missing'));
  if (!set) missing.push(key);
}
if (process.env.NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS !== '1') missing.push('platform-flag=1');
if (process.env.COTTI_AI_ACCESS_MANAGEMENT_ENABLED) missing.push('cotti-ai-access-must-be-disabled');
if (process.env.QWEN_PROXY_URL !== 'https://llm-gvbqtqm25t1leudh.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1') missing.push('qwen-singapore-endpoint');
if (!(process.env.QWEN_MODEL_LIST || '').includes('qwen3.8-max-0902')) missing.push('qwen3.8-model-list');
if (!(process.env.VERTEXAI_MODEL_LIST || '').includes('gemini-3.8-flash')) missing.push('gemini3.8-model-list');
const providers = (process.env.AUTH_SSO_PROVIDERS || '').split(',').map((item) => item.trim());
if (!providers.includes('feishu') || !providers.includes('feishu-blue')) missing.push('feishu-sso-providers');
if (missing.length) process.exit(2);
" || fail "v2.2.13 runtime configuration is incomplete"

MODEL_DISPLAY_COUNT="$(db_scalar "
  SELECT count(*)
  FROM cotti_model_display_settings settings,
       LATERAL jsonb_array_elements(settings.config->'chat') chat,
       LATERAL jsonb_array_elements(settings.config->'agent') agent
  WHERE settings.id='default'
    AND chat->>'model' IN ('qwen3.8-max-0902', 'gemini-3.8-flash')
    AND agent->>'model' IN ('qwen3.8-max-0902', 'gemini-3.8-flash');
")"
[[ "$MODEL_DISPLAY_COUNT" == "4" ]] || fail "new model display configuration is incomplete"

verify_platform_management_asset

echo
echo "== 7. QStash authenticated health =="
QSTASH_PORT_VALUE="$(read_env_default QSTASH_PORT 18088)"
QSTASH_STATUS="$(
  curl -sS -o /dev/null --connect-timeout 3 --max-time 10 -w '%{http_code}' \
    -H "Authorization: Bearer $(read_env QSTASH_TOKEN)" \
    "http://127.0.0.1:${QSTASH_PORT_VALUE}/v2/topics"
)"
[[ "$QSTASH_STATUS" == "200" ]] || fail "QStash authenticated health failed"
echo "qstash_http=200"

echo
echo "== 8. Application and public OIDC endpoints =="
PORT="$(read_env_default LOBECHAT_PORT 3210)"
APP_HTTP="$(curl -sS -o /dev/null --max-time 20 -w '%{http_code}' "http://127.0.0.1:${PORT}/")"
[[ "$APP_HTTP" =~ ^(200|302|307)$ ]] || fail "local app health returned HTTP $APP_HTTP"
echo "local_app_http=$APP_HTTP"

OIDC_CONFIG="$(curl -fsS --max-time 20 https://chat.cotticoffee.com/oidc/.well-known/openid-configuration)"
grep -Fq '"issuer"' <<<"$OIDC_CONFIG" || fail "OIDC discovery is not JSON"
grep -Fq 'https://chat.cotticoffee.com/oidc' <<<"$OIDC_CONFIG" || fail "OIDC issuer uses the wrong domain"
JWKS="$(curl -fsS --max-time 20 https://chat.cotticoffee.com/oidc/jwks)"
grep -Fq '"keys"' <<<"$JWKS" || fail "OIDC JWKS is not JSON"
echo "oidc_discovery=ok jwks=ok"

echo
echo "== 9. Startup logs =="
STARTED_AT="$(docker inspect "$APP_CONTAINER" --format '{{.State.StartedAt}}')"
STARTUP_LOGS="$(docker logs --since "$STARTED_AT" "$APP_CONTAINER" 2>&1)"
grep -Fq 'database migration pass' <<<"$STARTUP_LOGS" || fail "database migration startup log missing"
grep -Eq 'Ready in|✓ Ready' <<<"$STARTUP_LOGS" || fail "Next.js Ready log missing"
grep -Fq 'Gateway: Started successfully' <<<"$STARTUP_LOGS" || fail "Gateway startup log missing"
printf '%s\n' "$STARTUP_LOGS" \
  | grep -E 'Start to migration|database migration pass|Ready|Gateway|QStash: Schedule|migrate failed|FATAL' \
  | tail -80

echo
echo "Acceptance checks passed. Historical data backup and row-count gates passed."
