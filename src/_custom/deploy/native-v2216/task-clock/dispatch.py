#!/usr/bin/env python3
"""Call only chatdev's native task dispatcher; default to read-only preview."""
import argparse
import base64
import datetime
import fcntl
import hashlib
import hmac
import json
import subprocess
import time
import urllib.request


def encoded(value):
    return base64.urlsafe_b64encode(value).decode().rstrip('=')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true', help='Dispatch due tasks (explicit opt-in)')
    args = parser.parse_args()
    with open('/run/lock/cotti-v2216-task-clock.lock', 'w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({'skipped': 'previous-dispatch-running'}))
            return
        raw = subprocess.check_output(['docker', 'inspect', 'cotti-v2216-native-app-1'])
        env = dict(item.split('=', 1) for item in json.loads(raw)[0]['Config']['Env'])
        if args.execute and (env.get('QSTASH_TOKEN') or env.get('AGENT_RUNTIME_MODE') == 'queue'):
            raise RuntimeError('QStash/queue configured: review native scheduling before enabling local dispatch')
        path = '/api/workflows/task/schedule-dispatch'
        body = json.dumps({'dryRun': not args.execute}).encode()
        headers = {'Content-Type': 'application/json'}
        key = env.get('QSTASH_CURRENT_SIGNING_KEY')
        if key:
            now = int(time.time())
            header = encoded(b'{"alg":"HS256","typ":"JWT"}')
            payload = encoded(json.dumps({
                'iss': 'Upstash', 'sub': 'https://chatdev.cotticoffee.com' + path,
                'iat': now, 'nbf': now - 5, 'exp': now + 120,
                'body': encoded(hashlib.sha256(body).digest()),
            }).encode())
            signing_input = header + '.' + payload
            headers['Upstash-Signature'] = signing_input + '.' + encoded(
                hmac.new(key.encode(), signing_input.encode(), hashlib.sha256).digest())
        request = urllib.request.Request('http://127.0.0.1:3230' + path, data=body, headers=headers)
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.load(response)
        if result.get('success') is not True:
            raise RuntimeError('Native dispatcher did not report success')
        safe = {key: result.get(key) for key in ['total', 'due', 'dispatched', 'skipped']}
        safe.update(at=datetime.datetime.now(datetime.timezone.utc).isoformat(), dryRun=not args.execute)
        print(json.dumps(safe), flush=True)
        if args.execute and result.get('dispatched', 0) < result.get('due', 0):
            raise RuntimeError('Some due tasks were not dispatched; inspect application logs')


if __name__ == '__main__':
    main()
