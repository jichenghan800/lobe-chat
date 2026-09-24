#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../../.."
: "${LINGSHU_IMAGE_TAG:?Set LINGSHU_IMAGE_TAG to a new immutable acceptance image tag}"
if docker image inspect "$LINGSHU_IMAGE_TAG" >/dev/null 2>&1; then
  echo "Choose an unused image tag." >&2
  exit 1
fi
export NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS=1
export NEXT_PUBLIC_COTTI_FEISHU_SUPPORT_URL='https://applink.feishu.cn/client/chat/open?openId=ou_2f3bf7b5efa5fd9b70d5d5993b3a2e82'
export APP_URL=http://app.com
export DATABASE_DRIVER=node
export DATABASE_URL=postgres://postgres:build-only@127.0.0.1:1/build
export AUTH_SECRET=build-only
export KEY_VAULTS_SECRET=build-only
export NEXT_TELEMETRY_DISABLED=1
pnpm run build:docker
python3 - <<'PY'
from pathlib import Path
import shutil, subprocess
context=Path('.records/v2218-build')
context.mkdir(parents=True,exist_ok=True)
for name,source in [('standalone','.next/standalone'),('static','.next/static'),('public','public'),('migrations','packages/database/migrations'),('shared','scripts/_shared')]:
 target=context/name
 if target.exists(): shutil.rmtree(target)
 subprocess.run(['cp','-a','--reflink=auto',source,str(target)],check=True)
for source,name in [('scripts/serverLauncher/startServer.js','startServer.js'),('scripts/migrateServerDB/errorHint.js','errorHint.js'),('src/_custom/deploy/v2218/Dockerfile','Dockerfile')]:
 shutil.copy2(source,context/name)
assert not (context/'standalone/.env').exists()
assert not (context/'standalone/.records').exists()
PY
# Standalone traces do not expose drizzle-orm at the root. Bundle the official
# migrator while retaining its pg driver, which is already present in standalone.
pnpm exec esbuild scripts/migrateServerDB/docker.cjs --bundle --platform=node --format=cjs --external:pg --outfile=.records/v2218-build/docker.cjs
docker build -t "$LINGSHU_IMAGE_TAG" .records/v2218-build
