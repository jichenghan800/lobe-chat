"""Read-only runtime checks for the two v2.2.18 acceptance entrances."""
import json
import subprocess
from urllib.parse import urlsplit
from urllib.request import urlopen


NAMES = ['lingshu-v2217-app-dev', 'cotti-v2216-native-app-cotti-1']
EXPECTED_IMAGE = 'sha256:823336c14091938052303050ee6bf68054c3a6f2d054ba767a74f19775e85df9'


def main():
    apps = [json.loads(subprocess.check_output(['docker', 'inspect', name]))[0] for name in NAMES]
    envs = [dict(item.split('=', 1) for item in app['Config']['Env']) for app in apps]
    shared = [
        'DATABASE_URL', 'REDIS_URL', 'QSTASH_URL', 'INTERNAL_APP_URL',
        'S3_ENDPOINT', 'S3_BUCKET', 'S3_PUBLIC_DOMAIN', 'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY', 'KEY_VAULTS_SECRET', 'AUTH_SECRET',
        'ONLYBOXES_BASE_URL', 'ONLYBOXES_ENABLED', 'ONLYBOXES_JIT_ISSUER',
        'ONLYBOXES_JIT_SIGNING_KEY', 'OPENAI_PROXY_URL', 'OPENAI_API_KEY',
        'OPENAI_MODEL_LIST', 'AZURE_MODEL_LIST', 'VERTEXAI_MODEL_LIST',
    ]
    checks = {
        'both_running': all(app['State']['Running'] for app in apps),
        'both_expected_image': all(app['Image'] == EXPECTED_IMAGE for app in apps),
        'shared_backend': all(envs[0].get(key) == envs[1].get(key) for key in shared),
        'acceptance_database': all(
            urlsplit(env['DATABASE_URL']).path == '/lobehub_v2218_acceptance' for env in envs
        ),
        'independent_origins': [env['APP_URL'] for env in envs] == [
            'https://chatdev.cotticoffee.com', 'https://chat.cotti.ai',
        ],
        'same_application_egress': all(
            app['NetworkSettings']['Networks']['cotti-v2216-native_default'].get('GwPriority') == 100
            for app in apps
        ),
    }
    for index, port in enumerate([3232, 3231]):
        with urlopen(f'http://127.0.0.1:{port}/api/auth/get-session', timeout=10) as response:
            checks[f'auth_health_{index}'] = response.status == 200
    print(json.dumps(checks, indent=2))
    if not all(checks.values()):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
