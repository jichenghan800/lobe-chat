#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/release-lib.sh"

require_command docker
require_command curl
require_command openssl
require_command sha256sum
require_file "$ENV_FILE"
require_file "$COMPOSE_FILE"
require_file "$RELEASE_ENV_FILE"
require_file "$RELEASE_CONFIG_FILE"
require_file searxng-settings.yml
[[ -f "$RELEASE_ASSET_DIR/searxng-settings.yml" ]] || fail "release SearXNG settings are missing"
require_digest

echo "== 1. Host and Docker runtime =="
hostname
date '+%Y-%m-%d %H:%M:%S %z'
uname -m
df -h / /var/lib/docker "$DEPLOY_DIR" 2>/dev/null || df -h
free -h || true
docker version --format 'Docker client={{.Client.Version}} server={{.Server.Version}}'
docker compose version

echo
echo "== 2. Release identity =="
echo "Target image: $TARGET_IMAGE"
echo "Target digest: $TARGET_DIGEST"
echo "Tooling commit: ${RELEASE_TOOLING_COMMIT:-missing}"
[[ "${RELEASE_TOOLING_COMMIT:-}" =~ ^[0-9a-f]{40}$ ]] || fail "invalid tooling commit"

echo
echo "== 3. Production secret/configuration gates =="
required_envs=(
  POSTGRES_PASSWORD DATABASE_DRIVER APP_URL AUTH_SECRET AUTH_TRUSTED_ORIGINS KEY_VAULTS_SECRET
  COTTI_PLATFORM_ANALYTICS_ADMIN_EMAILS COTTI_SSO_NANO_CLIENT_SECRET COTTI_SSO_PPT_CLIENT_SECRET
  AUTH_FEISHU_APP_ID AUTH_FEISHU_APP_SECRET AUTH_FEISHU_BLUE_APP_ID AUTH_FEISHU_BLUE_APP_SECRET
  COMPOSIO_API_KEY REDIS_URL QSTASH_URL QSTASH_TOKEN QSTASH_CURRENT_SIGNING_KEY
  QSTASH_NEXT_SIGNING_KEY AGENT_RUNTIME_MODE OPENAI_API_KEY OPENAI_PROXY_URL AZURE_API_KEY
  VERTEXAI_CREDENTIALS VOLCENGINE_API_KEY QWEN_API_KEY
)
for key in "${required_envs[@]}"; do
  require_env_value "$key" "v2.2.13 production runtime"
  printf '%s=%s\n' "$key" "$(mask_value "$(read_env "$key")")"
done
[[ "$(read_env DATABASE_DRIVER)" == "node" ]] || fail "DATABASE_DRIVER must be node"
[[ "$(read_env AGENT_RUNTIME_MODE)" == "queue" ]] || fail "AGENT_RUNTIME_MODE must be queue"
[[ "$(read_env APP_URL)" == "https://chat.cotticoffee.com" ]] || fail "APP_URL must be production domain"
[[ -z "$(read_env COTTI_AI_ACCESS_MANAGEMENT_ENABLED)" ]] \
  || fail "COTTI_AI_ACCESS_MANAGEMENT_ENABLED must remain unset in production"
