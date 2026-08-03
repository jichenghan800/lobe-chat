import { router } from '@/libs/trpc/lambda';

import { cottiAdminRouter } from './admin';

export const cottiRouter = router({
  admin: cottiAdminRouter,
});
