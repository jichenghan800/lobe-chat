#!/usr/bin/env bash

set -uo pipefail

PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'

STATE_DIR="${STATE_DIR:-/var/lib/warp-egress-watchdog}"
FAILURE_THRESHOLD="${FAILURE_THRESHOLD:-3}"
COOLDOWN_SECONDS="${COOLDOWN_SECONDS:-600}"
MAX_RESTARTS_PER_HOUR="${MAX_RESTARTS_PER_HOUR:-3}"
CONNECT_TIMEOUT_SECONDS="${CONNECT_TIMEOUT_SECONDS:-4}"
REQUEST_TIMEOUT_SECONDS="${REQUEST_TIMEOUT_SECONDS:-8}"
# Empty retains full-tunnel installations; proxy mode must probe its actual egress.
WARP_PROBE_PROXY="${WARP_PROBE_PROXY:-}"
POST_RESTART_ATTEMPTS="${POST_RESTART_ATTEMPTS:-8}"
POST_RESTART_DELAY_SECONDS="${POST_RESTART_DELAY_SECONDS:-3}"
POST_RESTART_SUCCESS_THRESHOLD="${POST_RESTART_SUCCESS_THRESHOLD:-2}"

CLOUDFLARE_TRACE_URL="${CLOUDFLARE_TRACE_URL:-https://www.cloudflare.com/cdn-cgi/trace}"
VERTEX_PROBE_URL="${VERTEX_PROBE_URL:-https://aiplatform.googleapis.com/}"
OSS_PROBE_URL="${OSS_PROBE_URL:-https://oss-ap-southeast-1.aliyuncs.com/}"

FAILURE_FILE="$STATE_DIR/consecutive-failures"
LAST_RESTART_FILE="$STATE_DIR/last-restart-epoch"
RESTART_HISTORY_FILE="$STATE_DIR/restart-history"

MODE="${1:---run}"
TEMP_DIR=''
PROBE_PASSED=0
PROBE_TOTAL=0
TRACE_REACHABLE=0
TRACE_WARP_VALUE='unknown'

log() {
  local level="$1"
  shift
  printf 'level=%s component=warp-egress-watchdog %s\n' "$level" "$*"
}

is_non_negative_integer() {
  [[ "$1" =~ ^[0-9]+$ ]]
}

validate_config() {
  local key value

  for key in FAILURE_THRESHOLD COOLDOWN_SECONDS MAX_RESTARTS_PER_HOUR \
    CONNECT_TIMEOUT_SECONDS REQUEST_TIMEOUT_SECONDS POST_RESTART_ATTEMPTS \
    POST_RESTART_DELAY_SECONDS POST_RESTART_SUCCESS_THRESHOLD; do
    value="${!key}"
    if ! is_non_negative_integer "$value"; then
      log error "event=invalid_config key=$key value=$value"
      return 1
    fi
  done

  if (( FAILURE_THRESHOLD < 1 || MAX_RESTARTS_PER_HOUR < 1 || POST_RESTART_ATTEMPTS < 1 || POST_RESTART_SUCCESS_THRESHOLD < 1 )); then
    log error 'event=invalid_config reason=threshold_must_be_positive'
    return 1
  fi
}

read_counter() {
  local file="$1"
  local fallback="$2"
  local value

  if [[ ! -f "$file" ]]; then
    printf '%s' "$fallback"
    return 0
  fi

  value="$(tr -d '[:space:]' <"$file" || true)"
  if is_non_negative_integer "$value"; then
    printf '%s' "$value"
  else
    printf '%s' "$fallback"
  fi
}

write_state() {
  local file="$1"
  local value="$2"
  local temporary_file="$file.tmp.$$"

  printf '%s\n' "$value" >"$temporary_file"
  chmod 600 "$temporary_file"
  mv -f "$temporary_file" "$file"
}

http_status_is_reachable() {
  local status="$1"
  is_non_negative_integer "$status" && (( status >= 200 && status < 500 ))
}

