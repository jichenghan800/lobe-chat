import { describe, expect, it } from 'vitest';

import { formatCost, formatUsd } from './format';

describe('overview recorded cost display', () => {
  it('converts stored USD using the topic budget exchange rate', () => {
    expect(formatCost(1)).toBe('¥7.12');
    expect(formatCost(10)).toBe('¥71.20');
    expect(formatUsd(1)).toBe('$1.00');
  });
  it('does not show a small positive recorded fee as zero', () => {
    expect(formatCost(0.0001)).toBe('<¥0.01');
    expect(formatCost(0)).toBe('¥0.00');
  });
});
