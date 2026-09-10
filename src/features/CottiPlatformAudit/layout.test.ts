import { describe, expect, it } from 'vitest';

import { AUDIT_TABLE_COLUMN_WIDTHS, AUDIT_TABLE_MIN_WIDTH } from './layout';

describe('CottiPlatformAudit table layout', () => {
  it('keeps the review columns compact enough for the platform content area', () => {
    expect(AUDIT_TABLE_COLUMN_WIDTHS.risk).toBeLessThanOrEqual(180);
    expect(AUDIT_TABLE_COLUMN_WIDTHS.analysis).toBeLessThanOrEqual(180);
    expect(AUDIT_TABLE_COLUMN_WIDTHS.actions).toBeLessThanOrEqual(80);
    expect(AUDIT_TABLE_MIN_WIDTH).toBeLessThanOrEqual(1210);
  });
});
