import type { ModelRuntime, ModelRuntimeHooks } from '@lobechat/model-runtime';
import { AgentRuntimeError } from '@lobechat/model-runtime';
import { ChatErrorType } from '@lobechat/types';
import { isRecord } from '@lobechat/utils/object';

import { isSameModelDisplayRef } from '@/_custom/registry/modelDisplayConfig';
import { resolveRetiredModel } from '@/_custom/registry/modelRetirement';
import { CottiModelDisplayModel } from '@/database/models/cottiModelDisplay';
import type { LobeChatDatabase } from '@/database/type';
import type { ModelDisplayModelRef } from '@/types/modelDisplay';

export const resolveCottiRuntimeModel = async (db: LobeChatDatabase, ref: ModelDisplayModelRef) => {
  const config = await new CottiModelDisplayModel(db).getConfig();
  return resolveRetiredModel(config, ref);
};

/** Check again immediately before the upstream call, including cached runtime instances. */
export const createModelRetirementGuard = (
  db: LobeChatDatabase,
  provider: string,
): ModelRuntimeHooks => {
  const check = async ({ model }: { model: string }) => {
    const requested = { model, provider };
    const target = await resolveCottiRuntimeModel(db, requested);
    if (!isSameModelDisplayRef(requested, target))
      throw AgentRuntimeError.createError(ChatErrorType.BadRequest, {
        message: '模型刚刚下线，请重试以使用管理员指定的替代模型',
      });
  };
  return { beforeChat: check, beforeGenerateObject: check };
};

/** Covers system jobs and cached transports as well as browser calls; does not cache policy. */
export const withModelRetirement = (
  runtime: ModelRuntime,
  provider: string,
  db: LobeChatDatabase,
  createRuntime: (provider: string) => Promise<ModelRuntime>,
): ModelRuntime =>
  new Proxy(runtime, {
    get(instance, property) {
      const method = Reflect.get(instance, property);
      if (property !== 'chat' && property !== 'generateObject')
        return typeof method === 'function' ? method.bind(instance) : method;
      return async (...args: unknown[]) => {
        const payload = args[0];
        if (!isRecord(payload) || typeof payload.model !== 'string')
          throw new Error('Missing model');
        const requested = { model: payload.model, provider };
        const target = await resolveCottiRuntimeModel(db, requested);
        if (isSameModelDisplayRef(requested, target)) return Reflect.apply(method, instance, args);
        const replacement = await createRuntime(target.provider);
        args[0] = { ...payload, model: target.model };
        return Reflect.apply(Reflect.get(replacement, property), replacement, args);
      };
    },
  });
