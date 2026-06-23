import { eq } from 'drizzle-orm';

import { CottiAgentAccessModel } from '@/database/models/cottiAgentAccess';
import { users } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';

import {
  type CottiAgentAccessSubject,
  getCottiAgentAccessMode,
  isCottiAgentAccessEnabledForSubjectFromEnv,
} from './agentAccess';

export const resolveCottiAgentAccessForUser = async (
  db: LobeChatDatabase,
  userId: string | null | undefined,
) => {
  const accessModel = new CottiAgentAccessModel(db);
  const settings = await accessModel.getSettings();

  if (settings?.mode === 'open') return true;
  if (settings?.mode === 'off') return false;

  if (!userId) {
    if (settings) return false;

    return isCottiAgentAccessEnabledForSubjectFromEnv({});
  }

  const [user] = await db
    .select({
      email: users.email,
      normalizedEmail: users.normalizedEmail,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subject: CottiAgentAccessSubject = {
    email: user?.email,
    normalizedEmail: user?.normalizedEmail,
    userId,
  };

  if (settings) return accessModel.isSubjectAllowed(subject);

  const envMode = getCottiAgentAccessMode();
  if (envMode === 'open') return true;
  if (envMode === 'off') return false;

  const dbAllowed = await accessModel.isSubjectAllowed(subject);
  if (dbAllowed) return true;

  return isCottiAgentAccessEnabledForSubjectFromEnv(subject);
};
