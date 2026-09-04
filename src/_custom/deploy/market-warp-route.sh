#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${MARKET_WARP_CONFIG_FILE:-/etc/default/lobehub-market-warp}"
source "$CONFIG_FILE"

log() {
  echo "[lobehub-market-warp] $*"
}

docker_network_details() {
  local network_id subnet gateway bridge
  network_id="$(docker network inspect "$DOCKER_NETWORK" --format '{{.Id}}')"
  subnet="$(docker network inspect "$DOCKER_NETWORK" --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}')"
  gateway="$(docker network inspect "$DOCKER_NETWORK" --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}')"
  bridge="br-${network_id:0:12}"
  [[ -n "$network_id" && -n "$subnet" && -n "$gateway" ]] || return 1
  ip link show "$bridge" >/dev/null 2>&1 || return 1
  printf '%s\n%s\n%s\n' "$bridge" "$subnet" "$gateway"
}

resolve_market_ips() {
  local domain
  for domain in $MARKET_DOMAINS; do
    getent ahostsv4 "$domain" | awk '$2 == "STREAM" { print $1 }'
  done | sort -u
}

refresh_ipset() {
  local temporary_set="${IPSET_NAME}_next" addresses
  addresses="$(resolve_market_ips)"
  if [[ -z "$addresses" ]]; then
    log "DNS returned no IPv4 addresses; retaining the previous destination set"
    return 1
  fi

  ipset create "$IPSET_NAME" hash:ip family inet -exist
  ipset create "$temporary_set" hash:ip family inet -exist
  ipset flush "$temporary_set"
  while read -r address; do
    [[ -n "$address" ]] && ipset add "$temporary_set" "$address" -exist
  done <<< "$addresses"
  ipset swap "$temporary_set" "$IPSET_NAME"
  ipset destroy "$temporary_set"
  log "Resolved $MARKET_DOMAINS to: $(tr '\n' ' ' <<< "$addresses" | sed 's/[[:space:]]*$//')"
}

remove_prerouting_hooks() {
  local rule_number
  while true; do
    rule_number="$(iptables -t nat -L PREROUTING --line-numbers -n 2>/dev/null | awk -v chain="$IPTABLES_CHAIN" '$2 == chain { print $1; exit }')"
    [[ -z "$rule_number" ]] && break
    iptables -t nat -D PREROUTING "$rule_number"
  done
}

remove_input_hooks() {
  local rule_number
  while true; do
    rule_number="$(
      iptables -L INPUT --line-numbers -n 2>/dev/null \
        | awk '/LobeHub Market redsocks/ { print $1; exit }'
    )"
    [[ -z "$rule_number" ]] && break
    iptables -D INPUT "$rule_number"
  done
}

install_rules() {
  local details bridge subnet gateway
  mapfile -t details < <(docker_network_details)
  bridge="${details[0]}"
  subnet="${details[1]}"
  gateway="${details[2]}"

  iptables -t nat -N "$IPTABLES_CHAIN" 2>/dev/null || true
  iptables -t nat -F "$IPTABLES_CHAIN"
  iptables -t nat -A "$IPTABLES_CHAIN" -p tcp --dport 443 \
    -m set --match-set "$IPSET_NAME" dst \
    -m comment --comment "LobeHub Market via WARP" \
    -j REDIRECT --to-ports "$REDSOCKS_PORT"
  remove_prerouting_hooks
  iptables -t nat -I PREROUTING 1 -i "$bridge" -s "$subnet" \
    -m comment --comment "LobeHub Market containers" -j "$IPTABLES_CHAIN"
  remove_input_hooks
  iptables -I INPUT 1 -i "$bridge" -s "$subnet" -d "$gateway" \
    -p tcp --dport "$REDSOCKS_PORT" \
    -m comment --comment "LobeHub Market redsocks" -j ACCEPT
  log "Installed HTTPS routing on $bridge ($subnet)"
}

stop_routing() {
  remove_prerouting_hooks
  remove_input_hooks
  iptables -t nat -F "$IPTABLES_CHAIN" 2>/dev/null || true
  iptables -t nat -X "$IPTABLES_CHAIN" 2>/dev/null || true
  ipset destroy "$IPSET_NAME" 2>/dev/null || true
  ipset destroy "${IPSET_NAME}_next" 2>/dev/null || true
}

case "${1:-refresh}" in
  refresh|start)
    refresh_ipset
    install_rules
    ;;
  stop)
    stop_routing
    ;;
  status)
    warp-cli status
    systemctl is-active redsocks
    ipset list "$IPSET_NAME"
    iptables -t nat -S "$IPTABLES_CHAIN"
    iptables -S INPUT | grep -F 'LobeHub Market redsocks'
    ;;
  *)
    echo "Usage: $0 {start|refresh|stop|status}" >&2
    exit 2
    ;;
esac
