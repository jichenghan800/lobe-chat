#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../../../.."
context_dir='.records/native-v2216/shared-qstash-image-context'
mkdir -p "$context_dir"
cp scripts/serverLauncher/startServer.js "$context_dir/startServer.js"
cp src/_custom/deploy/native-v2216/shared-qstash/Dockerfile "$context_dir/Dockerfile"
docker build -t lobehub:cotti-v2216-shared-qstash-20260907 "$context_dir"
