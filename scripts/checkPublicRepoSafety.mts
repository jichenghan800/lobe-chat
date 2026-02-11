import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (command: string): string => execSync(command, { encoding: 'utf8' }).trim();

const trackedFiles = run('git ls-files')
  .split('\n')
  .map((f) => f.trim())
  .filter(Boolean);

const failures: string[] = [];

const isAllowedEnvTemplate = (file: string): boolean => {
  if (file === '.env.example' || file === '.env.example.development' || file === '.env.desktop') return true;

  if (file.endsWith('/.env.example') || file.endsWith('/.env.zh-CN.example')) return true;

  return false;
};

for (const file of trackedFiles) {
  const isDotEnvLike = /(^|\/)\.env(\..+)?$/.test(file);

  if (isDotEnvLike && !isAllowedEnvTemplate(file)) {
    failures.push(`Tracked runtime env file is not allowed in public mode: ${file}`);
  }
}

const checkFileContains = (file: string, pattern: RegExp, message: string) => {
  let content = '';
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    failures.push(`Required file missing: ${file}`);
    return;
  }

  if (pattern.test(content)) {
    failures.push(`${message} (${file})`);
  }
};

// Public safety baseline: this template file must never carry real keys.
checkFileContains(
  '.env.desktop',
  /^KEY_VAULTS_SECRET=(?!CHANGE_ME_).+/m,
  'Potential real secret found in .env.desktop KEY_VAULTS_SECRET',
);

// Avoid shipping production-enabled dev bypass in tracked env templates.
for (const file of trackedFiles.filter((f) => /(^|\/)\.env(\..+)?$/.test(f) && isAllowedEnvTemplate(f))) {
  checkFileContains(
    file,
    /^DEV_AUTH_BYPASS_ALLOW_PROD=1$/m,
    'DEV_AUTH_BYPASS_ALLOW_PROD must not be 1 in tracked env templates',
  );

  checkFileContains(
    file,
    /^DEV_AUTH_BYPASS_ENABLED=1$/m,
    'DEV_AUTH_BYPASS_ENABLED must not be 1 in tracked env templates',
  );

  checkFileContains(
    file,
    /BEGIN PRIVATE KEY/m,
    'Private key material must not appear in tracked env templates',
  );
}

if (failures.length > 0) {
  console.error('\n=== Public Security Gate Failed ===');
  console.error('Public repo safety checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Public repo safety checks passed.');
