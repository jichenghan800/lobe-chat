#!/usr/bin/env python3
"""Only affects the two dedicated OnlyBoxes networks and firewall chains."""
import json
import subprocess


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)


def exists(*args):
    return subprocess.run(args, capture_output=True).returncode == 0


for name, subnet, bridge in [
    ('lingshu-onlyboxes-control', '10.251.216.0/24', 'br-obx-control'),
    ('lingshu-onlyboxes-sandboxes', '10.251.217.0/24', 'br-obx-sandbox'),
]:
    if not exists('docker', 'network', 'inspect', name):
        run('docker', 'network', 'create', '--driver', 'bridge', '--subnet', subnet,
            '--opt', 'com.docker.network.bridge.enable_icc=false',
            '--opt', 'com.docker.network.bridge.name=' + bridge, name)

    config = json.loads(subprocess.check_output(['docker', 'network', 'inspect', name]))[0]
    assert config['IPAM']['Config'][0]['Subnet'] == subnet, 'Unexpected OnlyBoxes subnet'
    assert config['Options'].get('com.docker.network.bridge.name') == bridge
    assert config['Options'].get('com.docker.network.bridge.enable_icc') == 'false'

for chain in ['LINGSHU-OBX', 'LINGSHU-OBX-IN']:
    if not exists('iptables', '-S', chain):
        run('iptables', '-N', chain)

# Never flush global rules, WARP rules, or another application's chains.
for destination in ['0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8',
                    '169.254.0.0/16', '172.16.0.0/12', '192.168.0.0/16', '224.0.0.0/4']:
    rule = ('-d', destination, '-j', 'REJECT')
    if not exists('iptables', '-C', 'LINGSHU-OBX', *rule):
        run('iptables', '-A', 'LINGSHU-OBX', *rule)
# Access to the public HTTPS application is needed for signed attachment URLs.
for rule in [('-p', 'tcp', '--dport', '443', '-j', 'ACCEPT'), ('-j', 'REJECT')]:
    if not exists('iptables', '-C', 'LINGSHU-OBX-IN', *rule):
        run('iptables', '-A', 'LINGSHU-OBX-IN', *rule)
for parent, child in [('DOCKER-USER', 'LINGSHU-OBX'), ('INPUT', 'LINGSHU-OBX-IN')]:
    rule = ('-i', 'br-obx-sandbox', '-s', '10.251.217.0/24', '-j', child)
    if not exists('iptables', '-C', parent, *rule):
        run('iptables', '-I', parent, '1', *rule)
print('OnlyBoxes dedicated networks and scoped firewall rules ready.')
