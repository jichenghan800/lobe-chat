import type { UIChatMessage } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { sanitizeCottiTopicOverviewMessage } from './index';

const message = {
  audioList: [{ alt: 'audio', id: 'audio-1', url: '/audio' }],
  chunksList: [{ fileId: 'file-1', filename: 'secret.pdf', id: 'chunk-1', text: 'secret' }],
  compressedMessages: [
    {
      content: 'nested',
      createdAt: 2,
      fileList: [{ fileType: 'text/plain', id: 'file-2', name: 'nested.txt', size: 1, url: '/n' }],
      id: 'nested-1',
      imageList: [{ alt: 'nested image', id: 'image-2', url: '/image-2' }],
      role: 'user',
      updatedAt: 2,
    },
  ],
  content: 'hello',
  createdAt: 1,
  fileList: [
    { fileType: 'application/pdf', id: 'file-1', name: 'secret.pdf', size: 10, url: '/f' },
  ],
  files: ['file-1'],
  id: 'message-1',
  imageList: [{ alt: 'image', id: 'image-1', url: '/image-1' }],
  role: 'user',
  updatedAt: 1,
  videoList: [{ alt: 'video', id: 'video-1', url: '/video' }],
  works: [{ id: 'work-1', type: 'file' }],
} as UIChatMessage;

describe('sanitizeCottiTopicOverviewMessage', () => {
  it('retains native read-only attachment and work surfaces recursively', () => {
    const result = sanitizeCottiTopicOverviewMessage(message);

    expect(result.content).toBe('hello');
    expect(result.imageList).toEqual([{ alt: 'image', id: 'image-1', url: '/image-1' }]);
    expect(result).toHaveProperty('audioList');
    expect(result).toHaveProperty('chunksList');
    expect(result).toHaveProperty('fileList');
    expect(result).toHaveProperty('files');
    expect(result).toHaveProperty('videoList');
    expect(result).toHaveProperty('works');
    expect(result.compressedMessages?.[0].imageList).toHaveLength(1);
    expect(result.compressedMessages?.[0]).toHaveProperty('fileList');
  });
});
