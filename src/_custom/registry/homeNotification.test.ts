import { describe, expect, it } from 'vitest';

import { resolveCottiHomeNotificationContent } from './homeNotification';

describe('COTTI Home notification presentation', () => {
  it('shows trimmed content only when the platform notification is enabled', () => {
    expect(resolveCottiHomeNotificationContent({ content: '  Notice  ', enabled: true })).toBe(
      'Notice',
    );
    expect(
      resolveCottiHomeNotificationContent({ content: 'Notice', enabled: false }),
    ).toBeUndefined();
    expect(resolveCottiHomeNotificationContent({ content: '   ', enabled: true })).toBeUndefined();
  });
});
