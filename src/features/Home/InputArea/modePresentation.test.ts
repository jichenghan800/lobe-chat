import { describe, expect, it } from 'vitest';

import zhChat from '../../../../locales/zh-CN/chat.json';
import zhHome from '../../../../locales/zh-CN/home.json';
import chat from '../../../../packages/locales/src/default/chat';
import home from '../../../../packages/locales/src/default/home';
import {
  HOME_AGENT_ACCESS_HINT_KEY,
  HOME_MODE_ORDER,
  homeModePresentation,
} from './modePresentation';

describe('home mode presentation', () => {
  it('orders the homepage modes as Chat, Agent, then Task', () => {
    expect(HOME_MODE_ORDER).toEqual(['chat', 'agent', 'task']);
    expect(HOME_MODE_ORDER.map((mode) => zhHome[homeModePresentation[mode].labelKey])).toEqual([
      '对话 Chat',
      '智能 Agent',
      '任务 Task',
    ]);
  });

  it('presents the homepage conversation entry as Chat instead of Agent', () => {
    const presentation = homeModePresentation.chat;

    expect(home[presentation.labelKey]).toBe('Chat');
    expect(presentation.descriptionNamespace).toBe('chat');
    expect(presentation.descriptionKey).toBe('chatMode.chatDesc');
    expect(chat[presentation.descriptionKey]).toBe(
      'No runtime environment or autonomy; uses fewer tokens',
    );
  });

  it('uses the existing Agent runtime description for the homepage Agent entry', () => {
    const presentation = homeModePresentation.agent;

    expect(home[presentation.labelKey]).toBe('Agent');
    expect(presentation.descriptionNamespace).toBe('chat');
    expect(chat[presentation.descriptionKey]).toBe(
      'Agent can use tools and environment to complete tasks automatically',
    );
  });

  it('reuses the conversation Agent access hint on the homepage', () => {
    expect(chat[HOME_AGENT_ACCESS_HINT_KEY]).toBe(
      'Agent mode requires basic training before activation. Contact your platform administrator to request access.',
    );
    expect(zhChat[HOME_AGENT_ACCESS_HINT_KEY]).toBe(
      'Agent 智能模式需完成基础培训后开通，请联系平台管理员申请。',
    );
  });

  it('keeps Task as the other homepage mode', () => {
    const presentation = homeModePresentation.task;

    expect(home[presentation.labelKey]).toBe('Task');
    expect(presentation.descriptionNamespace).toBe('home');
    expect(presentation.descriptionKey).toBe('dashboard.modeDesc.task');
  });
});
