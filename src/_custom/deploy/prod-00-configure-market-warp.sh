#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/release-lib.sh"

[[ "$EUID" == "0" ]] || fail "Market WARP setup must run as root"
for command in apt-get curl docker getent ip iptables journalctl ss systemctl tar warp-cli; do
  require_command "$command"
done

DOCKER_NETWORK="${MARKET_WARP_DOCKER_NETWORK:-lobechat_prod}"
MARKET_DOMAINS="${MARKET_WARP_DOMAINS:-market.lobehub.com}"
WARP_PROXY_PORT="${MARKET_WARP_PROXY_PORT:-40000}"
REDSOCKS_PORT="${MARKET_WARP_REDSOCKS_PORT:-12345}"
IPSET_NAME="${MARKET_WARP_IPSET_NAME:-lobe_market_warp_v4}"
IPTABLES_CHAIN="${MARKET_WARP_IPTABLES_CHAIN:-LOBE_MARKET_WARP}"

NETWORK_ID="$(docker network inspect "$DOCKER_NETWORK" --format '{{.Id}}')"
NETWORK_GATEWAY="$(docker network inspect "$DOCKER_NETWORK" --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}')"
NETWORK_SUBNET="$(docker network inspect "$DOCKER_NETWORK" --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}')"
[[ -n "$NETWORK_ID" && -n "$NETWORK_GATEWAY" && -n "$NETWORK_SUBNET" ]] \
  || fail "unable to resolve Docker network $DOCKER_NETWORK"

PREVIOUS_WARP_MODE="warp+doh"
if warp-cli settings | grep -Fq 'Mode: WarpProxy'; then
  PREVIOUS_WARP_MODE="proxy"
elif warp-cli settings | grep -Fq 'Mode: WarpWithDnsOverTls'; then
  PREVIOUS_WARP_MODE="warp+dot"
elif warp-cli settings | grep -Fq 'Mode: WarpWithDnsOverHttps'; then
  PREVIOUS_WARP_MODE="warp+doh"
fi

STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP_DIR="$DEPLOY_DIR/backups/market-warp-before-${STAMP}"
mkdir -p "$BACKUP_DIR/files"
PRESERVED_PATHS=(
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
for path in "${PRESERVED_PATHS[@]}"; do
  if [[ -e "$path" || -L "$path" ]]; then
    cp -a --parents "$path" "$BACKUP_DIR/files"
    printf '%s\n' "$path" >> "$BACKUP_DIR/preserved-paths.txt"
  fi
done
warp-cli settings > "$BACKUP_DIR/warp-settings.txt"

write_release_state_value MARKET_WARP_BACKUP_DIR "$BACKUP_DIR"
write_release_state_value MARKET_WARP_PREVIOUS_MODE "$PREVIOUS_WARP_MODE"
write_release_state_value MARKET_WARP_UPDATED 0

SETUP_COMPLETE=0
rollback_on_exit() {
  local status="$?"
  if [[ "$status" != "0" && "$SETUP_COMPLETE" != "1" ]]; then
    echo "Market WARP setup failed; restoring the previous host network mode." >&2
    AUTO_APPROVE=1 bash "$SCRIPT_DIR/prod-00-rollback-market-warp.sh" || true
  fi
}
trap rollback_on_exit EXIT

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ipset redsocks

install -m 755 "$SCRIPT_DIR/market-warp-route.sh" /usr/local/sbin/lobehub-market-warp
cat > /etc/default/lobehub-market-warp <<EOF
MARKET_DOMAINS="$MARKET_DOMAINS"
DOCKER_NETWORK="$DOCKER_NETWORK"
WARP_PROXY_PORT="$WARP_PROXY_PORT"
REDSOCKS_PORT="$REDSOCKS_PORT"
IPSET_NAME="$IPSET_NAME"
IPTABLES_CHAIN="$IPTABLES_CHAIN"
EOF
cat > /etc/redsocks-lobehub-market.conf <<EOF
base {
  log_debug = off;
  log_info = on;
  log = "syslog:daemon";
  daemon = on;
  user = redsocks;
  group = redsocks;
  redirector = iptables;
}
redsocks {
  local_ip = $NETWORK_GATEWAY;
  local_port = $REDSOCKS_PORT;
  ip = 127.0.0.1;
  port = $WARP_PROXY_PORT;
  type = socks5;
}
EOF
cat > /etc/default/redsocks <<EOF
CONFFILE="/etc/redsocks-lobehub-market.conf"
EOF
mkdir -p /etc/systemd/resolved.conf.d
cat > /etc/systemd/resolved.conf.d/lobehub-market-direct-dns.conf <<'EOF'
[Resolve]
DNSStubListenerExtra=127.0.2.2
DNSStubListenerExtra=127.0.2.3
EOF
cat > /etc/systemd/system/lobehub-market-warp.service <<'EOF'
[Unit]
Description=Route LobeHub Market HTTPS traffic through WARP
After=network-online.target docker.service redsocks.service warp-svc.service
Wants=network-online.target
Requires=docker.service redsocks.service warp-svc.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/lobehub-market-warp start
ExecReload=/usr/local/sbin/lobehub-market-warp refresh
ExecStop=/usr/local/sbin/lobehub-market-warp stop
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/lobehub-market-warp-refresh.service <<'EOF'
[Unit]
Description=Refresh LobeHub Market destination addresses
After=lobehub-market-warp.service
Requires=lobehub-market-warp.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/lobehub-market-warp refresh
EOF
cat > /etc/systemd/system/lobehub-market-warp-refresh.timer <<'EOF'
[Unit]
Description=Refresh LobeHub Market destination addresses periodically

[Timer]
OnCalendar=*:0/5
RandomizedDelaySec=30s
Persistent=true
Unit=lobehub-market-warp-refresh.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
warp-cli disconnect

# Full-tunnel WARP owns 127.0.2.2/127.0.2.3. Release those listeners before
# systemd-resolved starts, otherwise Docker keeps forwarding to dead endpoints
# after WARP enters proxy mode.
rm -f /etc/resolv.conf
ln -s /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf
DIRECT_DNS_READY=0
for _ in $(seq 1 15); do
  systemctl restart systemd-resolved
  if ss -lunp | grep -F '127.0.2.2:53' | grep -Fq 'systemd-resolve' \
    && ss -lunp | grep -F '127.0.2.3:53' | grep -Fq 'systemd-resolve'; then
    DIRECT_DNS_READY=1
    break
  fi
  sleep 2
done
[[ "$DIRECT_DNS_READY" == "1" ]] \
  || fail "systemd-resolved could not take over Docker-compatible DNS listeners"
getent ahostsv4 market.lobehub.com >/dev/null
getent ahostsv4 login.microsoftonline.com >/dev/null

warp-cli proxy port "$WARP_PROXY_PORT"
warp-cli mode proxy
warp-cli connect

WARP_READY=0
for _ in $(seq 1 30); do
  if warp-cli status | grep -Fq 'Connected' && ss -ltn | grep -Fq ":${WARP_PROXY_PORT} "; then
    WARP_READY=1
    break
  fi
  sleep 2
done
[[ "$WARP_READY" == "1" ]] || fail "WARP SOCKS5 proxy did not become ready"
for listener in 127.0.2.2 127.0.2.3; do
  ss -lunp | grep -F "${listener}:53" | grep -Fq 'systemd-resolve' \
    || fail "systemd-resolved did not bind Docker-compatible DNS listener $listener"
done

WARP_MARKET_READY=0
for _ in $(seq 1 10); do
  WARP_MARKET_STATUS="$(
    curl --socks5-hostname "127.0.0.1:${WARP_PROXY_PORT}" \
      -sS -o /dev/null --connect-timeout 5 --max-time 20 -w '%{http_code}' \
      https://market.lobehub.com || true
  )"
  if [[ "$WARP_MARKET_STATUS" =~ ^[1-4][0-9][0-9]$ ]]; then
    WARP_MARKET_READY=1
    break
  fi
  sleep 3
done
[[ "$WARP_MARKET_READY" == "1" ]] \
  || fail "WARP SOCKS5 proxy cannot reach LobeHub Market"
echo "warp_market_http=$WARP_MARKET_STATUS"

systemctl enable --now redsocks
systemctl enable --now lobehub-market-warp.service lobehub-market-warp-refresh.timer

/usr/local/sbin/lobehub-market-warp status >/dev/null
APP_MARKET_READY=0
for attempt in $(seq 1 6); do
  if docker exec "$APP_CONTAINER" /bin/node -e "
  fetch('https://market.lobehub.com', { redirect: 'manual', signal: AbortSignal.timeout(20000) })
    .then((response) => {
      console.log('market_http=' + response.status);
      if (response.status >= 500) process.exit(2);
    })
    .catch((error) => {
      console.error(error.stack || error);
      if (error.cause) console.error('cause=' + (error.cause.stack || error.cause));
      process.exit(1);
    });
  "; then
    APP_MARKET_READY=1
    break
  fi
  echo "Market check from app failed (attempt ${attempt}/6); retrying." >&2
  sleep 5
done
if [[ "$APP_MARKET_READY" != "1" ]]; then
  /usr/local/sbin/lobehub-market-warp status || true
  iptables -t nat -L "$IPTABLES_CHAIN" -n -v || true
  journalctl -u redsocks --since '-5 minutes' --no-pager -n 80 || true
  fail "production app cannot reach LobeHub Market through WARP"
fi
write_release_state_value MARKET_WARP_UPDATED 1
SETUP_COMPLETE=1
trap - EXIT

echo "Market-only WARP routing enabled on $DOCKER_NETWORK ($NETWORK_SUBNET, gateway $NETWORK_GATEWAY)."
echo "Backup: $BACKUP_DIR"
