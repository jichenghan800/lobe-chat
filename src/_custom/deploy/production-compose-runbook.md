# LobeHub v2.2.13 COTTI Production Release Runbook

## Scope

- Production host: `47.236.135.3`
- Deploy directory: `/opt/lobechat-main`
- Public domain: `https://chat.cotticoffee.com`
- Source release: immutable commit and ACR digest recorded in `release.env`
- Required services: `app`, `postgresql`, `qstash`, `searxng`

This release keeps PostgreSQL and QStash in place. The existing app remains
online while backup and database gates run. SearXNG is then upgraded independently
with a pinned image and functional search gate before the app service is switched.
Market-only WARP routing is a host-network step and does not modify Compose.

## Local release preparation

1. Keep the candidate branch clean and pushed.
2. Build from a clean `git archive` context. The build helper writes only
   `NEXT_PUBLIC_*` settings to the temporary context; development secrets are
   never copied into it.
3. Push the immutable tag to ACR and record its registry digest.
4. Generate the release package with that digest.

```bash
export TARGET_IMAGE=sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com/lobechat/lobehub:v2.2.13-cotti-prod-YYYYMMDD-<commit>

SOURCE_COMMIT=<commit> \
  src/_custom/deploy/build-production-image.sh

docker push "$TARGET_IMAGE"

TARGET_DIGEST=sha256:... \
  APP_SOURCE_COMMIT=<commit> \
  TARGET_IMAGE="$TARGET_IMAGE" \
  src/_custom/deploy/create-production-app-update-package.sh
```

## Production order

Extract the package into its own release directory. Do not extract it directly
over `/opt/lobechat-main`, because the existing Compose file must be backed up
before replacement.

```bash
mkdir -p /opt/lobechat-main/releases/<release>
cd /tmp
sha256sum -c <release>.tar.gz.sha256
tar -xzf /tmp/<release>.tar.gz -C /opt/lobechat-main/releases/<release>
cd /opt/lobechat-main/releases/<release>

bash prod-00-configure-market-warp.sh
bash prod-01-check-runtime.sh
bash prod-02-backup-and-migrate.sh
bash prod-03-switch-app.sh
bash prod-04-verify-app-update.sh
```

## Historical-data guarantees

`prod-02-backup-and-migrate.sh` cannot reach migration until all these gates
pass:

1. `pg_dump -Fc` succeeds and produces a non-empty archive.
2. `pg_restore -l` can read the archive and sees user and message data.
3. The archive is fully restored into a newly created temporary database.
4. The restored migration lineage is supported.
5. Exact row counts are recorded from the restored database for users, agents,
   topics, messages, files, documents, knowledge bases, connectors, tasks,
   task topics, operations, accounts, and sessions.
6. The temporary validation database is dropped after successful validation.
7. After migration, none of the recorded historical row counts may decrease.
8. A recent running Agent operation or Task run blocks the app switch so an
   in-flight user job is not interrupted by the release.

The backup, SHA-256 file, archive listing, configuration backups, and row-count
fingerprint remain under `/opt/lobechat-main/backups/`.

## Database order

1. Validate production is on COTTI migration `0118`, or a resumable `0119/0120`
   state.
2. Backfill `devices.visibility` while the existing application stays online:
   workspace devices become `public`, personal devices become `private`.
3. Create the `agents.created_at` and `topics.created_at` indexes with
   `CONCURRENTLY`.
4. Run `/app/docker.cjs` from the digest-verified target image to apply `0119`
   and `0120` before changing the running app.
5. Apply idempotent Topic Comment RBAC permissions and role grants.
6. Recheck migration lineage, required tables, device visibility, and history
   fingerprints.

## Runtime rollback

Use the release directory that performed the deployment:

```bash
bash prod-05-rollback-app.sh
```

This restores the previous `.env`, Compose definition, SearXNG settings, app
image, and search container. It does not restore PostgreSQL. The v2.2.13 schema
is expand-compatible with the previous app and is intentionally retained during
ordinary rollback.

WARP and DNS are intentionally independent from the application rollback. To
restore the previous full-tunnel mode and host resolver configuration:

```bash
bash prod-00-rollback-market-warp.sh
```

Database restoration is an incident action, not a release-script action. It
must be approved separately because restoring the pre-release dump overwrites
all writes made after the backup. Before any database restore, stop the app,
preserve a second dump of the failed state, record the incident cutoff time,
and explicitly accept the write-loss window.
