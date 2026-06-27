import { useCallback, useMemo } from 'react';

import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors/systemStatus';

import { ITEM_HEIGHT, MAX_PANEL_HEIGHT, PANEL_VERTICAL_PADDING, TOOLBAR_HEIGHT } from '../const';
import { type ListItem } from '../types';

export const getListItemHeight = (item: ListItem) => {
  switch (item.type) {
    case 'group-header': {
      return ITEM_HEIGHT['group-header'];
    }

    case 'empty-model': {
      return ITEM_HEIGHT['empty-model'];
    }

    case 'no-provider': {
      return ITEM_HEIGHT['no-provider'];
    }

    default: {
      return ITEM_HEIGHT['model-item'];
    }
  }
};

export const resolvePanelHeight = (listItems: ListItem[]) => {
  const listHeight =
    listItems.reduce((height, item) => height + getListItemHeight(item), 0) +
    PANEL_VERTICAL_PADDING;

  return Math.min(MAX_PANEL_HEIGHT, TOOLBAR_HEIGHT + listHeight);
};

export const usePanelSize = (listItems: ListItem[]) => {
  const panelWidth = useGlobalStore(systemStatusSelectors.modelSwitchPanelWidth);
  const updateSystemStatus = useGlobalStore((s) => s.updateSystemStatus);

  const panelHeight = useMemo(() => resolvePanelHeight(listItems), [listItems]);

  const handlePanelWidthChange = useCallback(
    (width: number) => {
      updateSystemStatus({ modelSwitchPanelWidth: width });
    },
    [updateSystemStatus],
  );

  return { handlePanelWidthChange, panelHeight, panelWidth };
};
