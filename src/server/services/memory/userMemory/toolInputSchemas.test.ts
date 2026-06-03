import { describe, expect, it } from 'vitest';

import { ContextMemoryToolInputSchema, PreferenceMemoryToolInputSchema } from './toolInputSchemas';

describe('memory tool input schemas', () => {
  it('defaults missing context sourceIds to an empty array', () => {
    const result = ContextMemoryToolInputSchema.safeParse({
      details: 'The user is investigating a local chat failure.',
      memoryCategory: 'work',
      memoryType: 'context',
      summary: 'The user is diagnosing a local LobeChat issue.',
      tags: ['debugging'],
      title: 'Local chat diagnosis',
      withContext: {
        associatedObjects: [],
        associatedSubjects: [],
        currentStatus: 'ongoing',
        description: 'The user is diagnosing a local chat failure after a URL-related prompt.',
        labels: ['debugging'],
        scoreImpact: 0.5,
        scoreUrgency: 0.5,
        title: 'Local issue investigation',
        type: 'project',
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sourceIds).toEqual([]);
  });

  it('defaults nullable preference sourceIds to an empty array', () => {
    const result = PreferenceMemoryToolInputSchema.safeParse({
      details: 'The user prefers low-intrusion fixes for second-development patches.',
      memoryCategory: 'work',
      memoryType: 'preference',
      sourceIds: null,
      summary: 'The user prefers minimal code changes.',
      tags: ['engineering'],
      title: 'Minimal patch preference',
      withPreference: {
        appContext: null,
        conclusionDirectives: 'Prefer minimal code changes that preserve existing behavior.',
        extractedLabels: ['minimal-change'],
        extractedScopes: ['engineering'],
        originContext: null,
        scorePriority: 0.8,
        suggestions: [],
        type: 'engineering',
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sourceIds).toEqual([]);
  });
});
