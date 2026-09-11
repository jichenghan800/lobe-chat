#!/usr/bin/env python3
"""Production release helper. Default: read-only preflight; --execute: approved cutover.
The generated/private bundle must be in /opt/lobechat-releases/v2216-20260911.
Never run against the development database. No service except app is recreated.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import shutil
import time
import urllib.request

BUNDLE = Path('/opt/lobechat-releases/v2216-20260911')
BASE = Path('/opt/lobechat-main')
parser = argparse.ArgumentParser()
parser.add_argument('--execute', action='store_true')
parser.add_argument('--rollback', action='store_true')
args = parser.parse_args()
manifest = json.loads((BUNDLE / 'manifest.json').read_text())

def run(cmd, **kwargs):
    return subprocess.run(cmd, check=True, **kwargs)

def sql(statement):
    return subprocess.check_output(['docker','exec','-i','lobechat-postgresql','psql','-U','paradedb','-d','lobehub','-X','-qAt','-v','ON_ERROR_STOP=1'], input=statement, text=True).strip()

def compose(release):
    if not release:
        shutil.copyfile(BUNDLE/'production-compose.yml', BASE/'docker-compose.prod.yml')
        (BASE/'docker-compose.prod.yml').chmod(0o600)
    cmd=['docker','compose','--project-name','lobechat-prod','--env-file',str(BASE/'.env')]
    if release: cmd += ['--env-file',str(BUNDLE/'production-runtime.env')]
    cmd += ['-f',str(BASE/'docker-compose.prod.yml')]
    if release: cmd += ['-f',str(BUNDLE/'compose.override.yml')]
    env={**os.environ,'COTTI_RELEASE_DIR':str(BUNDLE)}
    run(cmd+['up','-d','--no-deps','app'],env=env,stdout=subprocess.DEVNULL)
    if release:
        # Persist the resolved deployment so later compose up/reboots retain this release.
        # Contains credentials: write atomically with owner-only permissions.
        rendered=subprocess.check_output(cmd+['config'],env=env)
        pending=BASE/'docker-compose.prod.yml.pending'
        fd=os.open(pending,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
        with os.fdopen(fd,'wb') as out: out.write(rendered)
        pending.replace(BASE/'docker-compose.prod.yml')

def healthy():
    for _ in range(60):
        try:
            with urllib.request.urlopen('http://127.0.0.1:3210/api/auth/get-session', timeout=3) as response:
                if response.status == 200: return
        except Exception: pass
        time.sleep(2)
    raise RuntimeError('Application health timeout')

def reload_proxy():
    run(['docker','exec','docker-nginx-1','nginx','-t'])
    run(['docker','exec','docker-nginx-1','nginx','-s','reload'])

current=json.loads(subprocess.check_output(['docker','inspect','lobechat-app']))[0]
for filename,digest in manifest['files'].items():
    if hashlib.sha256((BUNDLE/filename).read_bytes()).hexdigest()!=digest:
        raise SystemExit('Bundle checksum mismatch: '+filename)
image=json.loads(subprocess.check_output(['docker','image','inspect',manifest['newImage']]))[0]
if image['Id']!=manifest['newImageId']: raise SystemExit('Candidate image mismatch')
run(['docker','exec','docker-nginx-1','nginx','-t'])
if args.rollback:
    if not args.execute: raise SystemExit('Rollback requires --execute')
    compose(False); healthy(); reload_proxy(); run(['python3',str(BUNDLE/'restore-qstash.py')])
    print('Old image and original schedules restored; upgraded DB and new writes preserved.')
    raise SystemExit(0)
if current['Image']!=manifest['oldImageId']: raise SystemExit('Production baseline changed; rebuild preparation bundle')
env_digest=hashlib.sha256(json.dumps(sorted(current['Config']['Env'])).encode()).hexdigest()
if env_digest!=manifest['oldEnvironmentSha256']: raise SystemExit('Production environment changed; refresh candidate env before release')
if hashlib.sha256((BASE/'docker-compose.prod.yml').read_bytes()).hexdigest()!=manifest['files']['production-compose.yml']:
    raise SystemExit('Production compose changed; refresh the baseline before release')
print('Baseline/image/bundle/proxy checks passed')
print('Database:',sql('SELECT current_database(),pg_database_size(current_database());'))
active=sql("SELECT count(*) FROM agent_operations WHERE status IN ('running','waiting_for_async_tool') AND updated_at>now()-interval '30 minutes';")
print('Recently active Agent operations:',active)
if not args.execute:
    print('Preflight only; production unchanged. Review cutover window and cost limits before --execute.')
    raise SystemExit(0)
if active!='0': raise SystemExit('Wait for active Agent operations to finish; do not interrupt them for release')
backup=BUNDLE / ('cutover-backup-'+time.strftime('%Y%m%d-%H%M%S'))
backup.mkdir(mode=0o700)
run(['docker','stop','--time','60','lobechat-app'],stdout=subprocess.DEVNULL)
try:
    with (backup/'production.dump').open('wb') as out:
        run(['docker','exec','lobechat-postgresql','pg_dump','-U','paradedb','-d','lobehub','-Fc','--no-owner','--no-acl'],stdout=out)
    # Verify the final backup archive is readable before changing the schema.
    with (backup/'production.dump').open('rb') as source:
        run(['docker','exec','-i','lobechat-postgresql','pg_restore','--list'],stdin=source,stdout=subprocess.DEVNULL)
    with (backup/'configuration.tar.gz').open('wb') as out:
        run(['tar','-C',str(BASE),'-czf','-','.env','docker-compose.prod.yml'],stdout=out)
    for name in ['reconcile.sql','restore-agent-users.sql','retire-sol.sql']:
        with (BUNDLE/name).open('rb') as source, (backup/(name+'.log')).open('wb') as log:
            run(['docker','exec','-i','lobechat-postgresql','psql','-U','paradedb','-d','lobehub','-X','-v','ON_ERROR_STOP=1'],stdin=source,stdout=log,stderr=log)
    with (backup/'cost-refresh.log').open('w') as log:
        run(['python3',str(BUNDLE/'refresh-costs.py'),'--container','lobechat-postgresql','--database','lobehub'],stdout=log)
    compose(True); healthy(); reload_proxy()
except Exception:
    print('Release failed: restoring the original application image. Migration is transactional; do not blindly restore an old DB dump.')
    compose(False); healthy(); reload_proxy(); run(['python3',str(BUNDLE/'restore-qstash.py')])
    raise
print('Application healthy. Complete real login, topic/file, models and task acceptance before closing the release.')
