"""Release regression: previous lazy chunk survives, missing chunks are not cached."""
import argparse
import hashlib
import urllib.error
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--base', required=True)
parser.add_argument('--asset', required=True)
parser.add_argument('--sha256', required=True)
args = parser.parse_args()
with urllib.request.urlopen(args.base.rstrip('/') + args.asset, timeout=30) as response:
    assert response.status == 200
    assert 'javascript' in response.headers.get('Content-Type', '')
    assert hashlib.sha256(response.read()).hexdigest() == args.sha256
try:
    urllib.request.urlopen(args.base.rstrip('/') + '/_spa/assets/missing-static-compat-probe.js', timeout=30)
except urllib.error.HTTPError as error:
    assert error.code == 404
    assert 'no-store' in error.headers.get('Cache-Control', '')
else:
    raise AssertionError('Missing static asset must return 404')
print('Previous chunk exact bytes verified; missing chunk remains 404/no-store.')
