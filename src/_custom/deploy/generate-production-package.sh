#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

SRC_ENV="${SRC_ENV:-.env}"
PROD_HOST="${PROD_HOST:-47.236.135.3}"
PROD_DIR="${PROD_DIR:-/opt/lobechat-main}"
OUT_DIR="${1:-src/_custom/deploy/dist/production-$(date +%Y%m%d-%H%M%S)}"

if [[ ! -f "$SRC_ENV" ]]; then
  echo "Missing source env file: $SRC_ENV" >&2
  exit 1
fi

if [[ ! -f docker-compose.prod.yml ]]; then
  echo "Missing docker-compose.prod.yml" >&2
  exit 1
fi

read_env() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { print substr($0, index($0, "=") + 1); exit }' "$SRC_ENV"
}

read_template() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { print substr($0, index($0, "=") + 1); exit }' .env.production.example
}

set_env() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp="${file}.tmp"

  awk -v key="$key" -v value="$value" '
    BEGIN { done = 0 }
    $0 ~ "^[[:space:]]*" key "=" {
      print key "=" value
      done = 1
      next
    }
    { print }
    END {
      if (!done) print key "=" value
    }
  ' "$file" > "$tmp"

  mv "$tmp" "$file"
}

require_value() {
  local key="$1"
  local value
  value="$(read_env "$key")"
  if [[ -z "$value" || "$value" == CHANGE_ME* ]]; then
    echo "Source .env has no usable value for required key: $key" >&2
    exit 1
  fi
}

mkdir -p "$OUT_DIR"
cp docker-compose.prod.yml "$OUT_DIR/docker-compose.prod.yml"
cp "$SRC_ENV" "$OUT_DIR/.env"

LOBECHAT_IMAGE="${LOBECHAT_IMAGE:-$(read_template LOBECHAT_IMAGE)}"
POSTGRES_USER="${POSTGRES_USER:-paradedb}"
POSTGRES_DB="${POSTGRES_DB:-lobehub}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -hex 24)}"

for key in \
  AUTH_SECRET JWKS_KEY KEY_VAULTS_SECRET \
  AUTH_FEISHU_APP_ID AUTH_FEISHU_APP_SECRET AUTH_FEISHU_BLUE_APP_ID AUTH_FEISHU_BLUE_APP_SECRET \
  AZURE_API_KEY AZURE_IMAGE_API_KEY OPENAI_API_KEY OPENAI_PROXY_URL \
  VERTEXAI_PROJECT VERTEXAI_CREDENTIALS \
  REDIS_URL S3_ENDPOINT S3_BUCKET S3_PUBLIC_DOMAIN S3_REGION S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY \
  SMTP_USER SMTP_PASS; do
  require_value "$key"
done

ENV_FILE="$OUT_DIR/.env"

set_env "$ENV_FILE" LOBECHAT_IMAGE "$LOBECHAT_IMAGE"
set_env "$ENV_FILE" LOBECHAT_BIND "0.0.0.0"
set_env "$ENV_FILE" LOBECHAT_PORT "3210"
set_env "$ENV_FILE" APP_URL "https://chat.cotticoffee.com"
set_env "$ENV_FILE" INTERNAL_APP_URL "http://127.0.0.1:3210"
set_env "$ENV_FILE" AUTH_TRUST_HOST "true"
set_env "$ENV_FILE" AUTH_TRUSTED_ORIGINS "https://chat.cotticoffee.com,http://127.0.0.1:3210"
set_env "$ENV_FILE" PORT "3210"
set_env "$ENV_FILE" LOBE_PORT "3210"

set_env "$ENV_FILE" POSTGRES_IMAGE "paradedb/paradedb:0.22.3-pg17"
set_env "$ENV_FILE" PG_CLIENT_IMAGE "${PG_CLIENT_IMAGE:-postgres:18-alpine}"
set_env "$ENV_FILE" POSTGRES_USER "$POSTGRES_USER"
set_env "$ENV_FILE" POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
set_env "$ENV_FILE" POSTGRES_DB "$POSTGRES_DB"
set_env "$ENV_FILE" DATABASE_DRIVER "node"
set_env "$ENV_FILE" DATABASE_URL "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgresql:5432/${POSTGRES_DB}?sslmode=disable"

