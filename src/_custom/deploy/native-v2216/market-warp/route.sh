#!/usr/bin/env bash
set -euo pipefail
# Extend the existing Market-only WARP transport to the v2.2.16 network.
# Keep the original network's rules and redsocks listener unchanged.
network=cotti-v2216-native_default
network_id=$(docker network inspect "$network" --format '{{.Id}}')
subnet=$(docker network inspect "$network" --format '{{(index .IPAM.Config 0).Subnet}}')
bridge="br-${network_id:0:12}"
proxy_gateway=$(docker network inspect lobehub_default --format '{{(index .IPAM.Config 0).Gateway}}')
proxy_port=12345
mark='COTTI v2216 Market WARP'
nat_rule=(-i "$bridge" -s "$subnet" -p tcp --dport 443 -m set --match-set lobe_market_warp_v4 dst -m comment --comment "$mark" -j DNAT --to-destination "$proxy_gateway:$proxy_port")
input_rule=(-i "$bridge" -s "$subnet" -d "$proxy_gateway" -p tcp --dport "$proxy_port" -m comment --comment "$mark" -j ACCEPT)
case "${1:-start}" in
 start)
  ipset list lobe_market_warp_v4 >/dev/null
  iptables -C INPUT "${input_rule[@]}" 2>/dev/null || iptables -I INPUT 1 "${input_rule[@]}"
  iptables -t nat -C PREROUTING "${nat_rule[@]}" 2>/dev/null || iptables -t nat -I PREROUTING 1 "${nat_rule[@]}"
  ;;
 stop)
  if iptables -t nat -C PREROUTING "${nat_rule[@]}" 2>/dev/null; then iptables -t nat -D PREROUTING "${nat_rule[@]}"; fi
  if iptables -C INPUT "${input_rule[@]}" 2>/dev/null; then iptables -D INPUT "${input_rule[@]}"; fi
  ;;
 *) echo 'Usage: route.sh start|stop' >&2; exit 2;;
esac
