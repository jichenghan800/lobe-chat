'use client';

import { Flexbox } from '@lobehub/ui';
import { Tag } from '@lobehub/ui/base-ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  CottiPlatformAuditRiskFlag,
  CottiPlatformAuditRiskLevel,
} from '@/types/cotti/platformAudit';

interface RiskTagsProps {
  flags: CottiPlatformAuditRiskFlag[];
  level: CottiPlatformAuditRiskLevel;
}

const riskColors: Record<CottiPlatformAuditRiskLevel, string> = {
  high: 'red',
  low: 'default',
  medium: 'orange',
  none: 'green',
};

export const RiskTags = memo<RiskTagsProps>(({ flags, level }) => {
  const { t } = useTranslation('setting');

  return (
    <Flexbox horizontal gap={4} wrap={'wrap'}>
      <Tag color={riskColors[level]}>{t(`platformManagement.audit.risk.${level}`)}</Tag>
      {flags.map((flag) => (
        <Tag key={flag.key}>
          {t(`platformManagement.audit.flag.${flag.key}`, { defaultValue: flag.label })}
        </Tag>
      ))}
    </Flexbox>
  );
});

RiskTags.displayName = 'RiskTags';
