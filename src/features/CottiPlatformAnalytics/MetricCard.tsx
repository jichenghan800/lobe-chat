'use client';

import { Block, Flexbox, Icon, Skeleton, Text, Tooltip } from '@lobehub/ui';
import type { LucideIcon } from 'lucide-react';
import { memo } from 'react';

import { styles } from './style';

interface MetricCardProps {
  description: string;
  fullValue: string;
  icon: LucideIcon;
  loading?: boolean;
  title: string;
  value: string;
}

const MetricCard = memo<MetricCardProps>(
  ({ description, fullValue, icon, loading, title, value }) => (
    <Block className={styles.metricCard} gap={16} padding={16} variant={'outlined'}>
      <Flexbox horizontal align={'center'} gap={12} justify={'space-between'}>
        <Text fontSize={13} type={'secondary'} weight={500}>
          {title}
        </Text>
        <span className={styles.metricIcon}>
          <Icon icon={icon} size={17} />
        </span>
      </Flexbox>
      {loading ? (
        <Flexbox gap={10}>
          <Skeleton.Button active style={{ height: 30, width: '62%' }} />
          <Skeleton.Button active size={'small'} style={{ height: 14, width: '84%' }} />
        </Flexbox>
      ) : (
        <Flexbox gap={8}>
          <Tooltip title={fullValue}>
            <Text className={styles.metricValue} fontSize={26} weight={600}>
              {value}
            </Text>
          </Tooltip>
          <Text fontSize={12} type={'secondary'}>
            {description}
          </Text>
        </Flexbox>
      )}
    </Block>
  ),
);

MetricCard.displayName = 'MetricCard';

export default MetricCard;
