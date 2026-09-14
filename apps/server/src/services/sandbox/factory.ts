import { sandboxEnv } from '@/envs/sandbox';

import { SandboxCapacityService } from './capacity';
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

const createSandboxProvider = (options: SandboxServiceOptions): SandboxProvider => {
  switch (getSandboxProviderKind()) {
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

export const createSandboxService = (options: SandboxServiceOptions): SandboxService => {
  return new SandboxMiddlewareService(createSandboxProvider(options), options);
};
