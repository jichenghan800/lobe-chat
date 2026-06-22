import { TRPCError } from '@trpc/server';
import debug from 'debug';
import { z } from 'zod';

import { publicProcedure, router } from '@/libs/trpc/lambda';
import { marketUserInfo, serverDatabase } from '@/libs/trpc/lambda/middleware';
import { MarketService } from '@/server/services/market';
import { SkillSorts } from '@/types/discover';

const log = debug('lobe-server:market:skill-router');

const getMarketAuthState = (ctx: { marketAccessToken?: string; marketUserInfo?: unknown }) => ({
  hasAccessToken: !!ctx.marketAccessToken,
  hasUserInfo: !!ctx.marketUserInfo,
});

const getResultSize = (result: unknown): number | undefined => {
  if (!result || typeof result !== 'object') return undefined;

  if ('items' in result && Array.isArray(result.items)) return result.items.length;
  if ('data' in result && Array.isArray(result.data)) return result.data.length;
  if ('categories' in result && Array.isArray(result.categories)) return result.categories.length;

  return undefined;
};

// Public procedure with optional user info for trusted client token
const marketProcedure = publicProcedure
  .use(serverDatabase)
  .use(marketUserInfo)
  .use(async ({ ctx, next }) => {
    return next({
      ctx: {
        marketService: new MarketService({
          accessToken: ctx.marketAccessToken,
          userInfo: ctx.marketUserInfo,
        }),
      },
    });
  });

export const skillRouter = router({
  getSkillCategories: marketProcedure
    .input(
      z
        .object({
          locale: z.string().optional(),
          q: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      const startTime = Date.now();
      log('getSkillCategories:start input=%O auth=%O', input, getMarketAuthState(ctx));

      try {
        const result = await ctx.marketService.getSkillCategories();
        log(
          'getSkillCategories:success durationMs=%d resultSize=%s',
          Date.now() - startTime,
          getResultSize(result) ?? 'unknown',
        );
        return result;
      } catch (error) {
        log('getSkillCategories:failed durationMs=%d error=%O', Date.now() - startTime, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch skill categories',
        });
      }
    }),

  getSkillDetail: marketProcedure
    .input(
      z.object({
        identifier: z.string(),
        locale: z.string().optional(),
        version: z.string().optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const startTime = Date.now();
      log(
        'getSkillDetail:start identifier=%s locale=%s version=%s auth=%O',
        input.identifier,
        input.locale,
        input.version,
        getMarketAuthState(ctx),
      );

      try {
        const result = await ctx.marketService.getSkillDetail(input.identifier, {
          locale: input.locale,
          version: input.version,
        });
        log(
          'getSkillDetail:success identifier=%s durationMs=%d',
          input.identifier,
          Date.now() - startTime,
        );
        return result;
      } catch (error) {
        log(
          'getSkillDetail:failed identifier=%s durationMs=%d error=%O',
          input.identifier,
          Date.now() - startTime,
          error,
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch skill detail',
        });
      }
    }),

  getSkillList: marketProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          locale: z.string().optional(),
          order: z.enum(['asc', 'desc']).optional(),
          page: z.number().optional(),
          pageSize: z.number().optional(),
          q: z.string().optional(),
          sort: z.nativeEnum(SkillSorts).optional(),
        })
        .optional(),
    )
    .query(async ({ input, ctx }) => {
      const startTime = Date.now();
      log('getSkillList:start input=%O auth=%O', input, getMarketAuthState(ctx));

      try {
        const result = await ctx.marketService.searchSkill(input ?? {});
        log(
          'getSkillList:success durationMs=%d resultSize=%s',
          Date.now() - startTime,
          getResultSize(result) ?? 'unknown',
        );
        return result;
      } catch (error) {
        log('getSkillList:failed durationMs=%d error=%O', Date.now() - startTime, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch skill list',
        });
      }
    }),
});
