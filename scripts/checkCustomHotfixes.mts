import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

interface HotfixCheck {
  file: string;
  name: string;
  /**
   * If provided, at least this many matches should be found in the file.
   * Useful for "auto-growing" guardrails (e.g., all P0 regression tests).
   */
  minMatches?: number;
  needles: string[];
}

const HOTFIX_REGRESSION_TITLE = "[HOTFIX-P0]";

const checks: HotfixCheck[] = [
  {
    file: 'packages/model-runtime/src/_custom/mergeGoogleFunctionResponses.ts',
    name: 'Vertex parallel tool response merger helper',
    needles: ['export const mergeGoogleFunctionResponses'],
  },
  {
    file: 'packages/model-runtime/src/core/contextBuilders/google.ts',
    name: 'Google context builder merger wiring',
    needles: [
      "import { mergeGoogleFunctionResponses } from '../../_custom/mergeGoogleFunctionResponses';",
      'const mergedContents = mergeGoogleFunctionResponses(filteredContents);',
      'return mergedContents;',
    ],
  },
  {
    file: 'packages/model-runtime/src/core/contextBuilders/google.test.ts',
    name: 'Parallel tool response regression test',
    // Auto-growing: require the presence of HOTFIX-P0 regression titles.
    needles: [HOTFIX_REGRESSION_TITLE],
    minMatches: 3,
  },
  {
    file: 'packages/model-runtime/src/_custom/mergeGoogleFunctionResponses.test.ts',
    name: 'Helper-level merge guardrail tests',
    needles: [HOTFIX_REGRESSION_TITLE],
    minMatches: 2,
  },
];

const refs = process.argv.slice(2);
const targetRefs = refs.length > 0 ? refs : ['WORKTREE'];

const run = (command: string): string => execSync(command, { encoding: 'utf8' }).trim();

const failures: string[] = [];

const validateContent = (refLabel: string, check: HotfixCheck, content: string) => {
  const matchCount = check.needles.reduce((count, needle) => count + content.split(needle).length - 1, 0);

  if (check.minMatches !== undefined && matchCount < check.minMatches) {
    failures.push(
      `[${refLabel}] ${check.name} expected >= ${check.minMatches} matches, got ${matchCount} in ${check.file}: ${check.needles.join(', ')}`,
    );
  }

  for (const needle of check.needles) {
    if (!content.includes(needle)) {
      failures.push(`[${refLabel}] ${check.name} not found in ${check.file}: ${needle}`);
    }
  }
};

for (const ref of targetRefs) {
  if (ref === 'WORKTREE') {
    for (const check of checks) {
      let content = '';
      try {
        content = readFileSync(check.file, 'utf8');
      } catch {
        failures.push(`[WORKTREE] missing file: ${check.file}`);
        continue;
      }

      validateContent('WORKTREE', check, content);
    }

    continue;
  }

  try {
    run(`git rev-parse --verify ${ref}`);
  } catch {
    failures.push(`[${ref}] ref not found`);
    continue;
  }

  for (const check of checks) {
    let content = '';
    try {
      content = run(`git show ${ref}:${check.file}`);
    } catch {
      failures.push(`[${ref}] missing file: ${check.file}`);
      continue;
    }

    validateContent(ref, check, content);
  }
}

if (failures.length > 0) {
  console.error('\n=== Hotfix Regression Failed ===');
  console.error('Hotfix verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Hotfix verification passed for refs: ${targetRefs.join(', ')}`);