[[ "$(read_env REDIS_URL)" =~ ^rediss?:// ]] || fail "REDIS_URL must include redis:// or rediss://"

echo
echo "== 4. Non-secret release configuration =="
for key in \
  NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS NEXT_PUBLIC_COTTI_FEISHU_SUPPORT_URL \
  NEXT_PUBLIC_MODEL_VISIBLE_ALLOW \
  NEXT_PUBLIC_MODEL_DISPLAY_NAMES VERTEXAI_MODEL_LIST AZURE_MODEL_LIST \
  VOLCENGINE_MODEL_LIST QWEN_MODEL_LIST COTTI_AGENT_ACCESS_MODE AUTH_SSO_PROVIDERS; do
  value="$(awk -F= -v key="$key" '$1 == key { value=substr($0,index($0,"=")+1) } END { print value }' "$RELEASE_CONFIG_FILE")"
  [[ -n "$value" ]] || fail "release-config.env is missing $key"
  printf '%s=%s\n' "$key" "$value"
done
[[ "$(awk -F= '$1 == "NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS" { value=$2 } END { print value }' "$RELEASE_CONFIG_FILE")" == "1" ]] \
  || fail "platform management must be enabled in release-config.env"
FEISHU_SUPPORT_URL="$(awk -F= '$1 == "NEXT_PUBLIC_COTTI_FEISHU_SUPPORT_URL" { value=substr($0,index($0,"=")+1) } END { print value }' "$RELEASE_CONFIG_FILE")"
[[ "$FEISHU_SUPPORT_URL" =~ ^https://applink\.feishu\.cn/client/chat/open\?openId=ou_[A-Za-z0-9_-]+$ ]] \
  || fail "Feishu administrator contact AppLink is invalid"
RELEASE_SSO_PROVIDERS="$(awk -F= '$1 == "AUTH_SSO_PROVIDERS" { value=substr($0,index($0,"=")+1) } END { print value }' "$RELEASE_CONFIG_FILE")"
grep -Eq '(^|,)feishu(,|$)' <<<"$RELEASE_SSO_PROVIDERS" || fail "release must retain Feishu SSO"
grep -Eq '(^|,)feishu-blue(,|$)' <<<"$RELEASE_SSO_PROVIDERS" || fail "release must enable Feishu Blue SSO"
RELEASE_QWEN_PROXY_URL="$(awk -F= '$1 == "QWEN_PROXY_URL" { value=substr($0,index($0,"=")+1) } END { print value }' "$RELEASE_CONFIG_FILE")"
[[ "$RELEASE_QWEN_PROXY_URL" == "https://llm-gvbqtqm25t1leudh.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1" ]] \
  || fail "QWEN_PROXY_URL must use the approved Singapore endpoint"
grep -Fq 'qwen3.8-max-0902' "$RELEASE_CONFIG_FILE" || fail "Qwen 3.8 is missing from release configuration"
grep -Fq 'gemini-3.8-flash' "$RELEASE_CONFIG_FILE" || fail "Gemini 3.8 is missing from release configuration"

NANO_CLIENT_SECRET="$(read_env COTTI_SSO_NANO_CLIENT_SECRET)"
PPT_CLIENT_SECRET="$(read_env COTTI_SSO_PPT_CLIENT_SECRET)"
[[ "${#NANO_CLIENT_SECRET}" -ge 32 ]] || fail "COTTI_SSO_NANO_CLIENT_SECRET is too short"
[[ "${#PPT_CLIENT_SECRET}" -ge 32 ]] || fail "COTTI_SSO_PPT_CLIENT_SECRET is too short"

echo
echo "== 5. Compose render and required services =="
compose config > /tmp/lobechat-compose-prod.rendered.yml
required_service_gate
compose ps

echo
echo "== 6. Registry manifest =="
docker manifest inspect "$TARGET_IMAGE" > /tmp/lobechat-target-manifest.json
echo "Target manifest is readable."

echo
echo "== 7. SearXNG settings =="
awk '
  $1 == "formats:" { in_formats = 1; next }
  in_formats && /^[^[:space:]-]/ { in_formats = 0 }
  in_formats && $0 ~ /^[[:space:]]*-[[:space:]]*json[[:space:]]*$/ { found = 1 }
  END { exit found ? 0 : 1 }
' "$RELEASE_ASSET_DIR/searxng-settings.yml" || fail "release SearXNG JSON format is not enabled"
echo "SearXNG JSON format enabled."
grep -Fqx "SEARXNG_IMAGE=${SEARXNG_IMAGE:-}" "$RELEASE_ENV_FILE" \
  || fail "release.env does not pin the expected SearXNG image"

echo
echo "== 8. Database readiness and capacity =="
psql_prod -c 'SELECT current_database() AS database, current_user AS database_user, now() AS checked_at;'
DB_SIZE_BYTES="$(db_scalar 'SELECT pg_database_size(current_database());')"
DB_SIZE_HUMAN="$(psql_prod -Atc 'SELECT pg_size_pretty(pg_database_size(current_database()));' | tr -d '\r')"
AVAILABLE_BYTES="$(df -PB1 "$DEPLOY_DIR" | awk 'NR == 2 { print $4 }')"
echo "database_size=$DB_SIZE_HUMAN bytes=$DB_SIZE_BYTES"
echo "deploy_filesystem_available_bytes=$AVAILABLE_BYTES"
(( AVAILABLE_BYTES >= DB_SIZE_BYTES * 4 )) \
  || fail "less than four database sizes of free space are available for backup validation"

echo
echo "== 9. Migration lineage =="
LATEST_MIGRATION="$(db_scalar 'SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1;')"
echo "latest_migration=$LATEST_MIGRATION"
case "$LATEST_MIGRATION" in
  "${EXPECTED_PRE_MIGRATION:-1784687043746}"|"${EXPECTED_RECONCILIATION_MIGRATION:-1785724387923}"|"${EXPECTED_FINAL_MIGRATION:-1786088099399}") ;;
  *) fail "unsupported production migration lineage: $LATEST_MIGRATION" ;;
esac

if [[ "$LATEST_MIGRATION" == "${EXPECTED_PRE_MIGRATION:-1784687043746}" ]]; then
  PARTIAL_TABLES="$(db_scalar "
    SELECT count(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name = ANY(ARRAY[
      'acceptances','agent_account_bindings','agent_provider_accounts','agent_quota_calibrations',
      'agent_quota_snapshots','agent_quota_usage_ledger','agent_quota_windows','resource_permissions',
      'topic_comment_mentions','topic_comments','verify_evidence','verify_reports','verify_runs',
      'work_versions','works','workspace_user_settings'
    ]::text[]);
  ")"
  [[ "$PARTIAL_TABLES" == "0" ]] || fail "partial v2.2.13 schema exists before migration 0119"
fi

echo
echo "== 10. Migration conflict gates =="
DUPLICATE_OWNERS="$(db_scalar "
  SELECT count(*) FROM (
    SELECT workspace_id FROM workspace_members
    WHERE role='owner' AND deleted_at IS NULL
    GROUP BY workspace_id HAVING count(*) > 1
  ) conflicts;
")"
[[ "$DUPLICATE_OWNERS" == "0" ]] || fail "duplicate active workspace owners would block migration"

IDLE_TRANSACTIONS="$(db_scalar "
  SELECT count(*) FROM pg_stat_activity
  WHERE datname=current_database() AND pid <> pg_backend_pid()
    AND state='idle in transaction' AND xact_start < now() - interval '5 minutes';
")"
[[ "$IDLE_TRANSACTIONS" == "0" ]] || fail "long idle transactions must be cleared before migration"

assert_no_recent_active_runs

psql_prod -c "
  SELECT
    count(*) AS total_devices,
    count(*) FILTER (WHERE workspace_id IS NOT NULL) AS workspace_devices,
    count(*) FILTER (WHERE workspace_id IS NULL) AS personal_devices
  FROM devices;
"

echo
echo "== 11. Current historical row counts =="
CURRENT_FINGERPRINT="/tmp/lobechat-production-precheck-fingerprint.tsv"
write_history_fingerprint "$(postgres_db)" "$CURRENT_FINGERPRINT"
column -t "$CURRENT_FINGERPRINT" 2>/dev/null || cat "$CURRENT_FINGERPRINT"

echo
echo "Precheck passed. No production data or container was changed."
