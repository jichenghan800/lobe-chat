import { CottiSandboxModel } from '@/database/models/cottiSandbox';
import { sandboxEnv } from '@/envs/sandbox';

import { SandboxCapacityService } from './capacity';
import { guardSandboxExecution } from './executionGuard';
import { MarketSandboxProvider } from './providers/market';
import { OnlyboxesSandboxProvider } from './providers/onlyboxes';
import { SandboxMiddlewareService } from './service';
import type {
  SandboxProvider,
  SandboxProviderKind,
  SandboxService,
  SandboxServiceOptions,
} from './types';

export const getSandboxProviderKind = (): SandboxProviderKind => {
  return sandboxEnv.SANDBOX_PROVIDER || 'market';
};

const createSandboxProvider = (
  options: SandboxServiceOptions,
  kind: SandboxProviderKind,
): SandboxProvider => {
  switch (kind) {
    case 'onlyboxes': {
      return new OnlyboxesSandboxProvider(
        options,
        new SandboxCapacityService(async () => {
          const { CottiSandboxModel } = await import('@/database/models/cottiSandbox');
          const db =
            options.serverDB ?? (await (await import('@/database/core/db-adaptor')).getServerDB());
          return new CottiSandboxModel(db);
        }),
      );
    }

    case 'market': {
      return new MarketSandboxProvider(options);
    }
  }
};

export const createSandboxService = async (
  options: SandboxServiceOptions,
): Promise<SandboxService> => {
  const db = options.serverDB ?? (await (await import('@/database/core/db-adaptor')).getServerDB());
  const selected = await new CottiSandboxModel(db).getTopicProvider(
    options.userId,
    options.topicId,
  );
  const kind = selected ?? getSandboxProviderKind();
  if (
    kind === 'onlyboxes' &&
    (!(sandboxEnv.ONLYBOXES_ENABLED || sandboxEnv.SANDBOX_PROVIDER === 'onlyboxes') ||
      !sandboxEnv.ONLYBOXES_BASE_URL ||
      !sandboxEnv.ONLYBOXES_JIT_SIGNING_KEY)
  ) {
    throw new Error(
      'Self-hosted sandbox is unavailable. The topic will not switch to cloud automatically.',
    );
  }
  return new SandboxMiddlewareService(
    guardSandboxExecution(
      createSandboxProvider({ ...options, serverDB: db }, kind),
      new CottiSandboxModel(db),
      options,
    ),
    {
      ...options,
      serverDB: db,
    },
  );
};
