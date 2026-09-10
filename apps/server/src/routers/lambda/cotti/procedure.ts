import { authedProcedure } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { CottiPlatformAdminAccessService } from '@/server/services/cotti/adminAccess';

export const cottiAdminProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  const adminAccessService = new CottiPlatformAdminAccessService(ctx.serverDB, ctx.userId);
  const platformAdmin = await adminAccessService.requireAccess();

  return opts.next({
    ctx: {
      adminAccessService,
      platformAdmin,
    },
  });
});
