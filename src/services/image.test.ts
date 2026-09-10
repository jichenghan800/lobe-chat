import { beforeEach, describe, expect, it, vi } from 'vitest';

import { imageService } from './image';

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock('@/libs/trpc/client', () => ({ lambdaClient: { image: { createImage: { mutate } } } }));

describe('image generation count policy', () => {
  beforeEach(() => {
    mutate.mockReset();
    mutate.mockResolvedValue({ success: true });
  });
  it.each([1, 4, 8, 50])('submits one image when callers request %s', async (imageNum) => {
    const payload = {
      generationTopicId: 'topic',
      provider: 'azure',
      model: 'gpt-image-2',
      imageNum,
      params: { prompt: 'test' },
    };
    await imageService.createImage(payload);
    expect(mutate).toHaveBeenCalledWith({ ...payload, imageNum: 1 });
    expect(payload.imageNum).toBe(imageNum);
  });
});
