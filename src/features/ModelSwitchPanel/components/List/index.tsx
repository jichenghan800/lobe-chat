import { Flexbox } from '@lobehub/ui';
import { type ComponentType, type FC } from 'react';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useBusinessModelListGuard } from '@/business/client/hooks/useBusinessModelListGuard';
import { useEnabledChatModels } from '@/hooks/useEnabledChatModels';
import { useSingleton } from '@/hooks/useSingleton';
import type { EnabledProviderWithModels } from '@/types/aiProvider';

import { useBuildListItems } from '../../hooks/useBuildListItems';
import { useModelAndProvider } from '../../hooks/useModelAndProvider';
import { usePanelHandlers } from '../../hooks/usePanelHandlers';
import { styles } from '../../styles';
import { type GroupMode } from '../../types';
import { menuKey } from '../../utils';
import type { PricingMode } from '../ModelDetailPanel';
import GenerationListItemRenderer from './GenerationListItemRenderer';
import { ListItemRenderer } from './ListItemRenderer';

interface ListProps {
  enabledList?: EnabledProviderWithModels[];
  groupMode: GroupMode;
  maxHeight?: string;
  model?: string;
  ModelItemComponent?: ComponentType<any>;
  onModelChange?: (params: { model: string; provider: string }) => Promise<void>;
  onOpenChange?: (open: boolean) => void;
  pricingMode?: PricingMode;
  provider?: string;
  searchKeyword?: string;
}

export const List: FC<ListProps> = ({
  ModelItemComponent,
  enabledList: enabledListProp,
  groupMode,
  maxHeight,
  model: modelProp,
  onModelChange: onModelChangeProp,
  onOpenChange,
  pricingMode,
  provider: providerProp,
  searchKeyword = '',
}) => {
  const { t: tCommon } = useTranslation('common');
  const newLabel = tCommon('new');
  const { isModelRestricted, onBeforeModelSelect, onRestrictedModelClick, sortModelLast } =
    useBusinessModelListGuard();
  const proLabel = isModelRestricted ? tCommon('pro') : undefined;

  const chatEnabledList = useEnabledChatModels();
  const enabledList = enabledListProp ?? chatEnabledList;
  const { model, provider } = useModelAndProvider(modelProp, providerProp);
  const { handleModelChange, handleClose } = usePanelHandlers({
    onModelChange: onModelChangeProp,
    onOpenChange,
  });
  const listItems = useBuildListItems(enabledList, groupMode, searchKeyword, sortModelLast);

  const activeKey = menuKey(provider, model);

  // Set initial scroll position to keep active model centered
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeNodeRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedPositionRef = useRef(false);

  const activeItemRef = useCallback((node: HTMLDivElement | null) => {
    activeNodeRef.current = node;
  }, []);

  const scrollListeners = useSingleton(() => new Set<() => void>());
  const subscribeScroll = useCallback(
    (cb: () => void) => {
      scrollListeners.add(cb);
      return () => {
        scrollListeners.delete(cb);
      };
    },
    [scrollListeners],
  );
  const handleListScroll = useCallback(() => {
    scrollListeners.forEach((cb) => cb());
  }, [scrollListeners]);

  useLayoutEffect(() => {
    if (hasInitializedPositionRef.current) return;

    const container = listRef.current;
    const activeNode = activeNodeRef.current;
    if (!container || !activeNode) return;

    const targetScrollTop =
      activeNode.offsetTop - (container.clientHeight - activeNode.offsetHeight) / 2;
    container.scrollTop = Math.max(0, targetScrollTop);
    hasInitializedPositionRef.current = true;
  }, [activeKey, listItems.length]);

  return (
    <Flexbox
      className={styles.list}
      flex={'none'}
      ref={listRef}
      style={{ maxHeight, minHeight: 0 }}
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
              onBeforeModelSelect={onBeforeModelSelect}
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
