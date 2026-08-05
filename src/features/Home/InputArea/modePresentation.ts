import type { HomeMode } from '../types';

export const homeModePresentation = {
  chat: {
    descriptionKey: 'chatMode.chatDesc',
    descriptionNamespace: 'chat',
    labelKey: 'dashboard.mode.chat',
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
