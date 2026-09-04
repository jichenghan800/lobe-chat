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
echo "Current SearXNG image: $(docker inspect "$SEARXNG_CONTAINER" --format '{{.Config.Image}}')"
echo "Target SearXNG image: ${SEARXNG_IMAGE:?SEARXNG_IMAGE is missing from release.env}"
echo "Database migration: 0120 verified"
echo "Database backup: $DB_BACKUP_FILE"
echo "PostgreSQL and QStash will not be restarted."

if [[ "${AUTO_APPROVE:-0}" != "1" ]]; then
  echo
  read -r -p "Type DEPLOY to switch the SearXNG and app containers: " answer
  [[ "$answer" == "DEPLOY" ]] || fail "app switch aborted"
fi

STAMP="${RELEASE_STAMP:-$(date +%Y%m%d%H%M%S)}"
POST_MIGRATION_ENV_BACKUP="$DEPLOY_DIR/backups/.env.after-v2213-migration-${STAMP}"
cp "$ENV_FILE" "$POST_MIGRATION_ENV_BACKUP"
chmod 600 "$POST_MIGRATION_ENV_BACKUP"
write_release_state_value POST_MIGRATION_ENV_BACKUP "$POST_MIGRATION_ENV_BACKUP"

RUNTIME_SWITCH_STARTED=0
automatic_runtime_rollback() {
  trap - ERR
  echo "Target runtime failed; restoring the previous app and SearXNG configuration." >&2
  cp "$ENV_BACKUP_FILE" "$ENV_FILE"
  cp "$COMPOSE_BACKUP_FILE" "$DEPLOY_DIR/docker-compose.prod.yml"
  cp "$SEARXNG_BACKUP_FILE" "$DEPLOY_DIR/searxng-settings.yml"
  chmod 600 "$ENV_FILE" "$DEPLOY_DIR/docker-compose.prod.yml" "$DEPLOY_DIR/searxng-settings.yml"
  if [[ "$RUNTIME_SWITCH_STARTED" == "1" ]]; then
    compose up -d --no-deps --pull never searxng app || true
    if wait_for_app_health; then
      echo "Previous app image restored. Database remains safely migrated to 0120." >&2
    else
      echo "Automatic runtime rollback also failed; inspect the app and SearXNG." >&2
    fi
  else
    echo "Previous runtime files restored; containers were not switched." >&2
  fi
}
trap automatic_runtime_rollback ERR

echo
echo "== 1. Install validated Compose and SearXNG definitions =="
[[ -f "$SCRIPT_DIR/searxng-settings.yml" ]] || fail "release SearXNG settings are missing"
cp "$SCRIPT_DIR/docker-compose.prod.yml" "$DEPLOY_DIR/docker-compose.prod.yml"
cp "$SCRIPT_DIR/searxng-settings.yml" "$DEPLOY_DIR/searxng-settings.yml"
chmod 600 "$DEPLOY_DIR/docker-compose.prod.yml" "$DEPLOY_DIR/searxng-settings.yml"

echo
echo "== 2. Apply non-secret release configuration =="
while IFS='=' read -r key value; do
  [[ -n "$key" ]] || continue
  [[ "$key" =~ ^[A-Z][A-Z0-9_]*$ ]] || fail "invalid release configuration key: $key"
  set_env "$ENV_FILE" "$key" "$value"
done < "$RELEASE_CONFIG_FILE"

set_env "$ENV_FILE" LOBECHAT_IMAGE "$TARGET_IMAGE"
set_env "$ENV_FILE" LOBECHAT_IMAGE_DIGEST "$TARGET_DIGEST"
set_env "$ENV_FILE" SEARXNG_IMAGE "$SEARXNG_IMAGE"
if [[ -z "$(read_env SEARXNG_SECRET)" ]]; then
  set_env "$ENV_FILE" SEARXNG_SECRET "$(openssl rand -hex 32)"
