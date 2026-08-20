import type { ChatInputMode } from './hooks/useEffectiveAgentMode';

export const CHAT_INPUT_MODE_ORDER = ['chat', 'agent'] as const satisfies readonly ChatInputMode[];
