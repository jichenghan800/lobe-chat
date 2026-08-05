import { describe, expect, it } from 'vitest';

import chat from '../../../../packages/locales/src/default/chat';
import home from '../../../../packages/locales/src/default/home';
import { homeModePresentation } from './modePresentation';

describe('home mode presentation', () => {
  it('presents the homepage conversation entry as Chat instead of Agent', () => {
    const presentation = homeModePresentation.chat;

    expect(home[presentation.labelKey]).toBe('Chat');
    expect(presentation.descriptionNamespace).toBe('chat');
    expect(presentation.descriptionKey).toBe('chatMode.chatDesc');
    expect(chat[presentation.descriptionKey]).toBe(
      'No runtime environment or autonomy; uses fewer tokens',
    );
  });

  it('keeps Task as the other homepage mode', () => {
    const presentation = homeModePresentation.task;

    expect(home[presentation.labelKey]).toBe('Task');
    expect(presentation.descriptionNamespace).toBe('home');
    expect(presentation.descriptionKey).toBe('dashboard.modeDesc.task');
  });
});
