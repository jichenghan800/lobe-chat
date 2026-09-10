import { describe, expect, it } from 'vitest';

import { resolveFeishuAdminContactUrl } from './feishuSupport';

describe('resolveFeishuAdminContactUrl', () => {
  it('accepts an official Feishu direct-chat AppLink', () => {
    const url =
      'https://applink.feishu.cn/client/chat/open?openId=ou_2f3bf7b5efa5fd9b70d5d5993b3a2e82';

    expect(resolveFeishuAdminContactUrl(`  ${url}  `)).toBe(url);
  });

  it.each([
    undefined,
    '',
    'not-a-url',
    'http://applink.feishu.cn/client/chat/open?openId=ou_user',
    'https://applink.feishu.cn.evil.example/client/chat/open?openId=ou_user',
    'https://applink.feishu.cn:8443/client/chat/open?openId=ou_user',
    'https://applink.feishu.cn/client/contact/open?openId=ou_user',
    'https://applink.feishu.cn/client/chat/open',
    'https://applink.feishu.cn/client/chat/open?openId=invalid_user',
  ])('rejects invalid or unsafe configuration: %s', (url) => {
    expect(resolveFeishuAdminContactUrl(url)).toBeUndefined();
  });
});
