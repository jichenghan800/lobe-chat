#!/usr/bin/env bash
set -euo pipefail

REGISTRY_HOST="${WARP_REGISTRY_HOST:-sg-ai-han-registry.ap-southeast-1.cr.aliyuncs.com}"
SSH_BYPASS_IPS="${WARP_SSH_BYPASS_IPS:-8.222.230.244 47.236.135.3}"
read -r -a SSH_BYPASS_IP_LIST <<<"$SSH_BYPASS_IPS"

if ! command -v warp-cli >/dev/null 2>&1; then
  echo "Cloudflare WARP is not installed; no split-tunnel exclusions are required."
  exit 0
fi

host_is_excluded() {
  warp-cli tunnel host list | awk -v host="$1" '$1 == host { found = 1 } END { exit found ? 0 : 1 }'
}

ip_is_excluded() {
  warp-cli tunnel ip list | awk -v ip="$1" '$1 == ip || $1 == ip "/32" { found = 1 } END { exit found ? 0 : 1 }'
}

mapfile -t REGISTRY_BYPASS_IP_LIST < <(
  getent ahostsv4 "$REGISTRY_HOST" | awk '$2 == "STREAM" { print $1 }' | sort -u
)
[[ "${#REGISTRY_BYPASS_IP_LIST[@]}" -gt 0 ]] || {
  echo "Unable to resolve registry host: $REGISTRY_HOST" >&2
  exit 1
}

echo "== WARP status =="
warp-cli status

echo
echo "== Configure release exclusions =="
if host_is_excluded "$REGISTRY_HOST"; then
  echo "Registry host already excluded: $REGISTRY_HOST"
else
  warp-cli tunnel host add "$REGISTRY_HOST"
fi

for ip in "${REGISTRY_BYPASS_IP_LIST[@]}" "${SSH_BYPASS_IP_LIST[@]}"; do
  if ip_is_excluded "$ip"; then
    echo "IP already excluded: $ip"
  else
    warp-cli tunnel ip add "$ip"
  fi
done

echo
echo "== Registry network =="
for attempt in $(seq 1 10); do
  if getent ahostsv4 "$REGISTRY_HOST" >/dev/null 2>&1 \
    && curl -sS -o /dev/null --connect-timeout 5 --max-time 10 "https://${REGISTRY_HOST}/v2/"; then
    echo "Registry reachable: $REGISTRY_HOST"
    exit 0
  fi
  echo "Registry attempt $attempt/10 failed"
  sleep 1
done

echo "Registry remains unreachable after WARP exclusions." >&2
exit 1
