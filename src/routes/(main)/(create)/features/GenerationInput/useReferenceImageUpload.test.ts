import { toast } from '@lobehub/ui/base-ui';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useReferenceImageUpload } from './useReferenceImageUpload';

const upload = vi.hoisted(() => vi.fn());
vi.mock('@/store/file', () => ({
  useFileStore: (selector: (state: { uploadWithProgress: typeof upload }) => unknown) =>
    selector({ uploadWithProgress: upload }),
}));
vi.mock('@lobehub/ui/base-ui', () => ({ toast: { error: vi.fn() } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => JSON.stringify({ key, ...values }),
  }),
}));

const file = (name: string, size: number) =>
  new File([new Uint8Array(size)], name, { type: 'image/png' });

function setup(maxFileSize: number | undefined = 10, canCreate = true) {
  const landed: string[] = [];
  const addUploadingPreviews = vi.fn();
  const removeUploadingPreviews = vi.fn();
  const { result } = renderHook(() =>
    useReferenceImageUpload({
      addUploadingPreviews,
      canCreate,
      maxFileSize,
      removeUploadingPreviews,
      slots: [
        {
          capacity: 1,
          getCurrentValues: () => landed,
          set: (urls) => landed.splice(0, landed.length, ...urls),
          values: [],
        },
      ],
      uploadingPreviews: [],
    }),
  );
  return { addUploadingPreviews, landed, removeUploadingPreviews, result };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:synthetic'),
      revokeObjectURL: vi.fn(),
    }),
  );
  upload.mockImplementation(async ({ file }: { file: File }) => ({
    url: 'https://files.test/' + file.name,
  }));
});

describe('reference upload size feedback', () => {
  it('shows the rejected filename and sizes without uploading or consuming a slot', async () => {
    const { result, addUploadingPreviews, landed } = setup();
    await act(() => result.current.handleUploadFiles([file('too-large.png', 11)]));
    expect(toast.error).toHaveBeenCalledOnce();
    expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('too-large.png');
    expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('11 B');
    expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('10 B');
    expect(upload).not.toHaveBeenCalled();
    expect(addUploadingPreviews).not.toHaveBeenCalled();
    expect(landed).toEqual([]);
  });

  it('warns once for multiple oversized files while landing a valid file in the remaining slot', async () => {
    const { result, landed, removeUploadingPreviews } = setup();
    await act(() =>
      result.current.handleUploadFiles([
        file('large-a.png', 11),
        file('valid.png', 10),
        file('large-b.png', 12),
      ]),
    );
    expect(toast.error).toHaveBeenCalledOnce();
    expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('large-a.png');
    expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('large-b.png');
    expect(landed).toEqual(['https://files.test/valid.png']);
    expect(upload).toHaveBeenCalledOnce();
    expect(removeUploadingPreviews).toHaveBeenCalledOnce();
  });

  it('accepts a file exactly at the limit without warning', async () => {
    const { result, landed } = setup();
    await act(() => result.current.handleUploadFiles([file('boundary.png', 10)]));
    expect(toast.error).not.toHaveBeenCalled();
    expect(landed).toEqual(['https://files.test/boundary.png']);
  });

  it('does not warn or upload without permission', async () => {
    const { result } = setup(10, false);
    await act(() => result.current.handleUploadFiles([file('large.png', 11)]));
    expect(toast.error).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
});
