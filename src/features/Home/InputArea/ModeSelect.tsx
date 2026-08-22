import { Flexbox, Icon, Tooltip } from '@lobehub/ui';
import { Button, Popover } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import {
  ChevronDownIcon,
  InfinityIcon,
  ListTodoIcon,
  LockKeyholeIcon,
  MessageCircleIcon,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useBusinessAgentModeVisibility } from '@/business/client/hooks/useBusinessAgentMode';
import { usePermission } from '@/hooks/usePermission';

import type { HomeMode } from '../types';
import { isHomeModeDisabled, resolvePermittedHomeMode } from './modePermission';
import {
  HOME_AGENT_ACCESS_HINT_KEY,
  HOME_MODE_ORDER,
  homeModePresentation,
} from './modePresentation';

const styles = createStaticStyles(({ css, cssVar }) => ({
  activeOption: css`
    background: ${cssVar.colorFillSecondary};
  `,
  button: css`
    display: flex;
    gap: 6px;
    align-items: center;

    height: 32px;
    padding-inline: 8px;
    border: 0;
    border-radius: ${cssVar.borderRadius};

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};

    background: transparent;

    transition: all 0.2s;

    &:hover {
      color: ${cssVar.colorText};
      background: ${cssVar.colorFillSecondary};
    }
  `,
  option: css`
    overflow: hidden;
    justify-content: flex-start;

    width: 100%;
    height: auto;
    padding-block: 10px;
    padding-inline: 8px;
    border: 0;
    border-radius: ${cssVar.borderRadius};

    text-align: start;

    transition: background-color 0.2s;

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }
  `,
  optionDesc: css`
    overflow: hidden;

    font-size: 12px;
    line-height: 1.4;
    color: ${cssVar.colorTextDescription};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  optionIcon: css`
    flex-shrink: 0;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};
    background: ${cssVar.colorBgElevated};
  `,
  optionTitle: css`
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
    color: ${cssVar.colorText};
  `,
  optionContent: css`
    width: 100%;
    min-width: 0;
  `,
  optionText: css`
    overflow: hidden;
    min-width: 0;
  `,
  popoverPopup: css`
    /* The popup pads its option rows by 4px, so its corner must be one step larger
       than the rows' radius to wrap them concentrically. &&& outranks the base
       popup style's border-radius. */
    &&& {
      border-radius: ${cssVar.borderRadiusLG};
    }
  `,
}));

const MODE_ICONS = {
  agent: InfinityIcon,
  chat: MessageCircleIcon,
  task: ListTodoIcon,
} as const satisfies Record<HomeMode, typeof MessageCircleIcon>;

const MODES = HOME_MODE_ORDER.map((key) => ({ icon: MODE_ICONS[key], key }));

interface ModeSelectProps {
  onChange: (mode: HomeMode) => void;
  value: HomeMode;
}

const ModeSelect = memo<ModeSelectProps>(({ onChange, value }) => {
  const { t } = useTranslation('home');
  const { t: tChat } = useTranslation('chat');
  const { allowed: canCreateContent, reason: createContentReason } =
    usePermission('create_content');
  const {
    error: agentModeAccessError,
    isLoading: isAgentModeAccessLoading,
    isResolved: isAgentModeAccessResolved,
    visible: canEnableAgentMode,
  } = useBusinessAgentModeVisibility();
  const [open, setOpen] = useState(false);
  const permission = useMemo(
    () => ({ canCreateContent, canEnableAgentMode, isAgentModeAccessResolved }),
    [canCreateContent, canEnableAgentMode, isAgentModeAccessResolved],
  );

  useEffect(() => {
    const permittedMode = resolvePermittedHomeMode(value, permission);
    if (permittedMode !== value) onChange(permittedMode);
  }, [permission, onChange, value]);

  const handleSelect = useCallback(
    (mode: HomeMode) => {
      setOpen(false);
      onChange(mode);
    },
    [onChange],
  );

  const current = MODES.find((mode) => mode.key === value) ?? MODES[0];

  const content = (
    <Flexbox gap={4} role={'menu'} style={{ maxWidth: 320, minWidth: 280 }}>
      {MODES.map(({ icon, key }) => {
        const disabled = isHomeModeDisabled(key, permission);
        const presentation = homeModePresentation[key];
        const disabledReason = !canCreateContent
          ? createContentReason
          : key !== 'agent'
            ? undefined
            : isAgentModeAccessLoading
              ? tChat('chatMode.agentStatusLoading')
              : agentModeAccessError && !isAgentModeAccessResolved
                ? tChat('chatMode.agentStatusError')
                : !canEnableAgentMode
                  ? tChat(HOME_AGENT_ACCESS_HINT_KEY)
                  : undefined;

        const option = (
          <Button
            aria-checked={key === value}
            className={cx(styles.option, key === value && styles.activeOption)}
            disabled={disabled}
            key={key}
            role={'menuitemradio'}
            type={'text'}
            onClick={() => handleSelect(key)}
          >
            <Flexbox horizontal align={'center'} className={styles.optionContent} gap={12}>
              <Flexbox
                align={'center'}
                className={styles.optionIcon}
                height={32}
                justify={'center'}
                width={32}
              >
                <Icon icon={icon} size={16} />
              </Flexbox>
              <Flexbox className={styles.optionText} flex={1}>
                <div className={styles.optionTitle}>{t(presentation.labelKey)}</div>
                <div className={styles.optionDesc}>
                  {presentation.descriptionNamespace === 'chat'
                    ? tChat(presentation.descriptionKey)
                    : t(presentation.descriptionKey)}
                </div>
              </Flexbox>
              {key === 'agent' && isAgentModeAccessResolved && !canEnableAgentMode && (
                <Icon icon={LockKeyholeIcon} size={14} />
              )}
            </Flexbox>
          </Button>
        );

        return disabledReason ? (
          <Tooltip standalone key={key} placement={'right'} title={disabledReason}>
            {option}
          </Tooltip>
        ) : (
          option
        );
      })}
    </Flexbox>
  );

  return (
    <Popover
      className={styles.popoverPopup}
      content={content}
      open={open}
      placement={'bottomLeft'}
      trigger={'click'}
      styles={{
        content: {
          border: `1px solid ${cssVar.colorBorderSecondary}`,
          borderRadius: cssVar.borderRadiusLG,
          padding: 4,
        },
      }}
      onOpenChange={setOpen}
    >
      <Button aria-expanded={open} aria-haspopup={'menu'} className={styles.button} type={'text'}>
        <Icon icon={current.icon} size={14} />
        <span>{t(homeModePresentation[value].labelKey)}</span>
        <Icon icon={ChevronDownIcon} size={12} />
      </Button>
    </Popover>
  );
});

export default ModeSelect;
