import { ContextMemoryItemSchema, PreferenceMemoryItemSchema } from '@lobechat/memory-user-memory';
import { z } from 'zod';

const MemorySourceIdsFallbackSchema = z
  .array(z.string())
  .nullable()
  .optional()
  .transform((value) => value ?? []);

export const ContextMemoryToolInputSchema = ContextMemoryItemSchema.extend({
  sourceIds: MemorySourceIdsFallbackSchema,
});

export const PreferenceMemoryToolInputSchema = PreferenceMemoryItemSchema.extend({
  sourceIds: MemorySourceIdsFallbackSchema,
});
