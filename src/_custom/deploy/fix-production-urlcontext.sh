#!/usr/bin/env bash
set -euo pipefail

cd /opt/lobechat-main

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DB_SERVICE="${DB_SERVICE:-postgresql}"
DB_USER="${DB_USER:-paradedb}"
DB_NAME="${DB_NAME:-lobehub}"

psql_prod() {
  docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
    psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
}

echo "=== 1. BEFORE STATE ==="
BEFORE_TRUE="$(psql_prod -tA -c "select count(*) from agents where chat_config->>'urlContext' = 'true';")"

psql_prod -P pager=off -c "SELECT
    count(*) AS total_agents,
    count(*) FILTER (WHERE chat_config ? 'urlContext') AS has_field,
    count(*) FILTER (WHERE chat_config->>'urlContext' = 'true') AS val_true,
    count(*) FILTER (WHERE chat_config->>'urlContext' = 'false') AS val_false,
    count(*) FILTER (WHERE chat_config->>'urlContext' IS NULL) AS val_null_or_missing
FROM agents;"

echo "Pending update count: $BEFORE_TRUE"

echo
echo "=== 2. CREATING BACKUP ==="
mkdir -p backups/urlcontext-fix
BACKUP_FILE="backups/urlcontext-fix/agents-urlcontext-true-$(date +%Y%m%d-%H%M%S).csv"

psql_prod -P pager=off -c "COPY (
    SELECT id, user_id, provider, model, chat_config, updated_at
    FROM agents
    WHERE chat_config->>'urlContext' = 'true'
) TO STDOUT WITH CSV HEADER;" > "$BACKUP_FILE"

if [ ! -s "$BACKUP_FILE" ]; then
  echo "Error: backup file is empty or missing. Abort." >&2
  exit 1
fi

BACKUP_COUNT="$(($(wc -l < "$BACKUP_FILE") - 1))"
echo "Backup saved successfully to: $BACKUP_FILE"
echo "Backup record count: $BACKUP_COUNT"

if [ "$BEFORE_TRUE" -ne "$BACKUP_COUNT" ]; then
  echo "Error: backup count $BACKUP_COUNT does not match pending update count $BEFORE_TRUE. Abort." >&2
  exit 1
fi

echo
echo "=== 3. EXECUTING SAFE UPDATE ==="
psql_prod -P pager=off -c "UPDATE agents
SET chat_config = jsonb_set(chat_config, '{urlContext}', 'false'::jsonb, true),
    updated_at = now()
WHERE chat_config->>'urlContext' = 'true'
RETURNING id, user_id, provider, model, chat_config->>'urlContext' AS updated_url_context;"

echo
echo "=== 4. AFTER STATE ==="
psql_prod -P pager=off -c "SELECT
    count(*) AS total_agents,
    count(*) FILTER (WHERE chat_config ? 'urlContext') AS has_field,
    count(*) FILTER (WHERE chat_config->>'urlContext' = 'true') AS val_true,
    count(*) FILTER (WHERE chat_config->>'urlContext' = 'false') AS val_false
FROM agents;"

echo
echo "Done. Expected final state: val_true = 0."
