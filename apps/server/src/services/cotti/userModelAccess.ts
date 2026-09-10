import { AgentRuntimeError, type ModelRuntimeHooks } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';
import { TRPCError } from '@trpc/server';

import { isVipModel } from '@/_custom/registry/userModelAccess';
import { CottiModelDisplayModel } from '@/database/models/cottiModelDisplay';
import { CottiUserPolicyModel } from '@/database/models/cottiUserPolicy';
import type { LobeChatDatabase } from '@/database/type';

export const assertCottiAgentAllowed = async (db: LobeChatDatabase, userId: string) => {
  if (!(await new CottiUserPolicyModel(db).get(userId)).agentEnabled)
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '管理员尚未为你开启 Agent，请使用普通对话或联系管理员。',
    });
};

export const createUserModelAccessGuard = (
  provider: string,
  scope?: { db: LobeChatDatabase; userId: string },
): ModelRuntimeHooks => {
  const check = async (payload: { model: string }) => {
    if (!scope) return;
    const policy = await new CottiUserPolicyModel(scope.db).get(scope.userId);
    const config = await new CottiModelDisplayModel(scope.db).getConfig();
    if (!policy.vip && isVipModel(config, { provider, model: payload.model }))
      throw AgentRuntimeError.createError(ChatErrorType.Forbidden, {
        message: '此模型仅限 VIP 用户使用，请选择普通模型或联系管理员。',
      });
  };
  return { beforeChat: check, beforeGenerateObject: check };
};
