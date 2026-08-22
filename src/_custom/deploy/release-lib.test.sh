#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TEST_DIR="$(mktemp -d /tmp/lobechat-release-lib-test.XXXXXX)"

printf 'POSTGRES_USER=test\nPOSTGRES_DB=test\n' > "$TEST_DIR/.env"
printf 'users\t2\nmessages\t5\n' > "$TEST_DIR/history.tsv"

DEPLOY_DIR="$TEST_DIR"
ENV_FILE=.env
RELEASE_ENV_FILE="$TEST_DIR/missing-release.env"
RELEASE_CONFIG_FILE="$TEST_DIR/missing-release-config.env"

# shellcheck source=release-lib.sh
source "$ROOT_DIR/src/_custom/deploy/release-lib.sh"

db_scalar() {
  # Simulate docker compose exec attempting to consume its inherited stdin.
  local ignored
  IFS= read -r ignored || true
  case "$1" in
    *'"users"'*) printf '2' ;;
    *'"messages"'*) printf '5' ;;
    *) return 1 ;;
  esac
}

assert_history_not_decreased "$TEST_DIR/history.tsv" > "$TEST_DIR/output.log"
output="$(<"$TEST_DIR/output.log")"

grep -Fq 'users baseline=2 current=2' <<< "$output"
grep -Fq 'messages baseline=5 current=5' <<< "$output"

docker_mode=valid
docker() {
  if [[ "$*" == *'find /app/public/_spa/assets'* ]]; then
    [[ "$docker_mode" != missing ]] && printf '/app/public/_spa/assets/platform-analytics-test.js\n'
    return 0
  fi
  if [[ "$*" == *'NEXT_PUBLIC_COTTI_SHOW_PLATFORM_ANALYTICS'* ]]; then
    [[ "$docker_mode" == raw_marker ]]
    return
  fi
  return 1
}

output="$(verify_platform_management_asset)"
grep -Fq 'platform_management_asset=platform-analytics-test.js' <<< "$output"

docker_mode=missing
if (verify_platform_management_asset >/dev/null 2>&1); then
  echo 'missing platform asset was not rejected' >&2
  exit 1
fi

docker_mode=raw_marker
if (verify_platform_management_asset >/dev/null 2>&1); then
  echo 'raw platform build flag was not rejected' >&2
  exit 1
fi

echo 'release-lib regression tests passed'
