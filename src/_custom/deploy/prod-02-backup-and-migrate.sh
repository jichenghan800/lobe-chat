#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/release-lib.sh"

require_file "$ENV_FILE"
require_file "$COMPOSE_FILE"
require_file "$RELEASE_ENV_FILE"
require_digest
required_service_gate

if [[ -f "$RELEASE_STATE_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$RELEASE_STATE_FILE"
  [[ "${APP_SWITCHED:-0}" != "1" ]] || fail "this release has already switched the app"
fi

echo "== v2.2.13 backup and database migration =="
echo "The existing app stays online during backup and schema expansion."
echo "PostgreSQL and QStash containers will not be recreated."
echo "SearXNG is only backed up here; its controlled switch happens with the app."
echo "No app switch occurs in this script."
echo
echo "Planned data-safety gates:"
echo "1. Pull and digest-verify the target app image"
echo "2. Back up .env, Compose, SearXNG settings, and PostgreSQL"
echo "3. Fully restore the dump into a temporary validation database"
echo "4. Record historical table row fingerprints from the restored dump"
echo "5. Backfill device visibility and create hot indexes online"
echo "6. Apply Drizzle migrations 0119 and 0120 with the target image"
echo "7. Apply idempotent Topic Comment RBAC grants"
echo "8. Prove historical row counts did not decrease"

if [[ "${AUTO_APPROVE:-0}" != "1" ]]; then
  echo
  read -r -p "Type MIGRATE to create the backup and migrate the database: " answer
  [[ "$answer" == "MIGRATE" ]] || fail "aborted before any change"
fi

echo
echo "== 1. Pull and verify target image =="
docker pull "$TARGET_IMAGE"
verify_local_image_digest

mkdir -p backups
STAMP="$(date +%Y%m%d%H%M%S)"
DB_BACKUP_FILE="$DEPLOY_DIR/backups/lobehub-pre-v2213-${STAMP}.dump"
DB_BACKUP_LIST="$DB_BACKUP_FILE.list"
DB_BACKUP_SHA="$DB_BACKUP_FILE.sha256"
ENV_BACKUP_FILE="$DEPLOY_DIR/backups/.env.before-v2213-${STAMP}"
COMPOSE_BACKUP_FILE="$DEPLOY_DIR/backups/docker-compose.prod.yml.before-v2213-${STAMP}"
SEARXNG_BACKUP_FILE="$DEPLOY_DIR/backups/searxng-settings.yml.before-v2213-${STAMP}"
HISTORY_FINGERPRINT_FILE="$DEPLOY_DIR/backups/lobehub-pre-v2213-${STAMP}.history.tsv"
RESTORE_DATABASE="lobehub_restore_verify_${STAMP}"

echo
echo "== 2. Configuration backups =="
cp "$ENV_FILE" "$ENV_BACKUP_FILE"
cp "$COMPOSE_FILE" "$COMPOSE_BACKUP_FILE"
cp searxng-settings.yml "$SEARXNG_BACKUP_FILE"
chmod 600 "$ENV_BACKUP_FILE" "$COMPOSE_BACKUP_FILE" "$SEARXNG_BACKUP_FILE"
echo "env_backup=$ENV_BACKUP_FILE"
echo "compose_backup=$COMPOSE_BACKUP_FILE"
echo "searxng_backup=$SEARXNG_BACKUP_FILE"

echo
echo "== 3. Consistent PostgreSQL dump =="
if ! compose exec -T postgresql sh -lc \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl' \
  > "$DB_BACKUP_FILE"; then
  rm -f "$DB_BACKUP_FILE"
  fail "PostgreSQL backup failed; database migration was not started"
fi
chmod 600 "$DB_BACKUP_FILE"
[[ -s "$DB_BACKUP_FILE" ]] || fail "PostgreSQL backup is empty"

compose exec -T postgresql pg_restore -l < "$DB_BACKUP_FILE" > "$DB_BACKUP_LIST"
grep -Eq 'TABLE DATA public users|TABLE DATA .* users' "$DB_BACKUP_LIST" \
  || fail "backup archive does not contain users table data"
grep -Eq 'TABLE DATA public messages|TABLE DATA .* messages' "$DB_BACKUP_LIST" \
  || fail "backup archive does not contain messages table data"
sha256sum "$DB_BACKUP_FILE" > "$DB_BACKUP_SHA"
chmod 600 "$DB_BACKUP_LIST" "$DB_BACKUP_SHA"
echo "database_backup=$DB_BACKUP_FILE"
cat "$DB_BACKUP_SHA"

cleanup_restore_database() {
  compose exec -T postgresql dropdb \
    -U "$(postgres_user)" --if-exists --force "$RESTORE_DATABASE" >/dev/null 2>&1 || true
}
trap cleanup_restore_database EXIT

echo
echo "== 4. Full restore validation =="
cleanup_restore_database
compose exec -T postgresql createdb \
  -U "$(postgres_user)" -T template0 "$RESTORE_DATABASE"
compose exec -T postgresql pg_restore \
  -U "$(postgres_user)" -d "$RESTORE_DATABASE" \
  --exit-on-error --no-owner --no-acl < "$DB_BACKUP_FILE"

RESTORED_MIGRATION="$(psql_database "$RESTORE_DATABASE" -Atc \
  'SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1;' \
  | tr -d '[:space:]')"
case "$RESTORED_MIGRATION" in
  "${EXPECTED_PRE_MIGRATION:-1784687043746}"|"${EXPECTED_RECONCILIATION_MIGRATION:-1785724387923}"|"${EXPECTED_FINAL_MIGRATION:-1786088099399}") ;;
  *) fail "restored backup has unsupported migration lineage: $RESTORED_MIGRATION" ;;
