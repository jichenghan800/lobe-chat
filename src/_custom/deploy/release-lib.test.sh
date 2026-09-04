#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TEST_DIR="$(mktemp -d /tmp/lobechat-release-lib-test.XXXXXX)"

grep -Fq 'platform-analytics-*.js' "$ROOT_DIR/src/_custom/deploy/build-production-image.sh"
if grep -Fq 'platformManagement-*.js' "$ROOT_DIR/src/_custom/deploy/build-production-image.sh"; then
  echo 'production build still checks the obsolete platform asset name' >&2
  exit 1
fi

COMPOSE_FILE="$ROOT_DIR/src/_custom/deploy/docker-compose.prod.yml"
PACKAGE_BUILDER="$ROOT_DIR/src/_custom/deploy/create-production-app-update-package.sh"
MARKET_WARP_INSTALLER="$ROOT_DIR/src/_custom/deploy/prod-00-configure-market-warp.sh"
MARKET_WARP_ROUTER="$ROOT_DIR/src/_custom/deploy/market-warp-route.sh"
SWITCH_SCRIPT="$ROOT_DIR/src/_custom/deploy/prod-03-switch-app.sh"

grep -Fq 'searxng/searxng:2026.9.1-18af21159@sha256:c7cc75852051bf6254afda6ed1b920dd1677d8efe4ab141bf558f02e582f4371' "$COMPOSE_FILE"
grep -Fq 'SEARXNG_SECRET: ${SEARXNG_SECRET:?Set SEARXNG_SECRET in .env}' "$COMPOSE_FILE"
grep -Fq 'condition: service_healthy' "$COMPOSE_FILE"
grep -Fq 'searxng-settings.yml' "$PACKAGE_BUILDER"
grep -Fq 'prod-00-configure-market-warp.sh' "$PACKAGE_BUILDER"
grep -Fq 'MARKET_WARP_DOCKER_NETWORK:-lobechat_prod' "$MARKET_WARP_INSTALLER"
grep -Fq 'WARP SOCKS5 proxy cannot reach LobeHub Market' "$MARKET_WARP_INSTALLER"
grep -Fq 'production app cannot reach LobeHub Market through WARP' "$MARKET_WARP_INSTALLER"
grep -Fq 'trap rollback_on_exit EXIT' "$MARKET_WARP_INSTALLER"
grep -Fq 'Release those listeners before' "$MARKET_WARP_INSTALLER"
grep -Fq 'systemd-resolved could not take over Docker-compatible DNS listeners' "$MARKET_WARP_INSTALLER"
if grep -Fq '172.21.0.1' "$MARKET_WARP_ROUTER"; then
  echo 'Market WARP router still hard-codes the development Docker gateway' >&2
  exit 1
fi
grep -Fq -- '--comment "LobeHub Market redsocks" -j ACCEPT' "$MARKET_WARP_ROUTER"
grep -Fq 'remove_input_hooks' "$MARKET_WARP_ROUTER"
grep -Fq 'wait_for_searxng_health' "$SWITCH_SCRIPT"
grep -Fq 'verify_searxng_search' "$SWITCH_SCRIPT"

printf 'POSTGRES_USER=test\nPOSTGRES_DB=test\n' > "$TEST_DIR/.env"
printf 'users\t2\nmessages\t5\n' > "$TEST_DIR/history.tsv"

DEPLOY_DIR="$TEST_DIR"
ENV_FILE=.env
RELEASE_ENV_FILE="$TEST_DIR/missing-release.env"
RELEASE_CONFIG_FILE="$TEST_DIR/missing-release-config.env"

# shellcheck source=release-lib.sh
source "$ROOT_DIR/src/_custom/deploy/release-lib.sh"

set_env "$ENV_FILE" QWEN_MODEL_LIST '-all,+qwen3.7-plus=千问3.7-Plus<262144:reasoning:search>'
append_env_csv_entry \
  QWEN_MODEL_LIST \
  qwen3.8-max-0902 \
  '+qwen3.8-max-0902=千问3.8-Max<1000000:reasoning:vision:fc:video:search>'
append_env_csv_entry \
  QWEN_MODEL_LIST \
  qwen3.8-max-0902 \
  '+qwen3.8-max-0902=千问3.8-Max<1000000:reasoning:vision:fc:video:search>'
model_list="$(read_env QWEN_MODEL_LIST)"
grep -Fq '+qwen3.7-plus=千问3.7-Plus' <<< "$model_list"
[[ "$(grep -o 'qwen3.8-max-0902' <<< "$model_list" | wc -l)" == "1" ]]

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
