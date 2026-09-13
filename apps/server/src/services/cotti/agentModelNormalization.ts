import { TRPCError } from '@trpc/server';

import {
  getModelDisplayDefault,
  isModelEnabledInDisplayScope,
  isSameModelDisplayRef,
} from '@/_custom/registry/modelDisplayConfig';
import { resolveRetiredModel } from '@/_custom/registry/modelRetirement';
import { CottiModelDisplayModel } from '@/database/models/cottiModelDisplay';
import type { LobeChatDatabase } from '@/database/type';
import type { ModelDisplayConfig, ModelDisplayModelRef } from '@/types/modelDisplay';

import { getDeployedModelOptions } from './deployedModels';

interface AgentModelInput {
  model?: string | null;
  provider?: string | null;
}

export const resolveImportedAgentModel = (
  config: ModelDisplayConfig,
  deployed: ModelDisplayModelRef[],
  requested: AgentModelInput,
): ModelDisplayModelRef => {
  const available = (ref: ModelDisplayModelRef) =>
    isModelEnabledInDisplayScope(config, 'agent', ref) &&
    deployed.some((item) => isSameModelDisplayRef(item, ref));
  const source =
    requested.model?.trim() && requested.provider?.trim()
      ? { model: requested.model.trim(), provider: requested.provider.trim() }
      : undefined;

  if (source) {
    const retired = config.retirements?.some((r) => isSameModelDisplayRef(r.source, source));
    // An explicit administrator migration takes precedence over the generic import default.
    const resolved = retired ? resolveRetiredModel(config, source) : source;
    if (available(resolved)) return resolved;
    if (retired)
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: '管理员指定的替代模型不可用，请在平台模型管理中修正',
      });
  }

  const fallback = getModelDisplayDefault(config, 'agent');
  if (!fallback || !available(fallback))
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: '平台 Agent 默认模型不可用，请在平台模型管理中配置后重试',
    });
  return fallback;
};

/** One policy/deployment snapshot per batch; never issue one config query per member. */
export const createAgentModelNormalizer = async (db: LobeChatDatabase) => {
  const [config, deployed] = await Promise.all([
    new CottiModelDisplayModel(db).getConfig(),
    getDeployedModelOptions(),
  ]);
  return <T extends AgentModelInput>(input: T) => ({
    ...input,
    ...resolveImportedAgentModel(config, deployed, input),
  });
};
