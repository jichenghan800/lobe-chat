# LobeChat Production Compose Runbook

This runbook prepares `chat.cotticoffee.com` to run LobeChat, ParadeDB/PostgreSQL,
and SearXNG from one Docker Compose stack.

## Target

- Production host: `47.236.135.3`
- Deploy directory: `/opt/lobechat-main`
- Public domain: `https://chat.cotticoffee.com`
- Old app container kept for rollback: `lobehub`
- New app container: `lobechat-app`
- New database container: `lobechat-postgresql`
- New search container: `lobechat-searxng`
- Compose network: `lobechat_prod`
- Database volume: `lobechat_postgresql_data`

Only the app publishes a host port. PostgreSQL and SearXNG stay private on the
Compose network.

## Same-Host Isolation

The production host also runs other services. This stack is isolated as follows:

- Compose project name: `lobechat-prod`
- Dedicated Docker network: `lobechat_prod`
- Dedicated database volume: `lobechat_postgresql_data`
- Dedicated container names: `lobechat-app`, `lobechat-postgresql`, `lobechat-searxng`
- PostgreSQL and SearXNG do not publish host ports.
- App, PostgreSQL, and SearXNG have configurable CPU, memory, pids, and log-size limits.
- External Redis is still shared, but production uses `REDIS_PREFIX=lobechat_prod` to keep keyspace
  separate from dev.

Default limits:

```bash
APP_CPUS=2.0
APP_MEM_LIMIT=6g
POSTGRES_CPUS=2.0
POSTGRES_MEM_LIMIT=4g
POSTGRES_SHM_SIZE=1g
SEARXNG_CPUS=0.75
SEARXNG_MEM_LIMIT=768m
LOG_MAX_SIZE=50m
LOG_MAX_FILE=3
```

## Recommended Package Flow

Generate the production package locally from the dev `.env`. This keeps provider/auth/S3/SMTP/Redis
secrets consistent with dev, then applies the production-only overrides:

```bash
src/_custom/deploy/generate-production-package.sh
```

The generated package is written under `src/_custom/deploy/dist/` and is intentionally ignored by
Git because it contains the real production `.env`.

Upload the generated package:

```bash
cd src/_custom/deploy/dist/<generated-package>
bash stage-to-production.sh
```

Then run on the production host:

```bash
cd /opt/lobechat-main
bash 00-precheck.sh
bash 01-start-middleware.sh
bash 02-migrate-rds-to-local.sh
bash 03-switch-new-app.sh
```

Rollback remains one command:

```bash
cd /opt/lobechat-main
bash 04-rollback-old-app.sh
```

## Required `.env` Changes

Use `.env.production.example` as the sanitized reference. The recommended path is to generate the
real production `.env` from dev with `generate-production-package.sh`; do not commit the generated
`.env`.

At minimum, confirm these values before running Compose:

```bash
LOBECHAT_IMAGE=sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com/lobechat/lobehub:v2.2.1-cotti-20260531-212414-ea0b6997f2-eef7f94
POSTGRES_USER=paradedb
POSTGRES_PASSWORD=<new-strong-password>
POSTGRES_DB=lobehub
LOBECHAT_PORT=3210
LOBECHAT_BIND=0.0.0.0
```

The Compose file overrides these runtime values for production:

```bash
APP_URL=https://chat.cotticoffee.com
AUTH_TRUSTED_ORIGINS=https://chat.cotticoffee.com,http://127.0.0.1:3210
DATABASE_URL=postgres://paradedb:<password>@postgresql:5432/lobehub?sslmode=disable
INTERNAL_APP_URL=http://127.0.0.1:3210
SEARXNG_URL=http://searxng:8080
```

Keep external Redis, S3, SMTP, auth, and model provider secrets in `.env`.

## Publish Image

Build and push an immutable image tag before production deployment:

```bash
docker tag lobehub-cotti:v2.2.1-cotti-market-auth-recovery \
  sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com/lobechat/lobehub:v2.2.1-cotti-20260531-212414-ea0b6997f2-eef7f94

docker push sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com/lobechat/lobehub:v2.2.1-cotti-20260531-212414-ea0b6997f2-eef7f94
```

Then set the same image in production `.env` as `LOBECHAT_IMAGE`.

Current pushed image:

```bash
sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com/lobechat/lobehub:v2.2.1-cotti-20260531-212414-ea0b6997f2-eef7f94
```

Registry digest:

```bash
sha256:d69b5f1d1f9e2ba156e68cb70addc003945ff9f0e2521a5f382a2be04c36ef9d
```

## Stage Files

```bash
ssh root@47.236.135.3 'mkdir -p /opt/lobechat-main/backups'

scp docker-compose.prod.yml root@47.236.135.3:/opt/lobechat-main/
```

Do not copy secrets through Git. Maintain production `.env` on the server.

Validate the Compose file before starting services:

