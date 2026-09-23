// Keep deployed dependencies/UI fixed while applying the audited source method.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const ts = require('typescript');

const [base, target, directory] = process.argv.slice(2);
if (!base || !target || !directory)
  throw new Error('base image, new image, output directory required');
if (cp.spawnSync('docker', ['image', 'inspect', target], { stdio: 'ignore' }).status === 0)
  throw new Error('Target image already exists');
const run = (...args) => cp.execFileSync(args[0], args.slice(1), { encoding: 'utf8' }).trim();
const root = path.resolve(directory);
fs.mkdirSync(root, { recursive: true });
const source = fs.readFileSync('apps/server/src/modules/S3/index.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const methodStart = compiled.indexOf('async completeMultipartUpload(');
const methodEnd = compiled.indexOf('async abortMultipartUpload(', methodStart);
if (methodStart < 0 || methodEnd < 0) throw new Error('Source method not found');
const method = compiled.slice(methodStart, methodEnd);
if (!method || !method.includes('page.IsTruncated === false') || !method.includes('seenMarkers'))
  throw new Error('Unexpected source method');
const id = run('docker', 'create', base);
let edits = [];
try {
  run('docker', 'cp', id + ':/app/.next/server/chunks', root + '/chunks');
  const visit = (p) =>
    fs
      .readdirSync(p, { withFileTypes: true })
      .flatMap((x) => (x.isDirectory() ? visit(path.join(p, x.name)) : [path.join(p, x.name)]));
  for (const file of visit(root + '/chunks').filter((x) => x.endsWith('.js'))) {
    const body = fs.readFileSync(file, 'utf8');
    if (!body.includes('async completeMultipartUpload(')) continue;
    const matches = [
      ...body.matchAll(/async completeMultipartUpload\([\s\S]*?(?=async abortMultipartUpload\()/g),
    ];
    if (matches.length !== 1) throw new Error('Ambiguous method ' + file);
    const old = matches[0][0];
    const sdk = old.match(/new ([\w$]+)\.CompleteMultipartUploadCommand\(/)?.[1];
    if (!sdk || !old.includes('.paginateListParts)') || old.includes('IsTruncated'))
      throw new Error('Unexpected base method ' + file);
    const replacement = method.replaceAll('client_s3_1.', sdk + '.') + ' ';
    if (replacement.includes('client_s3_1')) throw new Error('Unresolved SDK binding');
    fs.writeFileSync(file, body.replace(old, replacement));
    run('node', '--check', file);
    edits.push(path.relative(root, file));
    const overlay = path.join(root, 'overlay', path.relative(root, file));
    fs.mkdirSync(path.dirname(overlay), { recursive: true });
    fs.copyFileSync(file, overlay);
    fs.writeFileSync(
      root + '/method.js',
      'module.exports = function(sdk) { return class { ' +
        method.replaceAll('client_s3_1.', 'sdk.') +
        ' }; };',
    );
  }
  if (!edits.length) throw new Error('No matching S3 methods');
  fs.writeFileSync(
    root + '/Dockerfile',
    `FROM ${base}\nUSER root\nCOPY --chown=1001:1001 overlay/ /app/.next/server/\nUSER nextjs\n`,
  );
  fs.writeFileSync(
    root + '/manifest.json',
    JSON.stringify(
      {
        base,
        baseId: JSON.parse(run('docker', 'image', 'inspect', base))[0].Id,
        target,
        patchedChunks: edits,
      },
      null,
      2,
    ),
  );
  run('docker', 'build', '-t', target, root);
  console.info(JSON.stringify({ target, patchedChunks: edits.length }));
} finally {
  run('docker', 'rm', id);
}
