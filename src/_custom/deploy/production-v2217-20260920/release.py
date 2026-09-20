#!/usr/bin/env python3
"""Pinned production release. Default is read-only; --execute performs cutover.

Private bundle is prepared on the production host. Never restores a database dump.
Rollback retains the upgraded database, including writes after the release.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

R = Path('/opt/lobechat-releases/v2217-20260920')
BASE = Path('/opt/lobechat-main')
APP = 'lobechat-app'
PG = 'lobechat-postgresql'


def run(command, **kwargs):
    return subprocess.run(command, check=True, **kwargs)


def inspect(name):
    return json.loads(subprocess.check_output(['docker', 'inspect', name]))[0]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sql(query):
    return subprocess.check_output(
        ['docker', 'exec', '-i', PG, 'psql', '-X', '-U', 'paradedb',
         '-d', 'lobehub', '-At', '-v', 'ON_ERROR_STOP=1'], input=query, text=True,
    ).strip()


def env_hash(app):
    return hashlib.sha256(json.dumps(sorted(app['Config']['Env'])).encode()).hexdigest()


def schedules():
    env = dict(item.split('=', 1) for item in inspect(APP)['Config']['Env'])
    request = urllib.request.Request('http://127.0.0.1:18088/v2/schedules',
                                    headers={'Authorization': 'Bearer ' + env['QSTASH_TOKEN']})
    return json.load(urllib.request.urlopen(request, timeout=15))


def schedule_shape(items):
    return sorted((s['scheduleId'], s['destination'], s['cron']) for s in items)


def healthy():
    for _ in range(60):
        try:
            with urllib.request.urlopen('http://127.0.0.1:3210/api/auth/get-session', timeout=3) as r:
                if r.status == 200:
                    return
        except Exception:
            pass
        time.sleep(2)
    raise RuntimeError('Application health timeout')


def reload_proxy():
    run(['docker', 'exec', 'docker-nginx-1', 'nginx', '-t'])
    run(['docker', 'exec', 'docker-nginx-1', 'nginx', '-s', 'reload'])


def compose(candidate):
    source = R / ('candidate-compose.private.json' if candidate else 'rollback-compose.private.json')
    command = ['docker', 'compose', '--project-name', 'lobechat-prod',
               '--project-directory', str(BASE), '--env-file', str(BASE / '.env'),
               '-f', str(source)]
    run(command + ['up', '-d', '--no-deps', 'app'], stdout=subprocess.DEVNULL)
    healthy()
    # Persist the exact source with escaped interpolation, not rendered secrets containing '$'.
    pending = BASE / 'docker-compose.prod.yml.pending'
    pending.write_bytes(source.read_bytes())
    pending.chmod(0o600)
    pending.replace(BASE / 'docker-compose.prod.yml')
    reload_proxy()


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--rollback', action='store_true')
    args = parser.parse_args()
    manifest = json.loads((R / 'manifest.json').read_text())
    for filename, expected in manifest['files'].items():
        assert digest(R / filename) == expected, 'Bundle changed: ' + filename
    for name, expected in manifest['dependencies'].items():
        assert inspect(name)['Id'] == expected, 'Dependency changed: ' + name
    for key in ['new', 'old']:
        assert inspect(manifest[key + 'Image'])['Id'] == manifest[key + 'ImageId'], 'Image changed'
    run(['docker', 'exec', 'docker-nginx-1', 'nginx', '-t'])
    current = inspect(APP)
    if args.rollback:
        assert args.execute, 'Rollback requires --execute'
        assert current['Image'] in [manifest['newImageId'], manifest['oldImageId']]
        compose(False)
        print('Old application restored; upgraded database and subsequent writes retained.')
        return
    assert current['Id'] == manifest['oldContainerId'], 'Production container changed'
    assert current['Image'] == manifest['oldImageId'], 'Production image changed'
    assert env_hash(current) == manifest['environmentHash'], 'Production environment changed'
    assert digest(BASE / 'docker-compose.prod.yml') == manifest['composeHash'], 'Compose changed'
    assert sql('select current_database()') == 'lobehub'
    results = json.loads((R / 'api-rehearsal-results.json').read_text())
    assert len(results) == 12 and all(r['status'] == 200 for r in results), 'Rehearsal incomplete'
    active = sql("select count(*) from public.agent_operations where status in "
                 "('running','waiting_for_async_tool') and updated_at > now()-interval '30 minutes'")
    pending = sql("select count(*) from public.messages where role='assistant' and content in ('','...') and usage is null and error is null and created_at>now()-interval '15 minutes'")
    original_schedules = json.loads((R / 'schedules-before.private.json').read_text())
    assert schedule_shape(schedules()) == schedule_shape(original_schedules), 'Schedules changed'
    print('Image, environment, dependencies, schedules, migration bundle and rehearsal verified.', flush=True)
    print('Recently active Agent operations:', active, 'possible streams:', pending, flush=True)
    if not args.execute:
        print('Preflight only; production unchanged.')
        return
    assert pending == '0', 'Wait for possible streaming responses before cutover'
    assert active == '0', 'Wait for active Agent operations before cutover'
    backup = R / ('cutover-backup-' + time.strftime('%Y%m%d-%H%M%S'))
    backup.mkdir(mode=0o700)
    run(['docker', 'stop', '--time', '60', APP], stdout=subprocess.DEVNULL)
    try:
        with (backup / 'production.dump').open('wb') as output:
            run(['docker', 'exec', PG, 'pg_dump', '-U', 'paradedb', '-d', 'lobehub',
                 '-Fc', '--no-owner', '--no-acl'], stdout=output)
        with (backup / 'production.dump').open('rb') as source:
            run(['docker', 'exec', '-i', PG, 'pg_restore', '--list'],
                stdin=source, stdout=subprocess.DEVNULL)
        (backup / 'dump.sha256').write_text(digest(backup / 'production.dump') + '\n')
        with (backup / 'configuration.tar.gz').open('wb') as output:
            run(['tar', '-C', str(BASE), '-czf', '-', '.env', 'docker-compose.prod.yml'], stdout=output)
        # Both new migrations run via the image's official startup migrator.
        compose(True)
        assert sql('select count(*) from drizzle.__drizzle_migrations') == '162', 'Migration count mismatch'
        upgraded = inspect(APP)
        assert upgraded['Image'] == manifest['newImageId']
        assert env_hash(upgraded) == manifest['environmentHash'], 'Runtime environment changed'
        for name, expected in manifest['dependencies'].items():
            assert inspect(name)['Id'] == expected, 'Dependency was recreated'
        assert schedule_shape(schedules()) == schedule_shape(original_schedules), 'Schedules changed'
        (R / 'release-result.json').write_text(json.dumps({
            'image': upgraded['Config']['Image'], 'imageId': upgraded['Image'],
            'backup': str(backup), 'authHealth': 200, 'environmentPreserved': True,
            'dependenciesPreserved': True, 'scheduleDefinitionsPreserved': True,
        }, indent=2))
    except Exception:
        print('Cutover failed; restoring the old application without restoring database data.', flush=True)
        compose(False)
        raise
    print('Production application healthy. Complete public URL and real login checks.', flush=True)


if __name__ == '__main__':
    main()
