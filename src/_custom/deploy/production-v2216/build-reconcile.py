#!/usr/bin/env python3
"""Emit a transaction for the inspected v2.2.13 COTTI lineage; never connect to a DB.
Apply only with psql -X -v ON_ERROR_STOP=1 after the final write pause and backup.
Official migration files remain immutable. Existing 0158 is adopted only after
exact structural comparison. Each original hash is recorded only after success.
"""
import hashlib
import json
from pathlib import Path

base = Path(__file__).resolve().parent
root = base.parents[3]
migrations = root / 'packages/database/migrations'
journal = json.loads((migrations / 'meta/_journal.json').read_text())['entries']
entries = [e for e in journal if 131 <= e['idx'] <= 165]
assert len(entries) == 35, 'Unexpected migration inventory'
legacy_hash = 'd947389dd2a31acd09ec8d0124fb83bcd7c04ff8121eb430f5ab31a82b29ba72'
print("\\set ON_ERROR_STOP on\nBEGIN;\nSET LOCAL search_path=public;\nSET LOCAL lock_timeout='10s';\nSET LOCAL statement_timeout='20min';")
print("SELECT pg_advisory_xact_lock(2216, 20260911);\nLOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE;")
print(f"""DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash='{legacy_hash}' AND created_at=1786088099399) THEN
  RAISE EXCEPTION 'Not the inspected COTTI production lineage; stop and investigate';
 END IF;
 IF EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at>1789098164321) THEN
  RAISE EXCEPTION 'Database is newer than this release';
 END IF;
END $$;""")
for e in entries:
    source = (migrations / (e['tag'] + '.sql')).read_text()
    digest = hashlib.sha256(source.encode()).hexdigest()
    print(f"SELECT NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash='{digest}' AND created_at={e['when']}) AS apply_{e['idx']} \\gset")
    print(f"\\if :apply_{e['idx']}\n\\echo Applying {e['tag']}")
    if e['idx'] == 132:
        # Upstream DROP is permitted only when both new tables are absent.
        print("""DO $$ BEGIN
 IF to_regclass('public.agent_labels') IS NOT NULL OR to_regclass('public.agent_label_assignments') IS NOT NULL THEN
  RAISE EXCEPTION 'Unjournaled agent labels exist; refusing upstream DROP';
 END IF;
END $$;""")
    if e['idx'] == 158:
        expected = json.dumps(json.loads((base / 'schema-0158.json').read_text()))
        query = (base / 'schema-0158.sql').read_text().strip().rstrip(';')
        print(f"""DO $adopt$ BEGIN
 IF ({query}) IS DISTINCT FROM $expected${expected}$expected$::jsonb THEN
  RAISE EXCEPTION 'Existing admission/admin tables differ from 0158; refusing adoption';
 END IF;
END $adopt$;""")
    else:
        print(source)
    print(f"INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('{digest}',{e['when']});\n\\endif")
print('COMMIT;')