esac

write_history_fingerprint "$RESTORE_DATABASE" "$HISTORY_FINGERPRINT_FILE"
chmod 600 "$HISTORY_FINGERPRINT_FILE"
[[ -s "$HISTORY_FINGERPRINT_FILE" ]] || fail "restored database produced no history fingerprint"
column -t "$HISTORY_FINGERPRINT_FILE" 2>/dev/null || cat "$HISTORY_FINGERPRINT_FILE"
cleanup_restore_database
trap - EXIT
echo "Full restore validation passed."

write_release_state_value RELEASE_STAMP "$STAMP"
write_release_state_value OLD_APP_IMAGE "$(docker inspect "$APP_CONTAINER" --format '{{.Config.Image}}')"
write_release_state_value OLD_SEARXNG_IMAGE "$(docker inspect "$SEARXNG_CONTAINER" --format '{{.Config.Image}}')"
write_release_state_value ENV_BACKUP_FILE "$ENV_BACKUP_FILE"
write_release_state_value COMPOSE_BACKUP_FILE "$COMPOSE_BACKUP_FILE"
write_release_state_value SEARXNG_BACKUP_FILE "$SEARXNG_BACKUP_FILE"
write_release_state_value DB_BACKUP_FILE "$DB_BACKUP_FILE"
write_release_state_value DB_BACKUP_SHA "$DB_BACKUP_SHA"
write_release_state_value HISTORY_FINGERPRINT_FILE "$HISTORY_FINGERPRINT_FILE"
write_release_state_value BACKUP_RESTORE_VERIFIED 1
write_release_state_value MIGRATION_COMPLETE 0
write_release_state_value APP_SWITCHED 0

echo
echo "== 5. Recheck migration conflicts =="
IDLE_TRANSACTIONS="$(db_scalar "
  SELECT count(*) FROM pg_stat_activity
  WHERE datname=current_database() AND pid <> pg_backend_pid()
    AND state='idle in transaction' AND xact_start < now() - interval '5 minutes';
")"
[[ "$IDLE_TRANSACTIONS" == "0" ]] || fail "long idle transactions appeared after backup"

