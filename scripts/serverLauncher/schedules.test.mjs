import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Evaluate the real registration block without launching the app or migrations.
const source = fs.readFileSync(new URL('./startServer.js', import.meta.url), 'utf8');
const registration = source.slice(
  source.indexOf('const QSTASH_SCHEDULES ='),
  source.indexOf('// Main function'),
);
async function register(extra = {}) {
  const calls = [];
  const env = { QSTASH_TOKEN: 'test-token', APP_URL: 'https://candidate.example', ...extra };
  const context = vm.createContext({
    process: { env },
    console: { log() {}, warn() {}, error() {} },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true };
    },
  });
  await vm.runInContext(registration + '\ncreateQstashSchedule();', context);
  return calls;
}

test('migration candidate can connect to QStash without registering or overwriting schedules', async () => {
  assert.equal((await register({ QSTASH_DISABLE_SCHEDULES: 'true' })).length, 0);
});
test('shared QStash keeps deployment namespaces and callback destinations separate', async () => {
  const a = await register({ QSTASH_SCHEDULE_ID_PREFIX: 'candidate' });
  const b = await register({
    QSTASH_SCHEDULE_ID_PREFIX: 'other',
    APP_URL: 'https://other.example',
  });
  assert.equal(a.length, 2);
  assert.equal(b.length, 2);
  for (let i = 0; i < a.length; i++) {
    assert.notEqual(
      a[i].options.headers['Upstash-Schedule-Id'],
      b[i].options.headers['Upstash-Schedule-Id'],
    );
    assert.ok(a[i].url.includes('https://candidate.example/api/workflows/'));
    assert.ok(b[i].url.includes('https://other.example/api/workflows/'));
  }
});
test('default deployment preserves existing schedule identifiers', async () => {
  const calls = await register();
  assert.deepEqual(
    calls.map((c) => c.options.headers['Upstash-Schedule-Id']),
    ['lobe-task-schedule-dispatch', 'lobe-goal-sweep'],
  );
});
test('missing token does not register schedules', async () => {
  assert.equal((await register({ QSTASH_TOKEN: '' })).length, 0);
});
