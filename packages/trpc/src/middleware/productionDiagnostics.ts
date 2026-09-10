import debug from 'debug';

import { trpc } from '../lambda/init';

const logs = {
  'agentDocument': debug('lobe-server:agent-document-router'),
  'agentSkills': debug('lobe-server:agent-skills-router'),
  'market.skill': debug('lobe-server:market:skill-router'),
};

/** Targeted incident diagnostics. Never log inputs, payloads, tokens or error messages. */
export const productionDiagnostics = trpc.middleware(async ({ next, path, type }) => {
  const entry = Object.entries(logs).find(([prefix]) => path.startsWith(`${prefix}.`));
  const log = entry?.[1];
  if (!log?.enabled) return next();

  const startedAt = Date.now();
  log('start path=%s type=%s', path, type);
  try {
    const result = await next();
    log(
      'done path=%s status=%s durationMs=%d count=%d',
      path,
      result.ok ? 'OK' : result.error.code,
      Date.now() - startedAt,
      result.ok && Array.isArray(result.data) ? result.data.length : -1,
    );
    return result;
  } catch (error) {
    log('failed path=%s durationMs=%d', path, Date.now() - startedAt);
    throw error;
  }
});
