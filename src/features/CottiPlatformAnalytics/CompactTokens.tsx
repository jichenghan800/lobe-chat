import { formatNumber, formatUsageValue } from '@lobechat/utils';
import { Tooltip } from '@lobehub/ui/base-ui';
import { useTranslation } from 'react-i18next';

export default function CompactTokens({
  totalTokens,
  totalInputTokens,
  totalOutputTokens,
}: {
  totalTokens: number;
  totalInputTokens?: number | null;
  totalOutputTokens?: number | null;
}) {
  const { t } = useTranslation('setting');
  return (
    <Tooltip
      title={`${formatNumber(totalTokens)} · ${t('platformAnalytics.metric.tokens.desc', {
        input: formatNumber(totalInputTokens ?? 0),
        output: formatNumber(totalOutputTokens ?? 0),
      })}`}
    >
      <span>{formatUsageValue(totalTokens)}</span>
    </Tooltip>
  );
}