set_env "$ENV_FILE" SEARXNG_IMAGE "searxng/searxng:latest"
set_env "$ENV_FILE" SEARXNG_URL "http://searxng:8080"
set_env "$ENV_FILE" SEARCH_PROVIDERS "searxng"
set_env "$ENV_FILE" REDIS_PREFIX "lobechat_prod"

set_env "$ENV_FILE" APP_CPUS "${APP_CPUS:-2.0}"
set_env "$ENV_FILE" APP_MEM_LIMIT "${APP_MEM_LIMIT:-6g}"
set_env "$ENV_FILE" APP_PIDS_LIMIT "${APP_PIDS_LIMIT:-512}"
set_env "$ENV_FILE" POSTGRES_CPUS "${POSTGRES_CPUS:-2.0}"
set_env "$ENV_FILE" POSTGRES_MEM_LIMIT "${POSTGRES_MEM_LIMIT:-4g}"
set_env "$ENV_FILE" POSTGRES_PIDS_LIMIT "${POSTGRES_PIDS_LIMIT:-256}"
set_env "$ENV_FILE" POSTGRES_SHM_SIZE "${POSTGRES_SHM_SIZE:-1g}"
set_env "$ENV_FILE" SEARXNG_CPUS "${SEARXNG_CPUS:-0.75}"
set_env "$ENV_FILE" SEARXNG_MEM_LIMIT "${SEARXNG_MEM_LIMIT:-768m}"
set_env "$ENV_FILE" SEARXNG_PIDS_LIMIT "${SEARXNG_PIDS_LIMIT:-256}"
set_env "$ENV_FILE" LOG_MAX_SIZE "${LOG_MAX_SIZE:-50m}"
set_env "$ENV_FILE" LOG_MAX_FILE "${LOG_MAX_FILE:-3}"

set_env "$ENV_FILE" DEV_AUTH_BYPASS_ENABLED "0"
set_env "$ENV_FILE" DEV_AUTH_BYPASS_ALLOW_PROD "0"

cat > "$OUT_DIR/00-precheck.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

read_env() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { print substr($0, index($0, "=") + 1); exit }' .env
}

echo "== Host =="
hostname
df -h / /var/lib/docker 2>/dev/null || df -h
free -h || true

echo
echo "== Docker =="
docker version --format 'Client={{.Client.Version}} Server={{.Server.Version}}'
docker compose version

echo
echo "== Current Lobe containers =="
docker ps -a --filter name='lobe' --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' || true

echo
echo "== Resource isolation plan =="
printf 'compose_project=%s\n' 'lobechat-prod'
printf 'network=%s\n' 'lobechat_prod'
printf 'database_volume=%s\n' 'lobechat_postgresql_data'
printf 'app_limits=cpus:%s mem:%s pids:%s\n' "$(read_env APP_CPUS)" "$(read_env APP_MEM_LIMIT)" "$(read_env APP_PIDS_LIMIT)"
printf 'postgres_limits=cpus:%s mem:%s pids:%s shm:%s\n' "$(read_env POSTGRES_CPUS)" "$(read_env POSTGRES_MEM_LIMIT)" "$(read_env POSTGRES_PIDS_LIMIT)" "$(read_env POSTGRES_SHM_SIZE)"
printf 'searxng_limits=cpus:%s mem:%s pids:%s\n' "$(read_env SEARXNG_CPUS)" "$(read_env SEARXNG_MEM_LIMIT)" "$(read_env SEARXNG_PIDS_LIMIT)"
printf 'redis_prefix=%s\n' "$(read_env REDIS_PREFIX)"

echo
echo "== Compose config =="
docker compose -f docker-compose.prod.yml --env-file .env config >/tmp/lobechat-compose-prod.rendered.yml
echo "Rendered compose: /tmp/lobechat-compose-prod.rendered.yml"

echo
echo "== Pull images =="
docker compose -f docker-compose.prod.yml --env-file .env pull

echo
echo "== Port 3210 =="
if ss -ltnp 2>/dev/null | grep -q ':3210 '; then
  echo "Port 3210 is already in use. This is expected if old container 'lobehub' is still running."
  ss -ltnp | grep ':3210 ' || true
else
  echo "Port 3210 is free."
fi

echo
echo "Precheck finished. No traffic was switched."
SCRIPT

cat > "$OUT_DIR/01-start-middleware.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

read_env() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { print substr($0, index($0, "=") + 1); exit }' .env
}

