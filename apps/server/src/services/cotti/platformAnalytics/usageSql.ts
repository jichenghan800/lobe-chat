import { sql } from 'drizzle-orm';

import { messages } from '@/database/schemas';

type MessageUsageField = 'cost' | 'totalInputTokens' | 'totalOutputTokens';

const usageText = (field: MessageUsageField) => {
  switch (field) {
    case 'cost': {
      return sql`COALESCE(
        ${messages.usage}->>'cost',
        ${messages.metadata}->'usage'->>'cost',
        ${messages.metadata}->>'cost'
      )`;
    }
    case 'totalInputTokens': {
      return sql`COALESCE(
        ${messages.usage}->>'totalInputTokens',
        ${messages.metadata}->'usage'->>'totalInputTokens',
        ${messages.metadata}->>'totalInputTokens'
      )`;
    }
    case 'totalOutputTokens': {
      return sql`COALESCE(
        ${messages.usage}->>'totalOutputTokens',
        ${messages.metadata}->'usage'->>'totalOutputTokens',
        ${messages.metadata}->>'totalOutputTokens'
      )`;
    }
  }
};

export const cottiMessageUsageNumber = (field: MessageUsageField) => {
  const value = usageText(field);

  return sql<number>`CASE
    WHEN ${value} ~ '^-?[0-9]+([.][0-9]+)?$' THEN (${value})::numeric
    ELSE 0
  END`;
};
