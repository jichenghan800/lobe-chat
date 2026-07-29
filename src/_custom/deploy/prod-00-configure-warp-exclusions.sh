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
  local host="$1"
  warp-cli tunnel host list | awk -v host="$host" '
    $1 == host { found = 1 }
    END { exit found ? 0 : 1 }
  '
}

ip_is_excluded() {
  local ip="$1"
  warp-cli tunnel ip list | awk -v ip="$ip" '
    $1 == ip || $1 == ip "/32" { found = 1 }
    END { exit found ? 0 : 1 }
  '
}

wait_for_registry_network() {
  for _ in $(seq 1 10); do
    if getent ahostsv4 "$REGISTRY_HOST" >/dev/null 2>&1 \
      && curl -sS -o /dev/null --connect-timeout 5 --max-time 10 "https://${REGISTRY_HOST}/v2/"; then
      echo "Registry DNS and HTTPS are reachable: $REGISTRY_HOST"
      return 0
    fi

    sleep 1
  done

  echo "Registry DNS or HTTPS is still unreachable after configuring WARP exclusions: $REGISTRY_HOST" >&2
  exit 1
}

mapfile -t REGISTRY_BYPASS_IP_LIST < <(
  getent ahostsv4 "$REGISTRY_HOST" | awk '$2 == "STREAM" { print $1 }' | sort -u
)

if [[ "${#REGISTRY_BYPASS_IP_LIST[@]}" == "0" ]]; then
  echo "Unable to resolve the registry host: $REGISTRY_HOST" >&2
  exit 1
fi

echo "== Cloudflare WARP status =="
warp-cli status

echo
echo "== Configure split-tunnel exclusions =="
if host_is_excluded "$REGISTRY_HOST"; then
  echo "Registry host is already excluded: $REGISTRY_HOST"
else
  warp-cli tunnel host add "$REGISTRY_HOST"
  echo "Excluded registry host: $REGISTRY_HOST"
fi

for ip in "${REGISTRY_BYPASS_IP_LIST[@]}"; do
  if ip_is_excluded "$ip"; then
    echo "Registry IP is already excluded: $ip"
  else
    warp-cli tunnel ip add "$ip"
    echo "Excluded registry IP: $ip"
  fi
done

for ip in "${SSH_BYPASS_IP_LIST[@]}"; do
  if ip_is_excluded "$ip"; then
    echo "SSH IP is already excluded: $ip"
  else
    warp-cli tunnel ip add "$ip"
    echo "Excluded SSH IP: $ip"
  fi
done

echo
echo "== Active release exclusions =="
warp-cli tunnel host list | awk -v host="$REGISTRY_HOST" '$1 == host'
for ip in "${REGISTRY_BYPASS_IP_LIST[@]}"; do
  warp-cli tunnel ip list | awk -v ip="$ip" '$1 == ip || $1 == ip "/32"'
done
for ip in "${SSH_BYPASS_IP_LIST[@]}"; do
  warp-cli tunnel ip list | awk -v ip="$ip" '$1 == ip || $1 == ip "/32"'
done

echo
echo "== Registry network check =="
wait_for_registry_network

echo
echo "WARP exclusions configured."
echo "Rollback commands:"
echo "  warp-cli tunnel host remove $REGISTRY_HOST"
for ip in "${REGISTRY_BYPASS_IP_LIST[@]}"; do
  echo "  warp-cli tunnel ip remove $ip"
done
for ip in "${SSH_BYPASS_IP_LIST[@]}"; do
  echo "  warp-cli tunnel ip remove $ip"
done
