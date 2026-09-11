#!/usr/bin/env python3
"""Refresh derived totals in bounded batches; never changes raw usage or freezes topics."""
import argparse
from pathlib import Path
import subprocess
p=argparse.ArgumentParser();p.add_argument('--container',required=True);p.add_argument('--database',required=True);a=p.parse_args()
base=['docker','exec','-i',a.container,'psql','-U','paradedb','-d',a.database,'-X','-qAt','-v','ON_ERROR_STOP=1']
source=(Path(__file__).parent/'refresh-cost-summary.sql').read_text()
ids=subprocess.check_output(base+['-c','SELECT id FROM topics ORDER BY id'],text=True).splitlines()
for offset in range(0,len(ids),100):
    previous='' if offset==0 else ids[offset-1]
    subprocess.run(base+['-v','after_id='+previous,'-v','batch_size=100'],input=source,text=True,check=True,stdout=subprocess.DEVNULL)
    print(min(offset+100,len(ids)), '/',len(ids),flush=True)
