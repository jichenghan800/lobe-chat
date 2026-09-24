import { sql } from 'drizzle-orm';

import { messages } from '@/database/schemas';

export const cottiMessageUsageNumber = (
  field: 'cost' | 'totalInputTokens' | 'totalOutputTokens',
) => {
  const values = [
    sql`${messages.usage}->>${field}`,
    sql`${messages.metadata}->'usage'->>${field}`,
    sql`${messages.metadata}->>${field}`,
  ];
  const valid = values.map(
    (value) =>
      sql`CASE WHEN ${value} ~ '^[0-9]+([.][0-9]+)?([eE][+-]?[0-9]{1,2})?$' THEN (${value})::numeric END`,
  );
  return sql<number>`COALESCE(${sql.join(valid, sql`, `)}, 0)`;
};
