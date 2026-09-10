import { useClientDataSWR } from '@/libs/swr';
import { cottiUsersService } from '@/services/cottiUsers';

export const useCottiUserPolicy = (enabled = true) =>
  useClientDataSWR(enabled ? ['cotti', 'my-policy'] : null, cottiUsersService.mine, {
    revalidateOnFocus: true,
    refreshInterval: 30_000,
  });