curl_status() {
  local url="$1"
  local output_file="$2"
  local error_file="$3"
  local proxy_args=()
  if [[ -n "$WARP_PROBE_PROXY" ]]; then
    proxy_args=(--proxy "$WARP_PROBE_PROXY" --noproxy '')
  fi

  curl \
    "${proxy_args[@]}" \
    --silent \
    --show-error \
    --location \
    --connect-timeout "$CONNECT_TIMEOUT_SECONDS" \
    --max-time "$REQUEST_TIMEOUT_SECONDS" \
    --output "$output_file" \
    --write-out '%{http_code}' \
    "$url" 2>"$error_file"
}

probe_http_endpoint() {
  local name="$1"
  local url="$2"
  local body_file="$TEMP_DIR/$name.body"
  local error_file="$TEMP_DIR/$name.error"
  local status curl_exit error_summary

  PROBE_TOTAL=$((PROBE_TOTAL + 1))
  status="$(curl_status "$url" "$body_file" "$error_file")"
  curl_exit=$?

  if (( curl_exit == 0 )) && http_status_is_reachable "$status"; then
    PROBE_PASSED=$((PROBE_PASSED + 1))
    log info "event=probe name=$name result=pass http_status=$status"
    return 0
  fi

  error_summary="$(tr '\n' ' ' <"$error_file" | cut -c1-240)"
  log warning "event=probe name=$name result=fail curl_exit=$curl_exit http_status=${status:-000} error=${error_summary:-none}"
  return 1
}

probe_cloudflare_trace() {
  local name='cloudflare_trace'
  local body_file="$TEMP_DIR/$name.body"
  local error_file="$TEMP_DIR/$name.error"
  local status curl_exit error_summary

  PROBE_TOTAL=$((PROBE_TOTAL + 1))
  status="$(curl_status "$CLOUDFLARE_TRACE_URL" "$body_file" "$error_file")"
  curl_exit=$?

  if (( curl_exit == 0 )) && http_status_is_reachable "$status"; then
    TRACE_REACHABLE=1
    TRACE_WARP_VALUE="$(sed -n 's/^warp=//p' "$body_file" | head -n 1 | tr -d '\r')"
    TRACE_WARP_VALUE="${TRACE_WARP_VALUE:-unknown}"
    if [[ "$TRACE_WARP_VALUE" == 'on' ]]; then
      PROBE_PASSED=$((PROBE_PASSED + 1))
      log info "event=probe name=$name result=pass http_status=$status warp=$TRACE_WARP_VALUE"
      return 0
    fi

    log warning "event=probe name=$name result=fail http_status=$status warp=$TRACE_WARP_VALUE"
    return 1
  fi

  error_summary="$(tr '\n' ' ' <"$error_file" | cut -c1-240)"
  log warning "event=probe name=$name result=fail curl_exit=$curl_exit http_status=${status:-000} warp=unknown error=${error_summary:-none}"
  return 1
}

probe_health() {
  local service_state result

  TEMP_DIR="$(mktemp -d /tmp/warp-egress-watchdog.XXXXXX)"
  PROBE_PASSED=0
  PROBE_TOTAL=0
  TRACE_REACHABLE=0
  TRACE_WARP_VALUE='unknown'

  service_state="$(systemctl is-active warp-svc 2>/dev/null || true)"
  log info "event=warp_status service=${service_state:-unknown}"

  probe_cloudflare_trace || true
  probe_http_endpoint 'vertex' "$VERTEX_PROBE_URL" || true
  probe_http_endpoint 'oss' "$OSS_PROBE_URL" || true

  result='healthy'
  if [[ "$service_state" != 'active' ]]; then
    result='unhealthy_service'
  elif (( TRACE_REACHABLE == 1 )) && [[ "$TRACE_WARP_VALUE" != 'on' && "$TRACE_WARP_VALUE" != 'unknown' ]]; then
    result='unhealthy_warp_state'
  elif (( PROBE_PASSED < 2 )); then
    result='unhealthy_egress'
  fi

  log info "event=health_result result=$result probes_passed=$PROBE_PASSED probes_total=$PROBE_TOTAL warp=$TRACE_WARP_VALUE"
  rm -rf "$TEMP_DIR"
  TEMP_DIR=''

  [[ "$result" == 'healthy' ]]
}