POSTGRES_USER="$(read_env POSTGRES_USER)"
POSTGRES_DB="$(read_env POSTGRES_DB)"
POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD)"
PG_CLIENT_IMAGE="$(read_env PG_CLIENT_IMAGE)"
PG_CLIENT_IMAGE="${PG_CLIENT_IMAGE:-postgres:18-alpine}"

docker compose -f docker-compose.prod.yml --env-file .env up -d postgresql searxng
docker compose -f docker-compose.prod.yml --env-file .env ps

echo "Waiting for PostgreSQL..."
for _ in $(seq 1 60); do
  if docker compose -f docker-compose.prod.yml --env-file .env exec -T postgresql pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker compose -f docker-compose.prod.yml --env-file .env exec -T postgresql pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "Checking ParadeDB extension availability..."
docker run --rm --network lobechat_prod \
  -e PGPASSWORD="$POSTGRES_PASSWORD" \
  "$PG_CLIENT_IMAGE" \
  psql -h postgresql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 \
  -c "CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;" \
  -c "ALTER EXTENSION vector SET SCHEMA public;" \
  -c "CREATE EXTENSION IF NOT EXISTS pg_search;" \
  -c "SELECT to_regtype('public.vector') AS public_vector;" \
  -c "SELECT extname FROM pg_extension WHERE extname IN ('pg_search', 'vector') ORDER BY extname;"

echo "Middleware is ready. Old app was not stopped."
SCRIPT

cat > "$OUT_DIR/02-migrate-rds-to-local.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p backups

rollback_on_error() {
  echo "Migration failed. Restarting old app for rollback..."
  docker start lobehub || true
}

trap rollback_on_error ERR

read_env() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key { print substr($0, index($0, "=") + 1); exit }' .env
}

POSTGRES_USER="$(read_env POSTGRES_USER)"
POSTGRES_DB="$(read_env POSTGRES_DB)"
POSTGRES_PASSWORD="$(read_env POSTGRES_PASSWORD)"
PG_CLIENT_IMAGE="$(read_env PG_CLIENT_IMAGE)"
PG_CLIENT_IMAGE="${PG_CLIENT_IMAGE:-postgres:18-alpine}"

if ! docker inspect lobehub >/dev/null 2>&1; then
  echo "Old container 'lobehub' does not exist. Cannot discover old RDS DATABASE_URL." >&2
  exit 1
fi

OLD_DATABASE_URL="$(docker inspect lobehub --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{print substr($0,index($0,"=")+1)}')"
if [[ -z "$OLD_DATABASE_URL" ]]; then
  echo "Old container has no DATABASE_URL." >&2
  exit 1
fi

echo "Stopping old app to freeze writes..."
docker stop lobehub

DUMP_FILE="backups/lobechat-rds-$(date +%Y%m%d-%H%M%S).dump"
echo "Creating RDS dump at $DUMP_FILE"
docker run --rm --network host \
  -e OLD_DATABASE_URL="$OLD_DATABASE_URL" \
  -v "$PWD/backups:/backup" \
  "$PG_CLIENT_IMAGE" \
  sh -c 'pg_dump "$OLD_DATABASE_URL" -Fc --no-owner --no-acl -f "/backup/'"$(basename "$DUMP_FILE")"'"'

echo "Resetting target database..."
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgresql dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB"
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgresql createdb -U "$POSTGRES_USER" "$POSTGRES_DB"

echo "Ensuring required extensions exist before restore..."
docker run --rm --network lobechat_prod \
  -e PGPASSWORD="$POSTGRES_PASSWORD" \
  "$PG_CLIENT_IMAGE" \
  psql -h postgresql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 \
  -c "CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;" \
  -c "ALTER EXTENSION vector SET SCHEMA public;" \
  -c "CREATE EXTENSION IF NOT EXISTS pg_search;" \
  -c "SELECT to_regtype('public.vector') AS public_vector;" \
  -c "SELECT extname FROM pg_extension WHERE extname IN ('pg_search', 'vector') ORDER BY extname;"

echo "Restoring dump into Compose PostgreSQL..."
docker run --rm --network lobechat_prod \
  -e PGPASSWORD="$POSTGRES_PASSWORD" \
  -v "$PWD/backups:/backup" \
  "$PG_CLIENT_IMAGE" \
  pg_restore -h postgresql -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl "/backup/$(basename "$DUMP_FILE")"

