/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';

import { config } from './proxy';

vi.mock('@/libs/next/proxy/define-config', () => ({
  defineConfig: () => ({ middleware: vi.fn() }),
}));

const matchesProxyConfig = (pathname: string) =>
  config.matcher.some((matcher) => new RegExp(`^${matcher}$`).test(pathname));

describe('proxy matcher', () => {
  it.each(['/overview', '/overview/topic-1'])('routes %s through the SPA proxy', (pathname) => {
    expect(matchesProxyConfig(pathname)).toBe(true);
  });
});
