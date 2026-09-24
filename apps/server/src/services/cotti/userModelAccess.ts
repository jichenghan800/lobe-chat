import { AgentRuntimeError, type ModelRuntimeHooks } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';
import { TRPCError } from '@trpc/server';

import { isVipModel } from '@/_custom/registry/userModelAccess';
import { CottiModelDisplayModel } from '@/database/models/cottiModelDisplay';
import { CottiUserGroupModel } from '@/database/models/cottiUserGroup';
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
    if (!(await new CottiUserGroupModel(scope.db).allows(scope.userId, provider, payload.model))) {
      throw AgentRuntimeError.createError(ChatErrorType.Forbidden, {
        code: 'USER_GROUP_CHANNEL_FORBIDDEN',
        message: '此模型不在你的用户组允许范围内，请选择组内模型或联系管理员。',
      });
    }
    const policy = await new CottiUserPolicyModel(scope.db).get(scope.userId);
    const config = await new CottiModelDisplayModel(scope.db).getUserConfig(scope.userId);
    if (!policy.vip && isVipModel(config, { provider, model: payload.model }))
      throw AgentRuntimeError.createError(ChatErrorType.Forbidden, {
        message: '此模型仅限 VIP 用户使用，请选择普通模型或联系管理员。',
      });
  };
  return {
    beforeChat: check,
    beforeGenerateObject: check,
    beforeCreateImage: check,
    beforeCreateVideo: check,
    beforeEmbeddings: check,
  };
};
