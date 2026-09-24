"""Reconcile pinned upstream migrations on isolated v2.2.18 copies only.

Default is a read-only plan. No arbitrary host, database or connection URL accepted.
Production history and customization SQL are never rewritten by this script.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
MIGRATIONS = ROOT / 'packages/database/migrations'
PINNED = json.loads(Path(__file__).with_name('upstream-migrations.json').read_text())


def sql(container, database, statement):
    return subprocess.check_output(
        ['docker', 'exec', '-i', container, 'psql', '-X', '-U', 'paradedb',
         '-d', database, '-At', '-v', 'ON_ERROR_STOP=1'],
        input=statement, text=True,
    ).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('scope', choices=['development', 'production'])
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    container = 'lingshu-v2218-' + args.scope + '-verify-pg'
    database = 'v2218_' + args.scope + '_copy'
    state = json.loads(subprocess.check_output(['docker', 'inspect', container]))[0]
    assert state['HostConfig']['NetworkMode'] == 'none', 'Copy must be network isolated'
    assert not state['HostConfig']['PortBindings'], 'Copy must not publish ports'
    assert sql(container, database, 'select current_database()') == database
    applied = set(sql(container, database, 'select hash from drizzle.__drizzle_migrations').splitlines())
    plan = []
    for tag, pin in PINNED.items():
        content = (MIGRATIONS / (tag + '.sql')).read_bytes()
        assert hashlib.sha256(content).hexdigest() == pin['sha256'], 'Migration changed: ' + tag
        if pin['sha256'] not in applied:
            plan.append((tag, pin, content.decode()))
    print(json.dumps({'scope': args.scope, 'missing': [p[0] for p in plan], 'execute': args.execute}))
    if not args.execute or not plan:
        return
    statements = ["BEGIN; SET LOCAL search_path=public; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='120s';", 'SELECT pg_advisory_xact_lock(2218, 162);']
    for tag, pin, content in plan:
        # Recheck under the lock: a second invocation must not replay non-idempotent DDL.
        statements.extend([
            f"SELECT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash='{pin['sha256']}') AS applied \\gset",
            '\\if :applied', '\\else',
            content.replace('--> statement-breakpoint', '\n'),
            f"INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('{pin['sha256']}',{int(pin['when'])});",
            '\\endif',
        ])
    statements.append('COMMIT;')
    sql(container, database, '\n'.join(statements))
    after = set(sql(container, database, 'select hash from drizzle.__drizzle_migrations').splitlines())
    assert applied <= after, 'Existing migration history lost'
    assert all(p['sha256'] in after for p in PINNED.values())
    print('All five upstream migration hashes present; previous history preserved.')


if __name__ == '__main__':
    main()
