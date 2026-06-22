import { type LobeChatDatabase } from '@lobechat/database';
import debug from 'debug';

import { UserModel } from '@/database/models/user';
import { type TrustedClientUserInfo } from '@/libs/trusted-client';

import { trpc } from '../init';

const log = debug('lobe-server:market-user-info');

interface ContextWithServerDB {
  marketAccessToken?: string;
  serverDB?: LobeChatDatabase;
  userId?: string | null;
}

const maskId = (id?: string | null) => (id ? `${id.slice(0, 8)}...` : id);

const getMarketAccessTokenFromSettings = (marketSettings: unknown): string | undefined => {
  if (!marketSettings || typeof marketSettings !== 'object') return undefined;
  if (!('accessToken' in marketSettings)) return undefined;

  const token = marketSettings.accessToken;
  return typeof token === 'string' && token.length > 0 ? token : undefined;
};

/**
 * Middleware that fetches user info for Market trusted client authentication
 * This requires serverDatabase middleware to be applied first
 */
export const marketUserInfo = trpc.middleware(async (opts) => {
  const ctx = opts.ctx as ContextWithServerDB;
  const startTime = Date.now();

  // If userId or serverDB is not available, skip fetching user info
  if (!ctx.userId || !ctx.serverDB) {
    log('skip: missing context userId=%s hasServerDB=%s', maskId(ctx.userId), !!ctx.serverDB);
    return opts.next({
      ctx: { marketUserInfo: undefined },
    });
  }

  try {
    const user = await UserModel.findById(ctx.serverDB, ctx.userId);

    if (!user || !user.email) {
      log(
        'skip: missing user email userId=%s foundUser=%s durationMs=%d',
        maskId(ctx.userId),
        !!user,
        Date.now() - startTime,
      );
      return opts.next({
        ctx: { marketUserInfo: undefined },
      });
    }

    const marketUserInfo: TrustedClientUserInfo = {
      email: user.email,
      name: user.fullName || user.username || undefined,
      userId: ctx.userId,
    };

    // Fetch market access token from user_settings.market
    const userModel = new UserModel(ctx.serverDB, ctx.userId);
    const userSettings = await userModel.getUserSettings();
    const marketTokenFromDB = getMarketAccessTokenFromSettings(userSettings?.market);

    // Prioritize database token over cookie token
    const marketAccessToken = marketTokenFromDB || ctx.marketAccessToken;

    log(
      'resolved: userId=%s hasEmail=%s tokenSource=%s durationMs=%d',
      maskId(ctx.userId),
      true,
      marketTokenFromDB ? 'db' : ctx.marketAccessToken ? 'cookie' : 'none',
      Date.now() - startTime,
    );

    return opts.next({
      ctx: {
        marketAccessToken,
        marketUserInfo,
      },
    });
  } catch (error) {
    // If fetching user info fails, continue without it
    log(
      'failed: userId=%s durationMs=%d error=%O',
      maskId(ctx.userId),
      Date.now() - startTime,
      error,
    );
    return opts.next({
      ctx: { marketUserInfo: undefined },
    });
  }
});