prune_restart_history() {
  local now="$1"
  local cutoff=$((now - 3600))
  local temporary_file="$RESTART_HISTORY_FILE.tmp.$$"

  if [[ -f "$RESTART_HISTORY_FILE" ]]; then
    awk -v cutoff="$cutoff" '$1 ~ /^[0-9]+$/ && $1 >= cutoff { print $1 }' "$RESTART_HISTORY_FILE" >"$temporary_file"
  else
    : >"$temporary_file"
  fi
  chmod 600 "$temporary_file"
  mv -f "$temporary_file" "$RESTART_HISTORY_FILE"
}

restart_warp() {
  local now="$1"
  local attempt consecutive_successes=0

  printf '%s\n' "$now" >>"$RESTART_HISTORY_FILE"
  chmod 600 "$RESTART_HISTORY_FILE"
  write_state "$LAST_RESTART_FILE" "$now"
  log warning 'event=restart action=start service=warp-svc'

  if ! systemctl restart warp-svc; then
    log error 'event=restart action=failed service=warp-svc'
    return 1
  fi

  for ((attempt = 1; attempt <= POST_RESTART_ATTEMPTS; attempt += 1)); do
    sleep "$POST_RESTART_DELAY_SECONDS"
    if probe_health; then
      consecutive_successes=$((consecutive_successes + 1))
      log info "event=post_restart_verification attempt=$attempt consecutive_successes=$consecutive_successes"
      if (( consecutive_successes >= POST_RESTART_SUCCESS_THRESHOLD )); then
        write_state "$FAILURE_FILE" 0
        log info 'event=restart action=recovered service=warp-svc'
        return 0
      fi
    else
      consecutive_successes=0
      log warning "event=post_restart_verification attempt=$attempt consecutive_successes=0"
    fi
  done

  log error 'event=restart action=unrecovered service=warp-svc'
  return 1
}

main() {
  local failures now last_restart restart_count elapsed

  validate_config || return 2

  if [[ "$MODE" != '--run' && "$MODE" != '--probe' ]]; then
    printf 'Usage: %s [--run|--probe]\n' "$0" >&2
    return 2
  fi

  if [[ "$MODE" == '--probe' ]]; then
    probe_health
    return $?
  fi

  install -d -m 700 "$STATE_DIR"
  touch "$RESTART_HISTORY_FILE"
  chmod 600 "$RESTART_HISTORY_FILE"

  if probe_health; then
    write_state "$FAILURE_FILE" 0
    return 0
  fi

  failures="$(read_counter "$FAILURE_FILE" 0)"
  failures=$((failures + 1))
  write_state "$FAILURE_FILE" "$failures"
  log warning "event=failure_recorded consecutive_failures=$failures threshold=$FAILURE_THRESHOLD"

  if (( failures < FAILURE_THRESHOLD )); then
    return 0
  fi

  now="$(date +%s)"
  last_restart="$(read_counter "$LAST_RESTART_FILE" 0)"
  elapsed=$((now - last_restart))
  if (( last_restart > 0 && elapsed < COOLDOWN_SECONDS )); then
    log warning "event=restart_suppressed reason=cooldown elapsed_seconds=$elapsed cooldown_seconds=$COOLDOWN_SECONDS"
    return 0
  fi

  prune_restart_history "$now"
  restart_count="$(wc -l <"$RESTART_HISTORY_FILE" | tr -d '[:space:]')"
  if (( restart_count >= MAX_RESTARTS_PER_HOUR )); then
    log error "event=restart_suppressed reason=hourly_limit restarts_last_hour=$restart_count max=$MAX_RESTARTS_PER_HOUR"
    return 0
  fi

  restart_warp "$now" || true
}

trap '[[ -n "$TEMP_DIR" ]] && rm -rf "$TEMP_DIR"' EXIT
main "$@"
