const FEISHU_APPLINK_HOST = 'applink.feishu.cn';
const FEISHU_CHAT_PATH = '/client/chat/open';
const FEISHU_OPEN_ID_PATTERN = /^ou_[\w-]+$/;

export const resolveFeishuAdminContactUrl = (value?: string): string | undefined => {
  const candidate = value?.trim();
  if (!candidate) return;

  try {
    const url = new URL(candidate);
    const openId = url.searchParams.get('openId')?.trim();

    if (
      url.protocol !== 'https:' ||
      url.hostname !== FEISHU_APPLINK_HOST ||
      url.port ||
      url.pathname !== FEISHU_CHAT_PATH ||
      !openId ||
      !FEISHU_OPEN_ID_PATTERN.test(openId)
    ) {
      return;
    }

    return url.toString();
  } catch {
    return;
  }
};
