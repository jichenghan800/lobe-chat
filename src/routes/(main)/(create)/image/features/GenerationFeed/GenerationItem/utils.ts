import type { Generation, GenerationBatch } from '@/types/generation';

// Default maximum width for image items
export const DEFAULT_MAX_ITEM_WIDTH = 320;

/**
 * Get image dimensions from various sources
 * Returns width, height and aspect ratio when available
 */
export const getImageDimensions = (
  generation: Generation,
  generationBatch?: GenerationBatch,
): { aspectRatio: string | null; height: number | null; width: number | null } => {
  // 1. Priority: actual dimensions from asset
  if (
    generation.asset?.width &&
    generation.asset?.height &&
    generation.asset.width > 0 &&
    generation.asset.height > 0
  ) {
    const { width, height } = generation.asset;
    return {
      aspectRatio: `${width} / ${height}`,
      height,
      width,
    };
  }

  // 2. Try to get dimensions from generationBatch config
  const config = generationBatch?.config;
  if (config?.width && config?.height && config.width > 0 && config.height > 0) {
    const { width, height } = config;
    return {
      aspectRatio: `${width} / ${height}`,
      height,
      width,
    };
  }

  // 3. Try to get dimensions from generationBatch top-level
  if (
    generationBatch?.width &&
    generationBatch?.height &&
    generationBatch.width > 0 &&
    generationBatch.height > 0
  ) {
    const { width, height } = generationBatch;
    return {
      aspectRatio: `${width} / ${height}`,
      height,
      width,
    };
  }

  // 4. Try to parse from size parameter (format: "1024x768")
  if (config?.size && config.size !== 'auto') {
    const sizeMatch = config.size.match(/^(\d+)x(\d+)$/);
    if (sizeMatch) {
      const [, widthStr, heightStr] = sizeMatch;
      const width = parseInt(widthStr, 10);
      const height = parseInt(heightStr, 10);
      if (width > 0 && height > 0) {
        return {
          aspectRatio: `${width} / ${height}`,
          height,
          width,
        };
      }
    }
  }

  // 5. Try to get aspect ratio only (format: "16:9")
  if (config?.aspectRatio) {
    const ratioMatch = config.aspectRatio.match(/^(\d+):(\d+)$/);
    if (ratioMatch) {
      const [, x, y] = ratioMatch;
      return {
        aspectRatio: `${x} / ${y}`,
        height: null,
        width: null,
      };
    }
  }

  // 6. No dimensions available
  return {
    aspectRatio: null,
    height: null,
    width: null,
  };
};

export const getAspectRatio = (
  generation: Generation,
  generationBatch?: GenerationBatch,
): string => {
  const dimensions = getImageDimensions(generation, generationBatch);
  return dimensions.aspectRatio || '1 / 1';
};

/**
 * Fit previews and placeholders within a 320px long edge, preserving aspect ratio
 * and the native half-screen height limit. The container handles narrower widths.
 * Client-side only, like the existing generation feed.
 */
export const getThumbnailMaxWidth = (
  generation: Generation,
  generationBatch?: GenerationBatch,
): number => {
  const [widthStr, heightStr] = getAspectRatio(generation, generationBatch).split(' / ');
  const aspectRatio = Number(widthStr) / Number(heightStr);
  const maxHeight = Math.min(DEFAULT_MAX_ITEM_WIDTH, window.innerHeight / 2);

  return Math.min(DEFAULT_MAX_ITEM_WIDTH, Math.floor(maxHeight * aspectRatio));
};
