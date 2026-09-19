import type { ModelRuntimeHooks } from '@lobechat/model-runtime';
import { isRecord } from '@lobechat/utils/object';

/** Opt-in diagnostics: tool names only, never prompts, arguments or credentials. */
export const createTopicToolTrace = (provider: string): ModelRuntimeHooks => ({
  beforeChat: async (payload, options) => {
    const topicId = options?.metadata?.topicId;
    const target = process.env.COTTI_TOOL_TRACE_TOPIC_ID;
    if (!target || topicId !== target) return;
    const tools = (payload.tools ?? []).flatMap((tool) => {
      if (!isRecord(tool)) return [];
      const fn = isRecord(tool.function) ? tool.function : tool;
      return typeof fn.name === 'string' ? [fn.name] : [];
    });
    console.info(
      '[cotti-topic-tool-trace]',
      JSON.stringify({
        model: payload.model,
        provider,
        topicId,
        tools,
      }),
    );
  },
});
