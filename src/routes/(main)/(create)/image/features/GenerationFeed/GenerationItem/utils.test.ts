import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type Generation, type GenerationBatch } from '@/types/generation';

// Import functions for testing
import { getAspectRatio, getImageDimensions, getThumbnailMaxWidth } from './utils';

describe('getImageDimensions', () => {
  // Mock base generation object
  const baseGeneration: Generation = {
    id: 'test-gen-id',
    seed: 12345,
    createdAt: new Date(),
    asyncTaskId: null,
    task: {
      id: 'task-id',
      status: 'success' as any,
    },
  };

  describe('with asset dimensions', () => {
    it('should return width, height and aspect ratio from asset', () => {
      const generation: Generation = {
        ...baseGeneration,
        asset: {
          type: 'image',
          width: 1920,
          height: 1080,
        },
      };

      const result = getImageDimensions(generation);
      expect(result).toEqual({
        width: 1920,
        height: 1080,
        aspectRatio: '1920 / 1080',
      });
    });

    it('should prioritize asset even when other sources exist', () => {
      const generation: Generation = {
        ...baseGeneration,
        asset: {
          type: 'image',
          width: 800,
          height: 600,
        },
      };

      const generationBatch: GenerationBatch = {
        id: 'batch-id',
        provider: 'test',
        model: 'test-model',
        prompt: 'test prompt',
        width: 1024,
        height: 1024,
        config: {
          prompt: 'test',
          width: 512,
          height: 512,
        },
        createdAt: new Date(),
        generations: [],
      };

      const result = getImageDimensions(generation, generationBatch);
      expect(result).toEqual({
        width: 800,
        height: 600,
        aspectRatio: '800 / 600',
      });
    });
  });

  describe('with config dimensions', () => {
    it('should return dimensions from config when asset is not available', () => {
      const generation: Generation = {
        ...baseGeneration,
        asset: null,
      };

      const generationBatch: GenerationBatch = {
        id: 'batch-id',
        provider: 'test',
        model: 'test-model',
        prompt: 'test prompt',
        config: {
          prompt: 'test',
          width: 1024,
          height: 768,
        },
        createdAt: new Date(),
        generations: [],
      };

      const result = getImageDimensions(generation, generationBatch);
      expect(result).toEqual({
        width: 1024,
        height: 768,
        aspectRatio: '1024 / 768',
      });
    });
  });

  describe('with batch top-level dimensions', () => {
    it('should return dimensions from batch when config is not available', () => {
      const generation: Generation = {
        ...baseGeneration,
        asset: null,
      };

      const generationBatch: GenerationBatch = {
        id: 'batch-id',
        provider: 'test',
        model: 'test-model',
        prompt: 'test prompt',
        width: 1280,
        height: 720,
        createdAt: new Date(),
        generations: [],
      };

      const result = getImageDimensions(generation, generationBatch);
      expect(result).toEqual({
        width: 1280,
        height: 720,
        aspectRatio: '1280 / 720',
      });
    });
  });

  describe('with size parameter', () => {
    it('should parse dimensions from size parameter', () => {
      const generation: Generation = {
        ...baseGeneration,
        asset: null,
      };

      const generationBatch: GenerationBatch = {
        id: 'batch-id',
        provider: 'test',
        model: 'test-model',
        prompt: 'test prompt',
        config: {
          prompt: 'test',
          size: '1920x1080',
        },
        createdAt: new Date(),
        generations: [],
      };

      const result = getImageDimensions(generation, generationBatch);
      expect(result).toEqual({
        width: 1920,
        height: 1080,
        aspectRatio: '1920 / 1080',
      });
    });

    it('should ignore size when it is "auto"', () => {
      const generation: Generation = {
        ...baseGeneration,
        asset: null,
      };

      const generationBatch: GenerationBatch = {
        id: 'batch-id',
        provider: 'test',
        model: 'test-model',
        prompt: 'test prompt',
        config: {
          prompt: 'test',
          size: 'auto',
          aspectRatio: '16:9',
        },
        createdAt: new Date(),
        generations: [],
      };

      const result = getImageDimensions(generation, generationBatch);
      expect(result).toEqual({
        width: null,
        height: null,
        aspectRatio: '16 / 9',
      });
    });
  });

  describe('with aspectRatio parameter only', () => {
    it('should return aspect ratio without dimensions', () => {
      const generation: Generation = {
        ...baseGeneration,
        asset: null,
      };

      const generationBatch: GenerationBatch = {
        id: 'batch-id',
        provider: 'test',
        model: 'test-model',
        prompt: 'test prompt',
        config: {
          prompt: 'test',
          aspectRatio: '16:9',
        },
        createdAt: new Date(),
        generations: [],
      };

      const result = getImageDimensions(generation, generationBatch);
      expect(result).toEqual({
        width: null,
        height: null,
        aspectRatio: '16 / 9',
      });
    });

    it('should handle various aspect ratio formats', () => {
      const testCases = [
        { aspectRatio: '1:1', expected: '1 / 1' },
        { aspectRatio: '4:3', expected: '4 / 3' },
        { aspectRatio: '16:9', expected: '16 / 9' },
        { aspectRatio: '21:9', expected: '21 / 9' },
      ];

      testCases.forEach(({ aspectRatio, expected }) => {
        const generation: Generation = {
          ...baseGeneration,
          asset: null,
        };

        const generationBatch: GenerationBatch = {
          id: 'batch-id',
          provider: 'test',
          model: 'test-model',
          prompt: 'test prompt',
          config: {
            prompt: 'test',
            aspectRatio,
          },
          createdAt: new Date(),
          generations: [],
        };

        const result = getImageDimensions(generation, generationBatch);
        expect(result.aspectRatio).toBe(expected);
      });
    });
  });

  describe('edge cases', () => {
    it('should return all null when no dimensions are available', () => {
      const generation: Generation = {
        ...baseGeneration,
        asset: null,
      };

      const result = getImageDimensions(generation);
      expect(result).toEqual({
        width: null,
        height: null,
        aspectRatio: null,
      });
    });

    it('should handle partial asset dimensions', () => {
      const generation: Generation = {
        ...baseGeneration,
        asset: {
          type: 'image',
          width: 1920,
          // height is missing
        },
      };

      const generationBatch: GenerationBatch = {
        id: 'batch-id',
        provider: 'test',
        model: 'test-model',
        prompt: 'test prompt',
        config: {
          prompt: 'test',
          width: 1024,
          height: 768,
        },
        createdAt: new Date(),
        generations: [],
      };

      const result = getImageDimensions(generation, generationBatch);
      expect(result).toEqual({
        width: 1024,
        height: 768,
        aspectRatio: '1024 / 768',
      });
    });

    it('should handle invalid size format', () => {
      const generation: Generation = {
        ...baseGeneration,
        asset: null,
      };

      const generationBatch: GenerationBatch = {
        id: 'batch-id',
        provider: 'test',
        model: 'test-model',
        prompt: 'test prompt',
        config: {
          prompt: 'test',
          size: 'invalid-format',
        },
        createdAt: new Date(),
        generations: [],
      };

      const result = getImageDimensions(generation, generationBatch);
      expect(result).toEqual({
        width: null,
        height: null,
        aspectRatio: null,
      });
    });

    it('should handle invalid aspectRatio format', () => {
      const generation: Generation = {
        ...baseGeneration,
        asset: null,
      };

      const generationBatch: GenerationBatch = {
        id: 'batch-id',
        provider: 'test',
        model: 'test-model',
        prompt: 'test prompt',
        config: {
          prompt: 'test',
          aspectRatio: 'invalid-format',
        },
        createdAt: new Date(),
        generations: [],
      };

      const result = getImageDimensions(generation, generationBatch);
      expect(result).toEqual({
        width: null,
        height: null,
        aspectRatio: null,
      });
    });

    it('should handle zero dimensions', () => {
      const generation: Generation = {
        ...baseGeneration,
        asset: {
          type: 'image',
          width: 0,
          height: 0,
        },
      };

      const result = getImageDimensions(generation);
      expect(result).toEqual({
        width: null,
        height: null,
        aspectRatio: null,
      });
    });
  });
});

