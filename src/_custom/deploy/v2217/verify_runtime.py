"""Read-only checks for the two domain entrances of the shared v2.2.17 service."""
import json
import subprocess
from urllib.parse import urlsplit


def inspect(name):
    return json.loads(subprocess.check_output(['docker', 'inspect', name]))[0]


def main():
    dev = inspect('lingshu-v2217-app-dev')
    cotti = inspect('cotti-v2216-native-app-cotti-1')
    dev_env = dict(item.split('=', 1) for item in dev['Config']['Env'])
    cotti_env = dict(item.split('=', 1) for item in cotti['Config']['Env'])
    shared_keys = [
        'DATABASE_URL', 'REDIS_URL', 'QSTASH_URL', 'INTERNAL_APP_URL',
        'S3_ENDPOINT', 'S3_BUCKET', 'S3_PUBLIC_DOMAIN', 'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY', 'KEY_VAULTS_SECRET', 'AUTH_SECRET',
        'ONLYBOXES_BASE_URL', 'ONLYBOXES_ENABLED', 'ONLYBOXES_JIT_ISSUER',
        'ONLYBOXES_JIT_SIGNING_KEY',
    ]
    checks = {
        'both_applications_running': dev['State']['Running'] and cotti['State']['Running'],
        'same_image': dev['Image'] == cotti['Image'],
        'chatdev_origin': dev_env.get('APP_URL') == 'https://chatdev.cotticoffee.com',
        'cotti_origin': cotti_env.get('APP_URL') == 'https://chat.cotti.ai',
        'shared_backend': all(dev_env.get(key) == cotti_env.get(key) for key in shared_keys),
        'shared_database': urlsplit(dev_env.get('DATABASE_URL', '')).hostname == 'lingshu-v2217-pg',
        'shared_storage': dev_env.get('S3_BUCKET') == 'sg-pre-lobechat',
        'shared_queue': urlsplit(dev_env.get('QSTASH_URL', '')).hostname == 'lingshu-v2217-qstash',
        'shared_callback': dev_env.get('INTERNAL_APP_URL') == 'http://lingshu-v2217-app-dev:3210',
        'both_use_application_gateway': all(
            app['NetworkSettings']['Networks']['cotti-v2216-native_default'].get('GwPriority') == 100
            for app in [dev, cotti]
        ),
    }
    print(json.dumps(checks, indent=2))
    if not all(checks.values()):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
