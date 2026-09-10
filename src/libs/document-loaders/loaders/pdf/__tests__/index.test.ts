// @vitest-environment node
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

describe('PdfLoader', () => {
  it.each(['reportlab.pdf', 'reportlab-uncompressed.pdf'])(
    'extracts and chunks a valid PDF with literal strings: %s',
    async (filename) => {
      // Vitest's VM can normalize typed arrays across realms and hide the
      // legacy parser's Buffer bug. Exercise the loader in a real Node process.
      const { stdout } = await execFileAsync(process.execPath, [
        '--require',
        require.resolve('tsx/cjs'),
        '-e',
        `
          const { readFile } = require('node:fs/promises');
          const { PdfLoader } = require(${JSON.stringify(path.join(__dirname, '../index.ts'))});
          (async () => {
          const bytes = await readFile(${JSON.stringify(path.join(__dirname, filename))});
          console.log(JSON.stringify(await PdfLoader(new Blob([bytes]))));
          })().catch(error => { console.error(error); process.exitCode = 1; });
        `,
      ]);
      const chunks = JSON.parse(stdout);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].pageContent).toContain('AMBER-8426');
      expect(chunks[0].pageContent).toContain('Tuesday at 09:30');
      expect(chunks[0].metadata.loc.pageNumber).toBe(1);
    },
  );
});
