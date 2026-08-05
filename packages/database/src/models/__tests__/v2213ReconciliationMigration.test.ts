// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  path.resolve(import.meta.dirname, '../../../migrations/0119_reconcile_v2213_schema.sql'),
  'utf8',
);

describe('v2.2.13 COTTI reconciliation migration', () => {
  it('pins unqualified DDL to the public schema before creating tables', () => {
    const searchPathPosition = migration.indexOf('SET LOCAL search_path = public;');
    const firstTablePosition = migration.indexOf('CREATE TABLE');

    expect(searchPathPosition).toBeGreaterThanOrEqual(0);
    expect(searchPathPosition).toBeLessThan(firstTablePosition);
  });
});
