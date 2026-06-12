import type { LobeChatDatabase } from '@lobechat/database';
import { users } from '@lobechat/database/schemas';
import { eq } from 'drizzle-orm';

import {
  type CottiAgentAccessSubject,
  isCottiAgentAccessEnabledForSubject,
} from './agentAccess';

export const resolveCottiAgentAccessForUser = async (
  db: LobeChatDatabase,
  userId: string | null | undefined,
) => {
  if (!userId) {
    return isCottiAgentAccessEnabledForSubject({});
  }

  const user = await db.query.users.findFirst({
    columns: {
      email: true,
      normalizedEmail: true,
    },
    where: eq(users.id, userId),
  });

  const subject: CottiAgentAccessSubject = {
    email: user?.email,
    normalizedEmail: user?.normalizedEmail,
    userId,
  };

  return isCottiAgentAccessEnabledForSubject(subject);
};
