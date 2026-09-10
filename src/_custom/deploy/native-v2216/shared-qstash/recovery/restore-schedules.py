#!/usr/bin/env python3
"""Preview backed-up schedules; --restore re-registers only the reviewed backup."""
import argparse
import json
import pathlib
import subprocess
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('backup', type=pathlib.Path)
parser.add_argument('--restore', action='store_true')
args = parser.parse_args()
schedules = json.loads(args.backup.read_text())
assert len(schedules) == 1, 'Review backup scope before restoring'
schedule = schedules[0]
assert schedule['scheduleId'] == 'lobe-task-schedule-dispatch'
assert schedule['destination'] == 'https://chat.cotti.ai/api/workflows/task/schedule-dispatch'
assert schedule['cron'] == '*/10 * * * *'
assert json.loads(schedule.get('body', '{}')) == {}
print(json.dumps({'scheduleId': schedule['scheduleId'], 'destination': schedule['destination'], 'cron': schedule['cron'], 'restore': args.restore}))
if args.restore:
    app = json.loads(subprocess.check_output(['docker', 'inspect', 'cotti-v2216-native-app-1']))[0]
    env = dict(row.split('=', 1) for row in app['Config']['Env'])
    headers = {
        'Authorization': 'Bearer ' + env['QSTASH_TOKEN'],
        'Content-Type': 'application/json',
        'Upstash-Schedule-Id': schedule['scheduleId'],
        'Upstash-Cron': schedule['cron'],
        'Upstash-Method': schedule.get('method', 'POST'),
    }
    request = urllib.request.Request(
        'http://127.0.0.1:18088/v2/schedules/' + schedule['destination'],
        data=schedule.get('body', '{}').encode(), headers=headers, method='POST',
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        print(json.dumps({'status': response.status, 'result': json.load(response)}))
