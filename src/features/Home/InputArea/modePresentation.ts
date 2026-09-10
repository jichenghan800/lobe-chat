import type { HomeMode } from '../types';

export const HOME_MODE_ORDER = ['chat', 'agent', 'task'] as const satisfies readonly HomeMode[];

export const homeModePresentation = {
  chat: {
    descriptionKey: 'chatMode.chatDesc',
    descriptionNamespace: 'chat',
    labelKey: 'dashboard.mode.chat',
  },
  agent: {
    descriptionKey: 'chatMode.agentDesc',
    descriptionNamespace: 'chat',
    labelKey: 'dashboard.mode.agent',
  },
  task: {
    descriptionKey: 'dashboard.modeDesc.task',
    descriptionNamespace: 'home',
    labelKey: 'dashboard.mode.task',
  },
} as const satisfies Record<
  HomeMode,
  {
    descriptionKey: string;
    descriptionNamespace: 'chat' | 'home';
    labelKey: string;
  }
>;
