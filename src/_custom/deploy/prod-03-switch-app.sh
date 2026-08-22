#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/release-lib.sh"

require_file "$RELEASE_STATE_FILE"
# shellcheck disable=SC1090
source "$RELEASE_STATE_FILE"

[[ "${APP_SWITCHED:-0}" != "1" ]] || fail "this release has already switched the app"
[[ "${BACKUP_RESTORE_VERIFIED:-0}" == "1" ]] || fail "database backup was not fully restore-verified"
[[ "${MIGRATION_COMPLETE:-0}" == "1" ]] || fail "database migration is not complete"
[[ -f "${ENV_BACKUP_FILE:-}" ]] || fail "pre-release .env backup is missing"
[[ -f "${COMPOSE_BACKUP_FILE:-}" ]] || fail "pre-release Compose backup is missing"
[[ -f "${HISTORY_FINGERPRINT_FILE:-}" ]] || fail "history fingerprint is missing"
require_digest
verify_local_image_digest
required_service_gate
assert_history_not_decreased "$HISTORY_FINGERPRINT_FILE"
assert_no_recent_active_runs

echo "== Application switch confirmation =="
echo "Current app image: $(docker inspect "$APP_CONTAINER" --format '{{.Config.Image}}')"
echo "Target app image: $TARGET_IMAGE"
echo "Database migration: 0120 verified"
echo "Database backup: $DB_BACKUP_FILE"
echo "PostgreSQL, QStash, and SearXNG will not be restarted."

if [[ "${AUTO_APPROVE:-0}" != "1" ]]; then
  echo
  read -r -p "Type DEPLOY to switch only the app container: " answer
  [[ "$answer" == "DEPLOY" ]] || fail "app switch aborted"
fi

STAMP="${RELEASE_STAMP:-$(date +%Y%m%d%H%M%S)}"
POST_MIGRATION_ENV_BACKUP="$DEPLOY_DIR/backups/.env.after-v2213-migration-${STAMP}"
cp "$ENV_FILE" "$POST_MIGRATION_ENV_BACKUP"
chmod 600 "$POST_MIGRATION_ENV_BACKUP"
write_release_state_value POST_MIGRATION_ENV_BACKUP "$POST_MIGRATION_ENV_BACKUP"

echo
echo "== 1. Install validated Compose definition =="
cp "$SCRIPT_DIR/docker-compose.prod.yml" "$DEPLOY_DIR/docker-compose.prod.yml"
chmod 600 "$DEPLOY_DIR/docker-compose.prod.yml"
compose config > /tmp/lobechat-compose-v2213.rendered.yml
for service in app postgresql qstash searxng; do
  compose config --services | grep -Fqx "$service" || fail "target Compose is missing $service"
done

echo
echo "== 2. Apply non-secret release configuration =="
while IFS='=' read -r key value; do
  [[ -n "$key" ]] || continue
  [[ "$key" =~ ^[A-Z][A-Z0-9_]*$ ]] || fail "invalid release configuration key: $key"
  set_env "$ENV_FILE" "$key" "$value"
done < "$RELEASE_CONFIG_FILE"

set_env "$ENV_FILE" LOBECHAT_IMAGE "$TARGET_IMAGE"
set_env "$ENV_FILE" LOBECHAT_IMAGE_DIGEST "$TARGET_DIGEST"
set_env "$ENV_FILE" APP_URL "https://chat.cotticoffee.com"
set_env "$ENV_FILE" INTERNAL_APP_URL "http://lobechat-app:3210"
set_env "$ENV_FILE" QSTASH_URL "http://qstash:8080"
set_env "$ENV_FILE" AGENT_RUNTIME_MODE "queue"

echo "LOBECHAT_IMAGE=$TARGET_IMAGE"
echo "LOBECHAT_IMAGE_DIGEST=$TARGET_DIGEST"
echo "Production secrets were preserved from the server-local .env."

echo
echo "== 3. QStash credential gate =="
QSTASH_TOKEN_VALUE="$(read_env QSTASH_TOKEN)"
QSTASH_PORT_VALUE="$(read_env_default QSTASH_PORT 18088)"
QSTASH_STATUS="$(
  curl -sS -o /dev/null --connect-timeout 3 --max-time 10 -w '%{http_code}' \
    -H "Authorization: Bearer ${QSTASH_TOKEN_VALUE}" \
    "http://127.0.0.1:${QSTASH_PORT_VALUE}/v2/topics"
)"
[[ "$QSTASH_STATUS" == "200" ]] || fail "QStash rejected the preserved production token"
echo "Authenticated QStash status=200"

echo
echo "== 4. Reverify image digest immediately before switch =="
verify_local_image_digest

automatic_app_rollback() {
  echo "New app did not become healthy; automatically restoring the previous app configuration." >&2
  cp "$ENV_BACKUP_FILE" "$ENV_FILE"
  cp "$COMPOSE_BACKUP_FILE" "$DEPLOY_DIR/docker-compose.prod.yml"
  chmod 600 "$ENV_FILE" "$DEPLOY_DIR/docker-compose.prod.yml"
  compose up -d --no-deps --pull never app || true
  if wait_for_app_health; then
    echo "Previous app image restored. Database remains safely migrated to 0120." >&2
  else
    echo "Automatic app rollback also failed; inspect both app and PostgreSQL before any restore." >&2
  fi
}

echo
echo "== 5. Switch only the app service =="
if ! compose up -d --no-deps --pull never app; then
  automatic_app_rollback
  fail "Compose failed to recreate the target app"
fi
if ! wait_for_app_health; then
  automatic_app_rollback
  fail "target app failed its health check"
fi

write_release_state_value APP_SWITCHED 1

echo
echo "== 6. Container completeness after switch =="
required_service_gate
compose ps

echo
echo "== 7. Target app startup logs =="
docker logs --tail 160 "$APP_CONTAINER" 2>&1 \
  | sed -E 's/(QSTASH_(TOKEN|CURRENT_SIGNING_KEY|NEXT_SIGNING_KEY)=).*/\1<redacted>/'

echo
echo "App switch completed. Run prod-04-verify-app-update.sh."
