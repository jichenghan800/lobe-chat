import { isDesktop } from '@lobechat/const';
import { toast } from '@lobehub/ui/base-ui';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { resolveExecutionTarget } from '@/helpers/executionTarget';
import { useIsGatewayModeEnabled } from '@/helpers/gatewayMode';
import { useEffectiveAgencyConfig } from '@/hooks/useEffectiveAgencyConfig';
import { useMarketAuth } from '@/layout/AuthProvider/MarketAuth';
import { cottiSandboxService } from '@/services/cottiSandbox';
import { topicService } from '@/services/topic';
import { useChatStore } from '@/store/chat';
import {
  getPendingSandboxProvider,
  setPendingSandboxProvider,
} from '@/store/chat/pendingSandboxProvider';

import { chooseSandboxAccess } from './modal';
import { prepareSandboxSend } from './prepare';

interface Request {
  agentId: string;
  enabled: boolean;
  isCurrent: () => boolean;
  topicId?: string | null;
}

export const useSandboxAccess = (currentAgentId: string) => {
  const { agencyConfig, workspaceScoped } = useEffectiveAgencyConfig(currentAgentId);
  const deviceRoutingAvailable = useIsGatewayModeEnabled(currentAgentId);
  const target = resolveExecutionTarget(agencyConfig, {
    clientExecutionAvailable: isDesktop,
    deviceRoutingAvailable,
    isHetero: Boolean(agencyConfig?.heterogeneousProvider?.type),
    workspaceScoped,
  });
  const { signIn } = useMarketAuth();
  const { t } = useTranslation('chat');
  const busy = useRef(false);
  return async ({
    agentId,
    enabled,
    isCurrent,
    topicId,
  }: Request): Promise<false | { newTopic?: boolean }> => {
    if (!enabled || target !== 'sandbox') return {};
    if (busy.current) return false;
    busy.current = true;
    try {
      const detail = topicId ? await topicService.getTopicDetail(topicId) : undefined;
      if (!isCurrent()) return false;
      const provider = topicId
        ? (detail?.metadata?.sandboxProvider ?? 'market')
        : getPendingSandboxProvider(agentId);
      if (provider === 'onlyboxes') return {};
      const result = await prepareSandboxSend({
        choose: chooseSandboxAccess,
        isCurrent,
        preflight: cottiSandboxService.preflight,
        signIn: async () => (await signIn('sandbox')) !== null,
        switchProvider: async () => {
          if (!topicId) return 'switched';
          const result = await cottiSandboxService.switchUnusedTopic(topicId, 'onlyboxes');
          return result.status;
        },
      });
      if (!isCurrent() || result === 'cancel') return false;
      if (result === 'selfHosted' || result === 'new') {
        setPendingSandboxProvider(agentId, 'onlyboxes');
        if (topicId && result === 'selfHosted') await useChatStore.getState().refreshTopic();
      }
      return { newTopic: result === 'new' };
    } catch (error) {
      console.error('[SandboxAccess] Preflight failed', error);
      toast.error(t('sandboxAccess.checkFailed'));
      return false;
    } finally {
      busy.current = false;
    }
  };
};
