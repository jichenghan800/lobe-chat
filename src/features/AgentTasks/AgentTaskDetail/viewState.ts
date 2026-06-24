interface TaskNotFoundErrorLike {
  data?: {
    code?: unknown;
    httpStatus?: unknown;
  };
  message?: unknown;
}

export const isTaskNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;

  const errorLike = error as TaskNotFoundErrorLike;

  return (
    errorLike.data?.code === 'NOT_FOUND' ||
    errorLike.data?.httpStatus === 404 ||
    (typeof errorLike.message === 'string' &&
      (errorLike.message === 'Task not found' || errorLike.message.startsWith('Task not found:')))
  );
};

export const resolveTaskDetailViewState = (params: {
  deferNotFound?: boolean;
  error?: unknown;
  hasTaskDetail: boolean;
}) => {
  const taskNotFound = isTaskNotFoundError(params.error);
  const shouldShowNotFound = taskNotFound && !params.deferNotFound;

  return {
    isInitialLoading: !params.hasTaskDetail && !shouldShowNotFound,
    isNotFound: !params.hasTaskDetail && shouldShowNotFound,
  };
};
