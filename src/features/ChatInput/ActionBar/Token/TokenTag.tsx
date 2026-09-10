import { Flexbox } from '@lobehub/ui';
import { Text } from '@lobehub/ui/base-ui';
import { TokenTag } from '@lobehub/ui/chat';
import { cssVar } from 'antd-style';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/selectors';

import ActionPopover from '../components/ActionPopover';
import { shouldWarnLongTopic } from './contextWarning';
import { NewTopicButton } from './NewTopicButton';
import TokenDetails from './TokenDetails';
import { useTokenBreakdown } from './useTokenBreakdown';

const Token = memo(() => {
  const { t } = useTranslation('chat');

  const { chatsToken, historySummaryToken, maxTokens, systemRoleToken, toolsToken, totalToken } =
    useTokenBreakdown();
  const isDevMode = useUserStore((s) => userGeneralSettingsSelectors.config(s).isDevMode);
  const longTopic = shouldWarnLongTopic(totalToken, maxTokens);
  const content = useMemo(
    () => (
      <Flexbox gap={12} style={{ maxWidth: 320 }}>
        {longTopic && <Text>{t('longTopic.description')}</Text>}
        <TokenDetails
          breakdown={{
            chatsToken,
            historySummaryToken,
            maxTokens,
            systemRoleToken,
            toolsToken,
            totalToken,
          }}
        />
      </Flexbox>
    ),
    [
      chatsToken,
      historySummaryToken,
      maxTokens,
      systemRoleToken,
      toolsToken,
      totalToken,
      longTopic,
      t,
    ],
  );

  // Keep the composer quiet for regular users until context pressure is real;
  // dev mode always shows the tag for inspection.
  if (!isDevMode && !longTopic) return <NewTopicButton />;

  return (
    <Flexbox horizontal align="center" gap={4} wrap="wrap">
      <ActionPopover content={content}>
        <Flexbox horizontal align="center" gap={4}>
          {longTopic && <Text style={{ color: cssVar.colorWarning }}>{t('longTopic.label')}</Text>}
          <TokenTag
            maxValue={maxTokens}
            mode={'used'}
            value={totalToken}
            size={{
              blockSize: 28,
              size: 18,
            }}
            text={{
              overload: t('tokenTag.overload'),
              remained: t('tokenTag.remained'),
              used: t('tokenTag.used'),
            }}
          />
        </Flexbox>
      </ActionPopover>
      {longTopic && <NewTopicButton />}
    </Flexbox>
  );
});

Token.displayName = 'ContextWindowToken';

export default Token;
