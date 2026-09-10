import { describe, expect, it } from 'vitest';

import { hasExplicitTopicSwitch } from './topicSwitchSuggestion';

describe('explicit topic switch suggestions', () => {
  it.each([
    '换个话题，帮我写一封邮件',
    '  我想换一个话题：帮我安排会议',
    '我们换个问题。',
    '另外一个不相关的问题：明天怎么安排？',
    '问个不相关的问题',
    '先不聊这个了，帮我查一下',
    'Let’s switch topics',
  ])('recognizes an explicit opening: %s', (draft) => {
    expect(hasExplicitTopicSwitch(draft)).toBe(true);
  });
  it.each([
    'Unrelated question: can you help with my report?',
    "Let's switch the topic. Help me write a letter.",
    'On an unrelated note, how do I export?',
  ])('recognizes English openings: %s', (draft) => {
    expect(hasExplicitTopicSwitch(draft)).toBe(true);
  });
  it.each([
    '',
    '继续',
    '另一个问题：刚才的公式怎么计算？',
    '不要换个话题，继续这个任务',
    '他说“换个话题”，这是什么意思？',
    '> 换个话题，帮我写邮件',
    '```\n换个话题\n```',
    '翻译以下句子：\nUnrelated question: why?',
    '换个话题的按钮在哪里？',
    'Unrelated questions are not allowed',
  ])('does not classify uncertain, quoted or continuing input: %s', (draft) => {
    expect(hasExplicitTopicSwitch(draft)).toBe(false);
  });
});
