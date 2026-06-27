import { describe, expect, it } from 'vitest';

import { MAX_PANEL_HEIGHT, TOOLBAR_HEIGHT } from '../const';
import { type ListItem } from '../types';
import { resolvePanelHeight } from './usePanelSize';

describe('resolvePanelHeight', () => {
  it('uses compact height for a small model list', () => {
    const listItems = Array.from({ length: 5 }, () => ({
      data: {
        displayName: 'COTTI',
        model: { id: 'model' },
        providers: [{ id: 'provider', name: 'Provider' }],
      },
      type: 'model-item-single',
    })) as ListItem[];

    expect(resolvePanelHeight(listItems)).toBeLessThan(MAX_PANEL_HEIGHT);
    expect(resolvePanelHeight(listItems)).toBe(238);
  });

  it('caps long model lists at the maximum panel height', () => {
    const listItems = Array.from({ length: 30 }, () => ({ type: 'no-provider' })) as ListItem[];

    expect(resolvePanelHeight(listItems)).toBe(MAX_PANEL_HEIGHT);
  });

  it('keeps the empty-provider state compact', () => {
    expect(resolvePanelHeight([{ type: 'no-provider' }])).toBe(TOOLBAR_HEIGHT + 38 + 8);
  });
});
