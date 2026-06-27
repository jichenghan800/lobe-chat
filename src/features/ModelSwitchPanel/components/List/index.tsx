import { Flexbox } from '@lobehub/ui';
import { type ComponentType, type FC } from 'react';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useBusinessModelListGuard } from '@/business/client/hooks/useBusinessModelListGuard';
import { useEnabledChatModels } from '@/hooks/useEnabledChatModels';
import type { EnabledProviderWithModels } from '@/types/aiProvider';

import { TOOLBAR_HEIGHT } from '../../const';
import { useModelAndProvider } from '../../hooks/useModelAndProvider';
import { usePanelHandlers } from '../../hooks/usePanelHandlers';
import { styles } from '../../styles';
import { type ListItem } from '../../types';
import { menuKey } from '../../utils';
import type { PricingMode } from '../ModelDetailPanel';
import GenerationListItemRenderer from './GenerationListItemRenderer';
import { ListItemRenderer } from './ListItemRenderer';

interface ListProps {
  enabledList?: EnabledProviderWithModels[];
  includeAgentOnlyModels?: boolean;
  listItems: ListItem[];
  model?: string;
  ModelItemComponent?: ComponentType<any>;
  onModelChange?: (params: { model: string; provider: string }) => Promise<void>;
  onOpenChange?: (open: boolean) => void;
  panelHeight: number;
  pricingMode?: PricingMode;
  provider?: string;
}

export const List: FC<ListProps> = ({
  ModelItemComponent,
  enabledList: enabledListProp,
  includeAgentOnlyModels,
  listItems,
  model: modelProp,
  onModelChange: onModelChangeProp,
  onOpenChange,
  panelHeight,
  pricingMode,
  provider: providerProp,
}) => {
  const { t: tCommon } = useTranslation('common');
  const newLabel = tCommon('new');
  const { isModelRestricted, onRestrictedModelClick } = useBusinessModelListGuard();
  const proLabel = isModelRestricted ? tCommon('pro') : undefined;

  const chatEnabledList = useEnabledChatModels({ includeAgentOnlyModels });
  const enabledList = enabledListProp ?? chatEnabledList;
  const { model, provider } = useModelAndProvider(modelProp, providerProp);
  const { handleModelChange, handleClose } = usePanelHandlers({
    onModelChange: onModelChangeProp,
    onOpenChange,
  });

  const activeKey = menuKey(provider, model);

  // Set initial scroll position to keep active model centered
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeNodeRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedPositionRef = useRef(false);

  const activeItemRef = useCallback((node: HTMLDivElement | null) => {
    activeNodeRef.current = node;
  }, []);

  const listHeight = panelHeight - TOOLBAR_HEIGHT;

  const scrollListenersRef = useRef(new Set<() => void>());
  const subscribeScroll = useCallback((cb: () => void) => {
    scrollListenersRef.current.add(cb);
    return () => {
      scrollListenersRef.current.delete(cb);
    };
  }, []);
  const handleListScroll = useCallback(() => {
    scrollListenersRef.current.forEach((cb) => cb());
  }, []);

  useLayoutEffect(() => {
    if (hasInitializedPositionRef.current) return;

    const container = listRef.current;
    const activeNode = activeNodeRef.current;
    if (!container || !activeNode) return;

    const targetScrollTop =
      activeNode.offsetTop - (container.clientHeight - activeNode.offsetHeight) / 2;
    container.scrollTop = Math.max(0, targetScrollTop);
    hasInitializedPositionRef.current = true;
  }, [listHeight, activeKey]);

  return (
    <Flexbox
      className={styles.list}
      flex={1}
      ref={listRef}
      style={{ height: listHeight }}
      onScroll={handleListScroll}
    >
      {listItems.map((item, index) => {
        const itemKey = menuKey(
          'provider' in item && item.provider ? item.provider.id : '',
          'model' in item && item.model
            ? item.model.id
            : 'data' in item && item.data
              ? item.data.displayName
              : `${item.type}-${index}`,
        );
        const isActive =
          (item.type === 'provider-model-item' &&
            menuKey(item.provider.id, item.model.id) === activeKey) ||
          (item.type === 'model-item-single' &&
            menuKey(item.data.providers[0].id, item.data.model.id) === activeKey) ||
          (item.type === 'model-item-multiple' &&
            item.data.providers.some((p) => menuKey(p.id, item.data.model.id) === activeKey));

        const renderItem = (key?: string) =>
          ModelItemComponent ? (
            <GenerationListItemRenderer
              ModelItemComponent={ModelItemComponent}
              activeKey={activeKey}
              enabledList={enabledList}
              item={item}
              key={key}
              pricingMode={pricingMode}
              onClose={handleClose}
              onModelChange={handleModelChange}
            />
          ) : (
            <ListItemRenderer
              activeKey={activeKey}
              isModelRestricted={isModelRestricted}
              item={item}
              key={key}
              newLabel={newLabel}
              proLabel={proLabel}
              subscribeScroll={subscribeScroll}
              onClose={handleClose}
              onModelChange={handleModelChange}
              onRestrictedModelClick={onRestrictedModelClick}
            />
          );

        return isActive ? (
          <div key={itemKey} ref={activeItemRef}>
            {renderItem()}
          </div>
        ) : (
          renderItem(itemKey)
        );
      })}
    </Flexbox>
  );
};
