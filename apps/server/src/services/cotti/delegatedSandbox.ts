import type { LobeAgentAgencyConfig, LobeAgentChatConfig } from '@lobechat/types';

import { resolveToolMode } from '@/helpers/executionTarget';

interface Options {
  agencyConfig?: LobeAgentAgencyConfig | null;
  chatConfig?: LobeAgentChatConfig | null;
  hasExplicitDevice: boolean;
  isolationThread?: boolean;
  shareVisitor: boolean;
}

/** Only an unconfigured native delegate may reuse its topic's already selected sandbox. */
export const shouldInheritTopicSandbox = (options: Options): boolean =>
  options.isolationThread === true &&
  !options.shareVisitor &&
  !options.hasExplicitDevice &&
  !options.agencyConfig?.boundDeviceId &&
  !options.agencyConfig?.heterogeneousProvider &&
  resolveToolMode(options.chatConfig ?? undefined) === 'agent' &&
  (options.agencyConfig?.executionTarget === undefined ||
    options.agencyConfig.executionTarget === 'none' ||
    options.agencyConfig.executionTarget === 'auto');