DUPLICATE_OWNERS="$(db_scalar "
  SELECT count(*) FROM (
    SELECT workspace_id FROM workspace_members
    WHERE role='owner' AND deleted_at IS NULL
    GROUP BY workspace_id HAVING count(*) > 1
  ) conflicts;
")"
[[ "$DUPLICATE_OWNERS" == "0" ]] || fail "duplicate active workspace owners would block migration"

assert_no_recent_active_runs

LATEST_MIGRATION="$(db_scalar 'SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1;')"
case "$LATEST_MIGRATION" in
  "${EXPECTED_PRE_MIGRATION:-1784687043746}"|"${EXPECTED_RECONCILIATION_MIGRATION:-1785724387923}"|"${EXPECTED_FINAL_MIGRATION:-1786088099399}") ;;
  *) fail "unsupported migration lineage before v2.2.13 migration: $LATEST_MIGRATION" ;;
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

  echo
  echo "== 6. Device visibility backfill and online indexes =="
  psql_prod <<'SQL'
SELECT pg_advisory_lock(hashtext('lobehub:v2213-cotti:pre-migration'));

ALTER TABLE devices ADD COLUMN IF NOT EXISTS visibility text;

UPDATE devices
SET visibility = 'public'
WHERE workspace_id IS NOT NULL AND visibility IS NULL;

UPDATE devices
SET visibility = 'private'
WHERE visibility IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS agents_created_at_idx
ON agents USING btree (created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS topics_created_at_idx
ON topics USING btree (created_at);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM devices WHERE visibility IS NULL) THEN
    RAISE EXCEPTION 'device visibility backfill is incomplete';
  END IF;
END $$;

SELECT pg_advisory_unlock(hashtext('lobehub:v2213-cotti:pre-migration'));
SQL
else
  echo "Pre-migration already satisfied at migration $LATEST_MIGRATION."
fi

NULL_VISIBILITY="$(db_scalar "
  SELECT count(*) FROM devices WHERE visibility IS NULL;
")"
[[ "$NULL_VISIBILITY" == "0" ]] || fail "devices still contain NULL visibility"

echo
echo "== 7. Apply Drizzle 0119 and 0120 with target image =="
DATABASE_URL_VALUE="$(
  docker inspect "$APP_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | sed -n 's/^DATABASE_URL=//p' | tail -n 1
)"
[[ -n "$DATABASE_URL_VALUE" ]] || fail "unable to read the current app DATABASE_URL"

DATABASE_URL="$DATABASE_URL_VALUE" docker run --rm \
  --network lobechat_prod \
  -e DATABASE_DRIVER=node \
  -e DATABASE_URL \
  --entrypoint /bin/node \
  "$TARGET_IMAGE" /app/docker.cjs
unset DATABASE_URL_VALUE

LATEST_MIGRATION="$(db_scalar 'SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1;')"
[[ "$LATEST_MIGRATION" == "${EXPECTED_FINAL_MIGRATION:-1786088099399}" ]] \
  || fail "expected final migration 0120, got $LATEST_MIGRATION"

echo
echo "== 8. Topic Comment RBAC post-migration =="
psql_prod <<'SQL'
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('lobehub:v2213-cotti:post-migration'));

INSERT INTO rbac_permissions (id, code, name, category)
SELECT
  substring(md5('topic-comment-rbac:' || permission.code) from 1 for 16),
  permission.code,
  permission.name,
  'topic_comment'
FROM (
  VALUES
    ('topic_comment:read:all', 'Topic Comment Read'),
    ('topic_comment:create:all', 'Topic Comment Create'),
    ('topic_comment:update:all', 'Topic Comment Update'),
    ('topic_comment:delete:all', 'Topic Comment Delete'),
    ('topic_comment:restore:all', 'Topic Comment Restore'),
    ('topic_comment:create:owner', 'Topic Comment Create'),
    ('topic_comment:update:owner', 'Topic Comment Update'),
    ('topic_comment:delete:owner', 'Topic Comment Delete')
) AS permission(code, name)
ON CONFLICT (code) DO NOTHING;

INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM (
  VALUES
    ('workspace_owner', true, 'topic_comment:read:all'),
    ('workspace_owner', true, 'topic_comment:create:all'),
    ('workspace_owner', true, 'topic_comment:update:all'),
    ('workspace_owner', true, 'topic_comment:delete:all'),
    ('workspace_owner', true, 'topic_comment:restore:all'),
    ('workspace_member', true, 'topic_comment:read:all'),
    ('workspace_member', true, 'topic_comment:create:owner'),
    ('workspace_member', true, 'topic_comment:update:owner'),
    ('workspace_member', true, 'topic_comment:delete:owner'),
    ('workspace_viewer', true, 'topic_comment:read:all'),
    ('super_admin', false, 'topic_comment:read:all'),
    ('super_admin', false, 'topic_comment:create:all'),
    ('super_admin', false, 'topic_comment:update:all'),
    ('super_admin', false, 'topic_comment:delete:all'),
    ('super_admin', false, 'topic_comment:restore:all')
) AS grant_spec(role_name, workspace_scoped, permission_code)
JOIN rbac_roles role
  ON role.name = grant_spec.role_name
  AND (
    (grant_spec.workspace_scoped AND role.is_system = true AND role.workspace_id IS NOT NULL)
    OR (NOT grant_spec.workspace_scoped AND role.workspace_id IS NULL)
  )
JOIN rbac_permissions permission ON permission.code = grant_spec.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
SQL

PERMISSION_COUNT="$(db_scalar "SELECT count(*) FROM rbac_permissions WHERE code LIKE 'topic_comment:%';")"
[[ "$PERMISSION_COUNT" == "8" ]] || fail "expected 8 Topic Comment permissions"

MISSING_GRANTS="$(db_scalar "
  WITH expected_grants(role_name, workspace_scoped, permission_code) AS (
    VALUES
      ('workspace_owner', true, 'topic_comment:read:all'),
      ('workspace_owner', true, 'topic_comment:create:all'),
      ('workspace_owner', true, 'topic_comment:update:all'),
      ('workspace_owner', true, 'topic_comment:delete:all'),
      ('workspace_owner', true, 'topic_comment:restore:all'),
      ('workspace_member', true, 'topic_comment:read:all'),
      ('workspace_member', true, 'topic_comment:create:owner'),
      ('workspace_member', true, 'topic_comment:update:owner'),
      ('workspace_member', true, 'topic_comment:delete:owner'),
      ('workspace_viewer', true, 'topic_comment:read:all'),
      ('super_admin', false, 'topic_comment:read:all'),
      ('super_admin', false, 'topic_comment:create:all'),
      ('super_admin', false, 'topic_comment:update:all'),
      ('super_admin', false, 'topic_comment:delete:all'),
      ('super_admin', false, 'topic_comment:restore:all')
  ), applicable AS (
    SELECT role.id AS role_id, permission.id AS permission_id
    FROM expected_grants spec
    JOIN rbac_roles role ON role.name=spec.role_name AND (
      (spec.workspace_scoped AND role.is_system=true AND role.workspace_id IS NOT NULL)
      OR (NOT spec.workspace_scoped AND role.workspace_id IS NULL)
    )
    JOIN rbac_permissions permission ON permission.code=spec.permission_code
  )
  SELECT count(*) FROM applicable expected
  LEFT JOIN rbac_role_permissions actual
    ON actual.role_id=expected.role_id AND actual.permission_id=expected.permission_id
  WHERE actual.role_id IS NULL;
")"
[[ "$MISSING_GRANTS" == "0" ]] || fail "Topic Comment RBAC grants are incomplete"

echo
echo "== 9. Historical data preservation gate =="
assert_history_not_decreased "$HISTORY_FINGERPRINT_FILE"

write_release_state_value MIGRATION_COMPLETE 1
echo
echo "Database migration completed with a fully restored backup and preserved history."
echo "Validated rollback dump: $DB_BACKUP_FILE"
echo "The old app is still running. Continue with prod-03-switch-app.sh."
