// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { SearXNGClient } from './client';
import { hetongxue } from './fixtures/searXNG';
import { SearXNGImpl } from './index';

vi.mock('@/envs/tools', () => ({
  toolsEnv: {
    SEARXNG_URL: 'https://demo.com',
  },
}));

describe('SearXNGImpl', () => {
  describe('query', () => {
    it('搜索结果超过10个', async () => {
      vi.spyOn(SearXNGClient.prototype, 'search').mockResolvedValueOnce(hetongxue);

      const searchImpl = new SearXNGImpl();
      const results = await searchImpl.query('何同学');

      // Assert
      expect(results.results.length).toEqual(43);
    });

    it('reports unavailable engines instead of a successful empty result', async () => {
      vi.spyOn(SearXNGClient.prototype, 'search').mockResolvedValueOnce({
        answers: [],
        corrections: [],
        infoboxes: [],
        number_of_results: 0,
        query: '古茗 2026 半年报',
        results: [],
        suggestions: [],
        unresponsive_engines: [
          ['google', 'CAPTCHA'],
          ['duckduckgo', 'timeout'],
        ],
      });

      const searchImpl = new SearXNGImpl();

      await expect(searchImpl.query('古茗 2026 半年报')).rejects.toMatchObject({
        message: 'SearXNG search engines unavailable: google: CAPTCHA, duckduckgo: timeout',
      });
    });
  });
});
