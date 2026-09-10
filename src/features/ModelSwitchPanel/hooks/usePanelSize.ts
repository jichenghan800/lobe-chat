import { useCallback } from 'react';

import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors/systemStatus';

export const usePanelSize = () => {
  const panelWidth = useGlobalStore(systemStatusSelectors.modelSwitchPanelWidth);
  const updateSystemStatus = useGlobalStore((s) => s.updateSystemStatus);

  const handlePanelWidthChange = useCallback(
    (width: number) => {
      updateSystemStatus({ modelSwitchPanelWidth: width });
    },
    [updateSystemStatus],
  );

  return { handlePanelWidthChange, panelWidth };
};
