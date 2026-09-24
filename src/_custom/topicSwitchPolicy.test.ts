import { describe, expect, it } from 'vitest';

import { isContextDependentContinuation } from './topicSwitchPolicy';

describe('whole-message continuation bypass', () => {
  it.each([
    '请重试',
    '请重试！',
    '麻烦再试一次',
    '请重新执行一下',
    '继续',
    '继续处理',
    '好的，请重试。',
    '同意，继续',
    '还是不对',
    '还是有问题',
    '按照第二个方案',
    '按之前的方案执行',
    '把刚才的结果导出',
    '请把它再缩短一点',
    '上面的内容展开一点',
    'please retry',
    'try again!',
    'OK, continue.',
    'still wrong',
  ])('recognizes dependent input: %s', (message) => {
    expect(isContextDependentContinuation(message)).toBe(true);
  });
  it.each([
    '',
    '查询北京明天的天气',
    '帮我写一份工作总结',
    '继续，另外帮我查北京明天的天气',
    '请重试，并查询北京天气',
    '换个话题，请继续上面的分析',
    '请重试连接 www.example.com',
    '“请重试”是什么意思',
    '> 请重试',
    '翻译：please retry',
    '请重试是一句常见提示',
    'continue writing a new report about solar energy',
  ])('leaves complex or independent input to the semantic gate: %s', (message) => {
    expect(isContextDependentContinuation(message)).toBe(false);
  });
});
