import { sql } from 'drizzle-orm';

import { messages, taskTopics } from '@/database/schemas';

/**
 * A user message that represents direct product use rather than background work.
 *
 * Scheduled and heartbeat Task runs persist their generated prompt as a normal
 * `role = 'user'` message, so role alone cannot distinguish a person interacting
 * from automation running on their behalf. Other server-owned background agent
 * runs carry a request trigger in message metadata and are excluded as well.
 */
export const cottiRealUserMessageCondition = sql<boolean>`
  ${messages.role} = 'user'
  AND COALESCE(${messages.metadata}->>'trigger', '') NOT IN (
    'agent_signal',
    'cron',
    'eval',
    'file_embedding',
    'memory',
    'notify',
    'signup_email_llm_review'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM ${taskTopics}
    WHERE ${taskTopics.topicId} = ${messages.topicId}
      AND ${taskTopics.trigger} IN ('schedule', 'heartbeat')
  )
`;
