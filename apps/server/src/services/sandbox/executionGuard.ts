import type { CottiSandboxModel } from '@/database/models/cottiSandbox';

import type { SandboxProvider, SandboxSessionContext } from './types';

// Only authentication rejection proves a request never reached execution.
// Timeouts and command errors remain pinned because files may have been written.
const isAuthRejection = (error?: { message?: string; name?: string }) =>
  ['invalid_token', 'token_expired', 'unauthorized'].includes(error?.name ?? '') ||
  error?.message === 'MARKET_AUTH_REQUIRED' ||
  /missing bearer token|invalid_token|token expired|unauthorized/i.test(error?.message ?? '');

export const guardSandboxExecution = (
  provider: SandboxProvider,
  model: CottiSandboxModel,
  context: SandboxSessionContext,
): SandboxProvider => {
  const run = async <T extends { error?: { message: string; name?: string }; success: boolean }>(
    execute: () => Promise<T>,
  ): Promise<T> => {
    const id = await model.beginExecution(context.userId, context.topicId, provider.kind);
    let authRejected = false;
    try {
      const result = await execute();
      authRejected = !result.success && isAuthRejection(result.error);
      return result;
    } finally {
      // If persistence fails, retain the pending marker instead of enabling an
      // unsafe switch. Never hold a database connection during remote execution.
      await model.finishExecution(context.userId, context.topicId, id, authRejected);
    }
  };
  return {
    capabilities: provider.capabilities,
    kind: provider.kind,
    callTool: (name, params) => run(() => provider.callTool(name, params)),
    exportFileToUploadUrl: (request) => run(() => provider.exportFileToUploadUrl(request)),
  };
};
