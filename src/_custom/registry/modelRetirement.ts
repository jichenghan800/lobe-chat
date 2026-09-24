import type { ModelDisplayConfig, ModelDisplayModelRef } from '@/types/modelDisplay';

import { isSameModelDisplayRef } from './modelDisplayConfig';

/** Resolve every link using one fresh configuration snapshot. Never fall back to a retired model. */
export const resolveRetiredModel = (
  config: ModelDisplayConfig,
  requested: ModelDisplayModelRef,
): ModelDisplayModelRef => {
  let current = requested;
  const visited: ModelDisplayModelRef[] = [];
  for (;;) {
    if (visited.some((ref) => isSameModelDisplayRef(ref, current)))
      throw new Error('模型替换配置存在循环，请联系管理员');
    visited.push(current);
    const retirement = config.retirements?.find((r) => isSameModelDisplayRef(r.source, current));
    if (retirement) {
      current = retirement.target;
      continue;
    }
    // Scope visibility is not a retirement: an Agent-only model can be hidden in Chat.
    // Explicit retirements above remain authoritative, even with a stale enabled row.
    const configured = [...config.chat, ...config.agent].filter((r) =>
      isSameModelDisplayRef(r, current),
    );
    if (configured.length > 0 && configured.every((r) => !r.enabled))
      throw new Error('该模型已下线，管理员尚未配置可用的替代模型');
    return current;
  }
};
