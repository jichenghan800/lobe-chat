#!/usr/bin/python3
"""Add deployment isolation to worker-created containers without forking OnlyBoxes."""
import os
import sys

args = sys.argv[1:]
if args and args[0] == 'create':
    if '--privileged' in args or '--network' in args:
        raise SystemExit('Unexpected worker container privileges or network')
    args[1:1] = ['--network', 'lingshu-onlyboxes-sandboxes',
                 '--security-opt', 'no-new-privileges=true']
os.execv('/usr/bin/docker', ['/usr/bin/docker', *args])
