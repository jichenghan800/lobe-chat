#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKDIR="${WORKDIR:-/opt/lobechat-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"
SQL_FILE="${SQL_FILE:-${SCRIPT_DIR}/v2.2.13-platform-analytics-production-acceptance.sql}"
STAMP="$(date +%Y%m%d%H%M%S)"
LOG_FILE="${LOG_FILE:-/tmp/lobechat-platform-analytics-acceptance-${STAMP}.log}"
REQUIRED_SERVICES=(app postgresql qstash searxng)

umask 077

fail() {
  echo "ACCEPTANCE FAILED: $*" >&2
  exit 1
}

[[ -d "$WORKDIR" ]] || fail "work directory does not exist: $WORKDIR"
cd "$WORKDIR"
[[ -f "$COMPOSE_FILE" ]] || fail "compose file does not exist: $WORKDIR/$COMPOSE_FILE"
[[ -f "$ENV_FILE" ]] || fail "env file does not exist: $WORKDIR/$ENV_FILE"
[[ -r "$SQL_FILE" ]] || fail "SQL file is not readable: $SQL_FILE"

exec 9>/tmp/lobechat-platform-analytics-acceptance.lock
flock -n 9 || fail 'another platform analytics acceptance run is active'

compose=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

echo '===== PLATFORM ANALYTICS PRODUCTION ACCEPTANCE ====='
echo "workdir=$WORKDIR"
echo "compose_file=$COMPOSE_FILE"
echo "sql_file=$SQL_FILE"
echo "log_file=$LOG_FILE"
echo 'mode=read-only'

echo '===== REQUIRED SERVICE GATE ====='
for service in "${REQUIRED_SERVICES[@]}"; do
  container_id="$("${compose[@]}" ps -q "$service")"
  [[ -n "$container_id" ]] || fail "required service has no container: $service"

  status="$(docker inspect "$container_id" --format '{{.State.Status}}')"
  health="$(docker inspect "$container_id" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}')"
  printf '%s status=%s health=%s\n' "$service" "$status" "$health"

  [[ "$status" == 'running' ]] || fail "required service is not running: $service"
  [[ "$health" == 'none' || "$health" == 'healthy' ]] \
    || fail "required service is unhealthy: $service ($health)"
done

echo '===== DATABASE READINESS ====='
"${compose[@]}" exec -T postgresql sh -lc \
  'exec pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

echo
echo 'This acceptance runs EXPLAIN ANALYZE for the final dashboard queries.'
echo 'It is protected by a read-only transaction, a 3-second lock timeout,'
echo 'and a 45-second statement timeout. It does not change data or schema.'
read -r -p 'Type RUN_READ_ONLY to continue: ' confirmation
[[ "$confirmation" == 'RUN_READ_ONLY' ]] || fail 'confirmation was not RUN_READ_ONLY'

echo '===== RUN READ-ONLY SQL ====='
"${compose[@]}" exec -T postgresql sh -lc \
  'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < "$SQL_FILE" 2>&1 | tee "$LOG_FILE"

chmod 600 "$LOG_FILE"
grep -Fq 'S5 PLATFORM ANALYTICS ACCEPTANCE COMPLETED' "$LOG_FILE" \
  || fail 'completion marker was not found in the acceptance log'

echo '===== ACCEPTANCE SCRIPT COMPLETED ====='
echo "log_file=$LOG_FILE"
echo 'No schema or data changes were made.'
