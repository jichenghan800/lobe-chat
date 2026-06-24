import { describe, expect, it } from 'vitest';

import { resolveTaskDetailViewState } from './viewState';

describe('resolveTaskDetailViewState', () => {
  it('keeps the detail page in loading state before the first fetch settles', () => {
    expect(resolveTaskDetailViewState({ hasTaskDetail: false })).toEqual({
      isInitialLoading: true,
      isNotFound: false,
    });
  });

  it('shows not found only for an explicit task-not-found error', () => {
    expect(
      resolveTaskDetailViewState({
        error: new Error('Task not found: T-10'),
        hasTaskDetail: false,
      }),
    ).toEqual({
      isInitialLoading: false,
      isNotFound: true,
    });
  });

  it('shows not found for tRPC NOT_FOUND errors', () => {
    expect(
      resolveTaskDetailViewState({
        error: {
          data: { code: 'NOT_FOUND', httpStatus: 404 },
          message: 'Task not found',
        },
        hasTaskDetail: false,
      }),
    ).toEqual({
      isInitialLoading: false,
      isNotFound: true,
    });
  });

  it('keeps rendering cached detail even if revalidation reports an error', () => {
    expect(
      resolveTaskDetailViewState({
        error: new Error('Task not found: T-10'),
        hasTaskDetail: true,
      }),
    ).toEqual({
      isInitialLoading: false,
      isNotFound: false,
    });
  });
});
