import { router } from '@/libs/trpc/lambda';

import { cottiAdminProcedure } from './procedure';

export const cottiAdminRouter = router({
  getAccess: cottiAdminProcedure.query(({ ctx }) => ({
    data: {
      email: ctx.platformAdmin.normalizedEmail || ctx.platformAdmin.email,
      isAdmin: true,
      source: ctx.platformAdmin.source,
    },
    success: true,
  })),
});