describe('getAspectRatio (isolated unit testing)', () => {
  const mockGeneration: Generation = {
    id: 'test-gen-id',
    seed: 12345,
    createdAt: new Date(),
    asyncTaskId: null,
    task: {
      id: 'task-id',
      status: 'success' as any,
    },
  };
  const mockGenerationBatch: GenerationBatch = {
    id: 'test-batch-id',
    provider: 'test-provider',
    model: 'test-model',
    prompt: 'test prompt',
    createdAt: new Date(),
    generations: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return aspectRatio from getImageDimensions when dimensions have aspectRatio', () => {
    // Test the actual implementation directly with mock data
    const mockGen: Generation = {
      ...mockGeneration,
      asset: {
        type: 'image',
        width: 1920,
        height: 1080,
      },
    };

    const result = getAspectRatio(mockGen);
    expect(result).toBe('1920 / 1080');
  });

  it('should return default "1 / 1" when no dimensions are available', () => {
    const result = getAspectRatio(mockGeneration, mockGenerationBatch);
    expect(result).toBe('1 / 1');
  });

  it('should work with different aspectRatio sources', () => {
    const mockBatch: GenerationBatch = {
      id: 'test-batch',
      provider: 'test-provider',
      model: 'test-model',
      prompt: 'test prompt',
      createdAt: new Date(),
      generations: [],
      config: {
        prompt: 'test prompt',
        aspectRatio: '16:9',
      },
    };

    const result = getAspectRatio(mockGeneration, mockBatch);
    expect(result).toBe('16 / 9');
  });
});

