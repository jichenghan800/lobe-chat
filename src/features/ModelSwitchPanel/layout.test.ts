import { describe, expect, it } from 'vitest';

import { getModelSwitchPanelHeightConstraints } from './layout';

describe('getModelSwitchPanelHeightConstraints', () => {
  it('uses intrinsic content height and only caps overflowing candidates', () => {
    expect(getModelSwitchPanelHeightConstraints()).toEqual({
      contentHeight: 'auto',
      maxListHeight: 'max(0px, calc(min(460px, var(--available-height, 460px)) - 40px))',
      maxPanelHeight: 'min(460px, var(--available-height, 460px))',
    });
  });
});
