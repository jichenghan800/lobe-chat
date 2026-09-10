#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../../../.."
# Build with inert credentials. Runtime credentials are only supplied to docker run/compose.
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
import shutil,subprocess
source=Path('.next/standalone')
assert source.is_dir()
assert not any(p.name.startswith('.env') or p.name=='.records' for p in source.rglob('*'))
context=Path('.records/native-v2216/cotti-branding-image-context')
context.mkdir(parents=True,exist_ok=True)
for name,src in [('standalone',source),('static',Path('.next/static')),('public',Path('public')),('migrations',Path('packages/database/migrations'))]:
 target=context/name
 if target.exists():shutil.rmtree(target)
 subprocess.run(['cp','-a','--reflink=auto',str(src),str(target)],check=True)
shutil.copyfile('src/_custom/deploy/native-v2216/cotti-branding/Dockerfile',context/'Dockerfile')
shutil.copyfile('scripts/serverLauncher/startServer.js',context/'startServer.js')
PY
docker build -t lobehub:cotti-v2216-cotti-branding-20260908 .records/native-v2216/cotti-branding-image-context
