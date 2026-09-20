"""Offline regression: no network, systemd changes, or watchdog state writes."""
import os
from pathlib import Path
import subprocess
import tempfile

script = Path(os.environ.get('WATCHDOG_TEST_SOURCE', Path(__file__).with_name('warp-egress-watchdog.sh')))
source = script.read_text().split("trap '")[0]
mock = r'''
curl() {
  local output='' proxy='' bypass='unset'
  while (( $# )); do
    case "$1" in
      --proxy) proxy="$2"; shift 2 ;;
      --noproxy) bypass="$2"; shift 2 ;;
      --output) output="$2"; shift 2 ;;
      *) shift ;;
    esac
  done
  [[ "$proxy" == "$EXPECTED_PROXY" ]] || return 90
  if [[ -n "$EXPECTED_PROXY" ]]; then [[ "$bypass" == '' ]] || return 91; fi
  printf 'warp=on\n' > "$output"
  printf '200'
}
curl_status 'https://example.invalid' "$TEST_OUTPUT" "$TEST_ERROR"
'''
with tempfile.TemporaryDirectory() as directory:
    for proxy, bypass in [('', ''), ('socks5h://127.0.0.1:40000', ''), ('socks5h://127.0.0.1:40000', '*')]:
        env = dict(os.environ, WARP_PROBE_PROXY=proxy, EXPECTED_PROXY=proxy,
                   NO_PROXY=bypass, TEST_OUTPUT=directory+'/body', TEST_ERROR=directory+'/error')
        result = subprocess.run(['bash', '-c', source + mock], env=env, capture_output=True, text=True)
        assert result.returncode == 0 and result.stdout == '200', (proxy, bypass, result.returncode)
print('3 proxy-routing regressions passed')
