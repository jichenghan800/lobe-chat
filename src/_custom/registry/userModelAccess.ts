import type { ModelDisplayConfig, ModelDisplayModelRef } from '@/types/modelDisplay';

import { isSameModelDisplayRef } from './modelDisplayConfig';

export const isVipModel = (config: ModelDisplayConfig, model: ModelDisplayModelRef) =>
  [...config.chat, ...config.agent].some(
    (item) => item.vip === true && isSameModelDisplayRef(item, model),
  );

export const filterModelsForVip = (
  config: ModelDisplayConfig,
  vip: boolean,
): ModelDisplayConfig => {
  if (vip) return config;
  const next = {
    ...config,
    defaults: { ...config.defaults },
    chat: config.chat.filter((item) => !isVipModel(config, item)),
    agent: config.agent.filter((item) => !isVipModel(config, item)),
  };
  for (const scope of ['chat', 'agent'] as const) {
    const current = next.defaults[scope];
    if (
      !current ||
      !next[scope].some((item) => item.enabled && isSameModelDisplayRef(item, current))
    ) {
      const first = next[scope].find((item) => item.enabled);
      next.defaults[scope] = first ? { model: first.model, provider: first.provider } : undefined;
    }
  }
  return next;
};

export const setModelVip = (
  config: ModelDisplayConfig,
  model: ModelDisplayModelRef,
  vip: boolean,
): ModelDisplayConfig => ({
  ...config,
  chat: config.chat.map((item) => (isSameModelDisplayRef(item, model) ? { ...item, vip } : item)),
  agent: config.agent.map((item) => (isSameModelDisplayRef(item, model) ? { ...item, vip } : item)),
});