describe('getThumbnailMaxWidth (isolated unit testing)', () => {
  const mockGeneration: Generation = {
    id: 'test-gen-id',
    seed: 12345,
    createdAt: new Date(),
    asyncTaskId: null,
    task: {
      id: 'task-id',
      status: 'success' as any,
    },
  };
  const mockGenerationBatch: GenerationBatch = {
    id: 'test-batch-id',
    provider: 'test-provider',
    model: 'test-model',
    prompt: 'test prompt',
    createdAt: new Date(),
    generations: [],
  };

  // Mock window.innerHeight for tests
  const originalWindow = global.window;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(global, 'window', {
      writable: true,
      value: {
        innerHeight: 800,
      },
    });
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  it.each([
    [1024, 1024, 320],
    [1536, 1024, 320],
    [1024, 1536, 213],
    [2160, 3840, 180],
    [3840, 2160, 320],
  ])('fits %i × %i within a 320px long edge', (width, height, expectedWidth) => {
    const generation: Generation = {
      ...mockGeneration,
      asset: { type: 'image', width, height },
    };
    const result = getThumbnailMaxWidth(generation);
    expect(result).toBe(expectedWidth);
    expect((result * height) / width).toBeLessThanOrEqual(320);
  });

  it('uses the same compact square for pending images with unknown dimensions', () => {
    expect(getThumbnailMaxWidth(mockGeneration, mockGenerationBatch)).toBe(320);
  });

  it('keeps a configured placeholder the same size as the completed image', () => {
    const batch = { ...mockGenerationBatch, config: { prompt: 'test', size: '1024x1536' } };
    const completed: Generation = {
      ...mockGeneration,
      asset: { type: 'image', width: 1024, height: 1536 },
    };
    expect(getThumbnailMaxWidth(mockGeneration, batch)).toBe(213);
    expect(getThumbnailMaxWidth(completed, batch)).toBe(213);
  });

  it('retains the half-screen height limit on a short viewport', () => {
    window.innerHeight = 400;
    const generation: Generation = {
      ...mockGeneration,
      asset: { type: 'image', width: 1024, height: 1536 },
    };
    expect(getThumbnailMaxWidth(generation)).toBe(133);
    expect(getThumbnailMaxWidth(mockGeneration)).toBe(200);
  });
});
