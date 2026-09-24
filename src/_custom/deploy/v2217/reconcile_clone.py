"""Replay skipped upstream migrations on the isolated acceptance database only.

Preserves applied customization history and official migration hashes/timestamps.
No DATABASE_URL, live container or arbitrary database argument is accepted.
"""

import hashlib
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
MIGRATIONS = ROOT / "packages/database/migrations"
EXPECTED = {
    "0158_file_upload_reservations": "e99830a833a27abbf8a6d44f440375891f14c092e4b94f3c16fc614e3c78219d",
    "0159_task_activities": "4208937254b4618f2c985c0e9cf7f82a279e129350241d6a6f99ed6cdcc0ee05",
    "0160_acceptance_check_assets": "deed376aa6e4aa7abd0b9e89aaf62bf35c1b06857fc76a2966198802282bbb9f",
    "0161_acceptance_comments": "2bc76dfd05a525a53706390ad97f6c8868ab459a5b16fc68f215e5e479714aec",
}


def build_sql():
    entries = {
        e["tag"]: e for e in json.loads((MIGRATIONS / "meta/_journal.json").read_text())["entries"]
    }
    sql = [
        "\\set ON_ERROR_STOP on",
        "BEGIN;",
        "SET LOCAL lock_timeout = '5s';",
        "SET LOCAL statement_timeout = '120s';",
        "SELECT pg_advisory_xact_lock(2217, 158);",
        """DO $$ BEGIN
          IF current_database() <> 'lobehub_v2217_acceptance' THEN
            RAISE EXCEPTION 'Only the isolated acceptance database is allowed';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations
            WHERE hash = '226afa6341a1b59d6123b2c8c745e52c1d3201048f9786aa499b0ccd7cfc8a32') THEN
            RAISE EXCEPTION 'Required upstream 0157 baseline is absent';
          END IF;
        END $$;""",
    ]
    for tag, expected in EXPECTED.items():
        data = (MIGRATIONS / (tag + ".sql")).read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError("Official migration checksum changed: " + tag)
        timestamp = int(entries[tag]["when"])
        sql.extend([
            f"SELECT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '{expected}') AS applied \\gset",
            "\\if :applied",
            f"\\echo Already applied: {tag}",
            "\\else",
            data.decode().replace("--> statement-breakpoint", "\n"),
            f"INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('{expected}', {timestamp});",
            f"\\echo Applied: {tag}",
            "\\endif",
        ])
    sql.append("COMMIT;")
    return "\n".join(sql)


if __name__ == "__main__":
    subprocess.run(
        ["docker", "exec", "-i", "lingshu-v2217-pg", "psql", "-X", "-U", "postgres", "-d", "lobehub_v2217_acceptance"],
        input=build_sql(), text=True, check=True,
    )
