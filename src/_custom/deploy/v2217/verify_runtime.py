"""Read-only deployment checks for the isolated v2.2.17 acceptance environment."""
import hashlib
import json
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

APP = 'lingshu-v2217-app-dev'


def inspect(name):
    return json.loads(subprocess.check_output(['docker', 'inspect', name]))[0]


def main():
    app = inspect(APP)
    env = dict(item.split('=', 1) for item in app['Config']['Env'])
    checks = {
        'application_running': app['State']['Running'],
        'public_origin': env.get('APP_URL') == 'https://chatdev.cotticoffee.com',
        'completion_callback_isolated': env.get('INTERNAL_APP_URL') == f'http://{APP}:3210',
        'database_isolated': urlsplit(env.get('DATABASE_URL', '')).hostname == 'lingshu-v2217-pg',
        'redis_isolated': urlsplit(env.get('REDIS_URL', '')).hostname == 'lingshu-v2217-redis',
        'queue_isolated': urlsplit(env.get('QSTASH_URL', '')).hostname == 'lingshu-v2217-qstash',
        'storage_isolated': env.get('S3_BUCKET') == 'lobe-v2217',
        'storage_region': env.get('S3_REGION') == 'us-east-1',
        'storage_signed_access': env.get('S3_SET_ACL') == '0',
        'no_legacy_application_reference': not any('cotti-v2216-native-app' in value for value in env.values()),
        'old_cotti_running': inspect('cotti-v2216-native-app-cotti-1')['State']['Running'],
    }
    baseline = Path('.records/v2217-minimal/cotti-nginx-before.sha256')
    if baseline.exists():
        digest = hashlib.sha256(Path('/etc/nginx/conf.d/chat.cotti.ai.conf').read_bytes()).hexdigest()
        checks['old_cotti_nginx_unchanged'] = digest in baseline.read_text()
    print(json.dumps(checks, indent=2))
    if not all(checks.values()):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
