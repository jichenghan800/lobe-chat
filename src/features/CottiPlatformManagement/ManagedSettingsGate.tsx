import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import AsyncBoundary from '@/components/AsyncBoundary';

import { useManagedSettingsAccess } from './useManagedSettingsAccess';

export const ManagedSettingsGate = ({
  children,
  redirectPath = '/settings/appearance',
}: {
  children: ReactNode;
  redirectPath?: string;
}) => {
  const { canManage, data, error, isLoading, retry } = useManagedSettingsAccess();

  return (
    <AsyncBoundary data={data} error={error} isLoading={isLoading} onRetry={retry}>
      {canManage ? children : <Navigate replace to={redirectPath} />}
    </AsyncBoundary>
  );
};