```bash
ssh root@47.236.135.3 '
cd /opt/lobechat-main &&
docker compose -f docker-compose.prod.yml config >/tmp/lobechat-compose-prod.rendered.yml
'
```

## Pre-Pull Without Downtime

```bash
ssh root@47.236.135.3 '
cd /opt/lobechat-main &&
docker compose -f docker-compose.prod.yml pull
'
```

## Start Database and Search

This does not stop the old `lobehub` app.

```bash
ssh root@47.236.135.3 '
cd /opt/lobechat-main &&
docker compose -f docker-compose.prod.yml up -d postgresql searxng &&
docker compose -f docker-compose.prod.yml ps
'
```

## Migration Window

Stop the old app first so the Aliyun RDS database stops receiving writes:

```bash
ssh root@47.236.135.3 'docker stop lobehub'
```

Extract the old RDS connection string from the old container without printing it:

```bash
ssh root@47.236.135.3 '
OLD_DATABASE_URL="$(docker inspect lobehub --format "{{range .Config.Env}}{{println .}}{{end}}" | awk -F= '"'"'$1=="DATABASE_URL"{print substr($0,index($0,"=")+1)}'"'"')" &&
test -n "$OLD_DATABASE_URL" &&
mkdir -p /opt/lobechat-main/backups &&
docker run --rm --network host \
  -e OLD_DATABASE_URL="$OLD_DATABASE_URL" \
  -v /opt/lobechat-main/backups:/backup \
  postgres:17-alpine \
  sh -c '"'"'pg_dump "$OLD_DATABASE_URL" -Fc --no-owner --no-acl -f /backup/lobechat-rds-$(date +%Y%m%d-%H%M%S).dump'"'"'
'
```

Restore the newest dump into the Compose-managed ParadeDB database:

```bash
ssh root@47.236.135.3 '
cd /opt/lobechat-main &&
POSTGRES_USER="$(awk -F= '"'"'$1=="POSTGRES_USER"{print substr($0,index($0,"=")+1)}'"'"' .env)" &&
POSTGRES_PASSWORD="$(awk -F= '"'"'$1=="POSTGRES_PASSWORD"{print substr($0,index($0,"=")+1)}'"'"' .env)" &&
POSTGRES_DB="$(awk -F= '"'"'$1=="POSTGRES_DB"{print substr($0,index($0,"=")+1)}'"'"' .env)" &&
POSTGRES_USER="${POSTGRES_USER:-paradedb}" &&
POSTGRES_DB="${POSTGRES_DB:-lobehub}" &&
test -n "$POSTGRES_PASSWORD" &&
DUMP_FILE="$(ls -t /opt/lobechat-main/backups/lobechat-rds-*.dump | head -1)" &&
docker compose -f docker-compose.prod.yml exec -T postgresql dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB" &&
docker compose -f docker-compose.prod.yml exec -T postgresql createdb -U "$POSTGRES_USER" "$POSTGRES_DB" &&
docker run --rm --network lobechat_prod \
  -e PGPASSWORD="$POSTGRES_PASSWORD" \
  -v /opt/lobechat-main/backups:/backup \
  postgres:17-alpine \
  pg_restore -h postgresql -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl "/backup/$(basename "$DUMP_FILE")"
'
```

## Start New App

```bash
ssh root@47.236.135.3 '
cd /opt/lobechat-main &&
docker compose -f docker-compose.prod.yml up -d app &&
docker compose -f docker-compose.prod.yml logs --tail=200 app &&
docker compose -f docker-compose.prod.yml ps
'
```

Verify:

```bash
ssh root@47.236.135.3 '
curl -I http://127.0.0.1:3210/ &&
curl -I https://chat.cotticoffee.com/
'
```

Manual checks:

- Login works.
- Existing users are present.
- Existing sessions and memories are present.
- Main chat model works.
- Search works through the configured policy.
- Image generation works if enabled.
- Hidden settings and provider management entries remain hidden.

## Fast Rollback

Rollback keeps the old RDS-backed app available. Stop the new app and start the
old container:

```bash
ssh root@47.236.135.3 '
cd /opt/lobechat-main &&
docker compose -f docker-compose.prod.yml stop app &&
docker start lobehub &&
docker ps | grep -E "lobehub|lobechat"
'
```

Important: data written after users enter the new app is stored in the new local
database and is not automatically written back to the old Aliyun RDS database.
Use rollback quickly if needed.

## Cleanup After Stability

After the new stack is stable:

```bash
ssh root@47.236.135.3 '
docker rm lobehub &&
docker image ls | grep lobehub-custom || true
'
```

Remove the old image only after confirming it is no longer needed:

```bash
ssh root@47.236.135.3 'docker rmi lobehub-custom'
```

Keep `lobechat_postgresql_data`. It contains the new production database.

Migration dumps can be removed later:

```bash
ssh root@47.236.135.3 'ls -lh /opt/lobechat-main/backups'
```
