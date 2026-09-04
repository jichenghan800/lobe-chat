#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/release-lib.sh"

require_file "$RELEASE_STATE_FILE"
# shellcheck disable=SC1090
source "$RELEASE_STATE_FILE"

[[ -f "${ENV_BACKUP_FILE:-}" ]] || fail "pre-release .env backup is missing"
[[ -f "${COMPOSE_BACKUP_FILE:-}" ]] || fail "pre-release Compose backup is missing"
[[ -f "${SEARXNG_BACKUP_FILE:-}" ]] || fail "pre-release SearXNG backup is missing"
[[ -f "${DB_BACKUP_FILE:-}" ]] || fail "validated database backup is missing"

echo "== Safe application rollback =="
echo "Previous image: ${OLD_APP_IMAGE:-unknown}"
echo "Validated database dump: $DB_BACKUP_FILE"
echo "This command restores .env, Compose, SearXNG settings, and the previous app/search images."
echo "Database migration 0120 remains in place; PostgreSQL data is not overwritten."
echo "Automated database restore is intentionally prohibited to protect writes made after release."

if [[ "${AUTO_APPROVE:-0}" != "1" ]]; then
  echo
  read -r -p "Type ROLLBACK to restore the previous app: " answer
  [[ "$answer" == "ROLLBACK" ]] || fail "rollback aborted"
fi

FAILED_ENV_BACKUP="$DEPLOY_DIR/backups/.env.failed-v2213-$(date +%Y%m%d%H%M%S)"
cp "$ENV_FILE" "$FAILED_ENV_BACKUP"
chmod 600 "$FAILED_ENV_BACKUP"

cp "$ENV_BACKUP_FILE" "$ENV_FILE"
cp "$COMPOSE_BACKUP_FILE" "$DEPLOY_DIR/docker-compose.prod.yml"
cp "$SEARXNG_BACKUP_FILE" "$DEPLOY_DIR/searxng-settings.yml"
chmod 600 "$ENV_FILE" "$DEPLOY_DIR/docker-compose.prod.yml" "$DEPLOY_DIR/searxng-settings.yml"

compose config > /tmp/lobechat-compose-rollback.rendered.yml
compose up -d --no-deps --pull never searxng app
wait_for_app_health || fail "previous app failed to become healthy"
required_service_gate

write_release_state_value APP_SWITCHED 0
write_release_state_value SEARXNG_SWITCHED 0
write_release_state_value APP_ROLLED_BACK 1

echo "Application rollback passed. Database and historical data were not restored or deleted."
echo "Failed release env preserved at: $FAILED_ENV_BACKUP"