echo "Ensuring required extensions exist after restore..."
docker run --rm --network lobechat_prod \
  -e PGPASSWORD="$POSTGRES_PASSWORD" \
  "$PG_CLIENT_IMAGE" \
  psql -h postgresql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 \
  -c "CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;" \
  -c "ALTER EXTENSION vector SET SCHEMA public;" \
  -c "CREATE EXTENSION IF NOT EXISTS pg_search;" \
  -c "SELECT to_regtype('public.vector') AS public_vector;" \
  -c "SELECT extname FROM pg_extension WHERE extname IN ('pg_search', 'vector') ORDER BY extname;"

trap - ERR
echo "Running app once lets built-in migrations finish during app startup."
echo "Migration restore finished. Old app remains stopped."
SCRIPT

cat > "$OUT_DIR/03-switch-new-app.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

rollback() {
  echo "Switch failed. Rolling back to old app..."
  docker compose -f docker-compose.prod.yml --env-file .env stop app || true
  docker start lobehub || true
}

trap rollback ERR

if docker inspect lobehub >/dev/null 2>&1; then
  docker stop lobehub || true
fi

docker compose -f docker-compose.prod.yml --env-file .env up -d app
docker compose -f docker-compose.prod.yml --env-file .env logs --tail=200 app

echo "Waiting for local health..."
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3210/ >/dev/null; then
    trap - ERR
    docker compose -f docker-compose.prod.yml --env-file .env ps
    echo "New app is healthy on 127.0.0.1:3210."
    exit 0
  fi
  sleep 2
done

echo "New app did not become healthy in time." >&2
exit 1
SCRIPT

cat > "$OUT_DIR/04-rollback-old-app.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

docker compose -f docker-compose.prod.yml --env-file .env stop app || true
docker start lobehub
docker ps --filter name='lobe' --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
curl -I http://127.0.0.1:3210/ || true
SCRIPT

cat > "$OUT_DIR/05-cleanup-old-app.sh" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

echo "This removes only the old app container/image after the new stack is stable."
echo "It keeps lobechat_postgresql_data."
docker rm lobehub
docker image ls | grep lobehub-custom || true
echo "Run manually if confirmed no rollback is needed: docker rmi lobehub-custom"
SCRIPT

cat > "$OUT_DIR/stage-to-production.sh" <<SCRIPT
#!/usr/bin/env bash
set -euo pipefail

PROD_HOST="\${PROD_HOST:-$PROD_HOST}"
PROD_DIR="\${PROD_DIR:-$PROD_DIR}"

ssh "root@\${PROD_HOST}" "mkdir -p '\${PROD_DIR}'"
scp docker-compose.prod.yml .env 0*.sh 05-cleanup-old-app.sh "root@\${PROD_HOST}:\${PROD_DIR}/"
ssh "root@\${PROD_HOST}" "cd '\${PROD_DIR}' && chmod 600 .env && chmod +x ./*.sh && ls -lah"
SCRIPT

cat > "$OUT_DIR/README.md" <<README
# LobeChat Production Package

Generated from local dev env: \`$SRC_ENV\`

Target host: \`$PROD_HOST\`
Target directory: \`$PROD_DIR\`
Image: \`$LOBECHAT_IMAGE\`

## Local upload

\`\`\`bash
cd "$OUT_DIR"
bash stage-to-production.sh
\`\`\`

## Production steps

\`\`\`bash
cd "$PROD_DIR"
bash 00-precheck.sh
bash 01-start-middleware.sh
bash 02-migrate-rds-to-local.sh
bash 03-switch-new-app.sh
\`\`\`

Rollback:

\`\`\`bash
cd "$PROD_DIR"
bash 04-rollback-old-app.sh
\`\`\`

Cleanup only after stability:

\`\`\`bash
cd "$PROD_DIR"
bash 05-cleanup-old-app.sh
\`\`\`

## Isolation

- Compose project: \`lobechat-prod\`
- Network: \`lobechat_prod\`
- Database volume: \`lobechat_postgresql_data\`
- App container: \`lobechat-app\`
- Database container: \`lobechat-postgresql\`
- Search container: \`lobechat-searxng\`
- PostgreSQL and SearXNG do not publish host ports.
- CPU, memory, pids, and log limits are set in \`.env\`.
README

chmod +x "$OUT_DIR"/*.sh

echo "Generated production package:"
echo "$OUT_DIR"
echo
echo "Sensitive file generated locally and not committed:"
echo "$OUT_DIR/.env"
