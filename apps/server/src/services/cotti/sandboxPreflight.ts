import { isRecord } from '@lobechat/utils/object';

export type SandboxCloudStatus = 'ready' | 'auth_required' | 'unavailable';

/** Check authorization without creating a sandbox or spending model tokens. */
export const checkSandboxCloudAccess = async (
  token: string | undefined,
  trusted: boolean,
  getUserInfo: (token: string) => Promise<unknown>,
): Promise<SandboxCloudStatus> => {
  if (trusted) return 'ready';
  if (!token) return 'auth_required';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      getUserInfo(token),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Market preflight timed out')), 8000);
      }),
    ]);
    return 'ready';
  } catch (error) {
    // A security checkpoint / generic 403 is NOT evidence of an expired login.
    return isRecord(error) && error.status === 401 ? 'auth_required' : 'unavailable';
  } finally {
    if (timer) clearTimeout(timer);
  }
};
