#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/release-lib.sh"
require_file "$RELEASE_STATE_FILE"
source "$RELEASE_STATE_FILE"

BACKUP_DIR="${MARKET_WARP_BACKUP_DIR:-}"
[[ -d "$BACKUP_DIR/files" ]] || fail "Market WARP backup is missing"

if [[ "${AUTO_APPROVE:-0}" != "1" ]]; then
  read -r -p "Type ROLLBACK-WARP to restore the previous WARP and DNS mode: " answer
  [[ "$answer" == "ROLLBACK-WARP" ]] || fail "Market WARP rollback aborted"
fi

/usr/local/sbin/lobehub-market-warp stop >/dev/null 2>&1 || true
systemctl disable --now lobehub-market-warp-refresh.timer lobehub-market-warp.service >/dev/null 2>&1 || true
systemctl disable --now redsocks >/dev/null 2>&1 || true
warp-cli disconnect >/dev/null 2>&1 || true

MANAGED_PATHS=(
  /etc/default/lobehub-market-warp
  /etc/default/redsocks
  /etc/redsocks-lobehub-market.conf
  /etc/resolv.conf
  /etc/systemd/resolved.conf.d/lobehub-market-direct-dns.conf
  /etc/systemd/system/lobehub-market-warp.service
  /etc/systemd/system/lobehub-market-warp-refresh.service
  /etc/systemd/system/lobehub-market-warp-refresh.timer
  /usr/local/sbin/lobehub-market-warp
)
for path in "${MANAGED_PATHS[@]}"; do
  rm -f "$path"
done
cp -a "$BACKUP_DIR/files/." /

systemctl daemon-reload
systemctl restart systemd-resolved
warp-cli mode "${MARKET_WARP_PREVIOUS_MODE:-warp+doh}"
warp-cli connect
write_release_state_value MARKET_WARP_UPDATED 0
write_release_state_value MARKET_WARP_ROLLED_BACK 1

echo "Previous WARP and DNS configuration restored."
warp-cli status
