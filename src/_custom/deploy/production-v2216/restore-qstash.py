#!/usr/bin/env python3
"""Restore only this application's reviewed schedules after an application rollback."""
import json
from pathlib import Path
import subprocess
import urllib.request
import urllib.error

backup=json.loads((Path(__file__).parent/'qstash-schedules.json').read_text())
assert len(backup)==1
schedule=backup[0]
assert schedule['scheduleId']=='lobe-task-schedule-dispatch'
assert schedule['destination']=='https://chat.cotticoffee.com/api/workflows/task/schedule-dispatch'
assert schedule['cron']=='*/10 * * * *' and not schedule['isPaused']
assert schedule['body']=='{}'
app=json.loads(subprocess.check_output(['docker','inspect','lobechat-app']))[0]
env=dict(row.split('=',1) for row in app['Config']['Env'])
headers={'Authorization':'Bearer '+env['QSTASH_TOKEN']}
url='http://127.0.0.1:18088/v2/schedules'
current=json.load(urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=15))
for item in current:
    if item['scheduleId']=='lobe-goal-sweep':
        assert item['destination']=='https://chat.cotticoffee.com/api/workflows/goal/sweep'
        urllib.request.urlopen(urllib.request.Request(url+'/lobe-goal-sweep',headers=headers,method='DELETE'),timeout=15).close()
headers.update({'Content-Type':'application/json','Upstash-Schedule-Id':schedule['scheduleId'],'Upstash-Cron':schedule['cron'],'Upstash-Method':'POST'})
with urllib.request.urlopen(urllib.request.Request(url+'/'+schedule['destination'],data=b'{}',headers=headers,method='POST'),timeout=15) as response:
    print('Restored original task dispatcher:',response.status)
