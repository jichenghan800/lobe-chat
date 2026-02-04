import { ActionIcon, Block, Text } from '@lobehub/ui';
import { GroupBotSquareIcon } from '@lobehub/ui/icons';
import { createStaticStyles, cssVar } from 'antd-style';
import { BotIcon, FilePenIcon, ImageIcon, PenLineIcon, VideoIcon, X } from 'lucide-react';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { isHomeStarterModeVisible } from '@/_custom/registry/homeStarter';
import { useHomeStore } from '@/store/home';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    padding-inline-start: 12px;
    border-radius: 16px;
  `,
  title: css`
    font-size: 13px;
    font-weight: 500;
    color: ${cssVar.colorTextSecondary};
  `,
}));

const modeConfig = {
  agent: { icon: BotIcon, titleKey: 'starter.createAgent' },
  group: { icon: GroupBotSquareIcon, titleKey: 'starter.createGroup' },
  image: { icon: ImageIcon, titleKey: 'starter.image' },
  research: { icon: FilePenIcon, titleKey: 'starter.deepResearch' },
  video: { icon: VideoIcon, titleKey: 'starter.seedance' },
  write: { icon: PenLineIcon, titleKey: 'starter.write' },
} as const;

const ModeHeader = memo(() => {
  const { t } = useTranslation('home');
  const { isAgentEditable, showAiImage } = useServerConfigStore(featureFlagsSelectors);

  const [inputActiveMode, clearInputMode] = useHomeStore((s) => [
    s.inputActiveMode,
    s.clearInputMode,
  ]);

  const activeMode = inputActiveMode as keyof typeof modeConfig | null;

  useEffect(() => {
    if (activeMode === 'image' && !showAiImage) {
      clearInputMode();
    }
  }, [activeMode, clearInputMode, showAiImage]);

  if (!isHomeStarterModeVisible(activeMode, { isAgentEditable, showAiImage })) return null;
  if (!activeMode) return null;

  const config = modeConfig[activeMode];
  const Icon = config.icon;

  return (
    <Block
      horizontal
      align="center"
      className={styles.container}
      gap={8}
      padding={4}
      variant={'filled'}
    >
      <Icon color={cssVar.colorTextDescription} size={16} />
      <Text fontSize={12} type={'secondary'}>
        {t(config.titleKey)}
      </Text>
      <ActionIcon
        icon={X}
        size="small"
        style={{
          borderRadius: 16,
        }}
        onClick={clearInputMode}
      />
    </Block>
  );
});

export default ModeHeader;
