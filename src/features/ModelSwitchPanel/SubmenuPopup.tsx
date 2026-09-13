import {
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  stopPropagation,
} from '@lobehub/ui';
import { memo } from 'react';

import type { ModelDisplayScope } from '@/types/modelDisplay';

import { PanelContent } from './components/PanelContent';
import { styles } from './styles';

interface ModelSwitchSubmenuPopupProps {
  model?: string;
  modelDisplayScope?: ModelDisplayScope;
  onModelChange?: (params: { model: string; provider: string }) => Promise<void>;
  /** Called with `false` once a row is picked, so the host can close its whole menu. */
  onOpenChange?: (open: boolean) => void;
  provider?: string;
}

/**
 * The model panel mounted as a nested submenu instead of its own dropdown, for
 * hosts that fold model selection into a larger menu (chat input model + effort).
 * The caller supplies the `DropdownMenuSubmenuRoot` and its trigger row.
 */
export const ModelSwitchSubmenuPopup = memo<ModelSwitchSubmenuPopupProps>(
  ({ modelDisplayScope, model, onModelChange, onOpenChange, provider }) => (
    <DropdownMenuPortal>
      <DropdownMenuPositioner alignOffset={-4} anchor={null} placement="right" sideOffset={8}>
        <DropdownMenuPopup className={styles.container} onKeyDown={stopPropagation}>
          <PanelContent
            model={model}
            modelDisplayScope={modelDisplayScope}
            provider={provider}
            onModelChange={onModelChange}
            onOpenChange={onOpenChange}
          />
        </DropdownMenuPopup>
      </DropdownMenuPositioner>
    </DropdownMenuPortal>
  ),
);

ModelSwitchSubmenuPopup.displayName = 'ModelSwitchSubmenuPopup';