fi
set_env "$ENV_FILE" APP_URL "https://chat.cotticoffee.com"
set_env "$ENV_FILE" INTERNAL_APP_URL "http://lobechat-app:3210"
set_env "$ENV_FILE" QSTASH_URL "http://qstash:8080"
set_env "$ENV_FILE" AGENT_RUNTIME_MODE "queue"

compose config > /tmp/lobechat-compose-v2213.rendered.yml
for service in app postgresql qstash searxng; do
  compose config --services | grep -Fqx "$service" || fail "target Compose is missing $service"
done

echo "LOBECHAT_IMAGE=$TARGET_IMAGE"
echo "LOBECHAT_IMAGE_DIGEST=$TARGET_DIGEST"
echo "Production secrets were preserved from the server-local .env."

echo
echo "== 3. Add the newly released models to the persisted display configuration =="
psql_prod <<'SQL'
DO $$
DECLARE
  current_config jsonb;
  model_item jsonb;
  scope_name text;
BEGIN
  SELECT config INTO current_config
  FROM cotti_model_display_settings
  WHERE id = 'default'
  FOR UPDATE;

  IF current_config IS NULL THEN
    RETURN;
  END IF;

  FOREACH scope_name IN ARRAY ARRAY['chat', 'agent'] LOOP
    FOREACH model_item IN ARRAY ARRAY[
      '{"displayName":"千问3.8-Max","enabled":true,"model":"qwen3.8-max-0902","provider":"qwen"}'::jsonb,
      '{"displayName":"Gemini 3.8 Flash","enabled":true,"model":"gemini-3.8-flash","provider":"vertexai"}'::jsonb
    ] LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(current_config -> scope_name, '[]'::jsonb)) AS configured
        WHERE lower(configured ->> 'provider') = lower(model_item ->> 'provider')
          AND lower(configured ->> 'model') = lower(model_item ->> 'model')
      ) THEN
        current_config = jsonb_set(
          current_config,
          ARRAY[scope_name],
          COALESCE(current_config -> scope_name, '[]'::jsonb) || model_item,
          true
        );
      END IF;
    END LOOP;
  END LOOP;

  UPDATE cotti_model_display_settings
  SET config = current_config, updated_at = NOW()
  WHERE id = 'default';
END $$;
SQL

echo
echo "== 4. QStash credential gate =="
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
echo "== 5. Reverify image digest immediately before switch =="
verify_local_image_digest

echo
echo "== 6. Pull and switch SearXNG =="
if ! docker pull "$SEARXNG_IMAGE"; then
  automatic_runtime_rollback
  fail "unable to pull the pinned SearXNG image"
fi
RUNTIME_SWITCH_STARTED=1
if ! compose up -d --no-deps --pull never searxng; then
  automatic_runtime_rollback
  fail "Compose failed to recreate SearXNG"
fi
if ! wait_for_searxng_health || ! verify_searxng_search; then
  automatic_runtime_rollback
  fail "target SearXNG failed health or functional search verification"
fi
write_release_state_value SEARXNG_SWITCHED 1

echo
echo "== 7. Switch the app service =="
if ! compose up -d --no-deps --pull never app; then
  automatic_runtime_rollback
  fail "Compose failed to recreate the target app"
fi
if ! wait_for_app_health; then
  automatic_runtime_rollback
  fail "target app failed its health check"
fi

write_release_state_value APP_SWITCHED 1
trap - ERR

echo
echo "== 8. Container completeness after switch =="
required_service_gate
compose ps

echo
echo "== 9. Target app startup logs =="
docker logs --tail 160 "$APP_CONTAINER" 2>&1 \
  | sed -E 's/(QSTASH_(TOKEN|CURRENT_SIGNING_KEY|NEXT_SIGNING_KEY)=).*/\1<redacted>/'

echo
echo "App switch completed. Run prod-04-verify-app-update.sh."
