import { describe, expect, it } from 'vitest';

import {
  MODEL_DISPLAY_EDITOR_COLUMN_MIN_WIDTH,
  MODEL_DISPLAY_IDENTITY_COLUMN_MAX_WIDTH,
  MODEL_DISPLAY_IDENTITY_COLUMN_MIN_WIDTH,
} from './modelDisplayLayout';

describe('model display row layout', () => {
  it('caps the identity column below the editor minimum width', () => {
    expect(MODEL_DISPLAY_IDENTITY_COLUMN_MIN_WIDTH).toBeLessThan(
      MODEL_DISPLAY_IDENTITY_COLUMN_MAX_WIDTH,
    );
    expect(MODEL_DISPLAY_IDENTITY_COLUMN_MAX_WIDTH).toBeLessThan(
      MODEL_DISPLAY_EDITOR_COLUMN_MIN_WIDTH,
    );
  });
});
