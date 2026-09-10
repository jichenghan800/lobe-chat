import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// Compiled equivalent of src/libs/document-loaders/loaders/pdf/index.ts.
// Fail closed if the pinned upstream image or compiled module changes.
const target = '/app/.next/server/chunks/_0xjfuaw._.js';
const source = await readFile(target, 'utf8');
assert.equal(
  createHash('sha256').update(source).digest('hex'),
  '103f77e2a8d53ebc561efd907e75a26bb3624116b8ff79fef5303d0da7f601e2',
  'Unexpected upstream PDF loader chunk',
);
const before = 's=(await e.A(883176)).default,a=Buffer.from(await t.arrayBuffer());return n=(await s(a)).text';
const after = before.replace('Buffer.from(', 'new Uint8Array(');
assert.equal(source.split(before).length, 2, 'Expected exactly one PDF loader');
const patched = source.replace(before, after);
await writeFile(target, patched);
console.log('PDF loader patched:', createHash('sha256').update(patched).digest('hex'));
