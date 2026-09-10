import { describe, expect, it, vi } from 'vitest';

import { summarizeTopicInChunks } from './topicContinuation';

describe('topic continuation', () => {
  it('processes the complete history with bounded requests and carries the previous summary', async () => {
    const received: string[] = [];
    const summarize = vi.fn(async (text: string, previous: string) => {
      received.push(text);
      return `${previous}next`;
    });
    const progress = vi.fn();
    const content = '历史材料'.repeat(25_000);
    const result = await summarizeTopicInChunks(
      [{ role: 'user', content }],
      summarize,
      new AbortController().signal,
      progress,
    );
    expect(received.every((text) => text.length <= 32_000)).toBe(true);
    expect(received.join('')).toContain(content);
    expect(summarize.mock.calls[1][1]).toBe('next');
    expect(result).toBe('next'.repeat(received.length));
  });
  it('cancellation stops before another paid request', async () => {
    const abort = new AbortController();
    const summarize = vi.fn(async () => {
      abort.abort();
      return 'summary';
    });
    await expect(
      summarizeTopicInChunks(
        [{ role: 'tool', content: 'x'.repeat(90_000) }],
        summarize,
        abort.signal,
        vi.fn(),
      ),
    ).rejects.toThrow();
    expect(summarize).toHaveBeenCalledTimes(1);
  });
  it('rejects an empty summary instead of opening an empty continuation', async () => {
    await expect(
      summarizeTopicInChunks(
        [{ role: 'user', content: 'work' }],
        async () => '',
        new AbortController().signal,
        vi.fn(),
      ),
    ).rejects.toThrow('Empty');
  });
});
