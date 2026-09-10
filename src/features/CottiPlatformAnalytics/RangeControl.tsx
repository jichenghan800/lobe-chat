'use client';

import { DatePicker, Flexbox } from '@lobehub/ui';
import { Segmented, Text } from '@lobehub/ui/base-ui';
import dayjs from 'dayjs';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  CottiPlatformAnalyticsRangeMode,
  CottiPlatformAnalyticsRangeSelection,
} from './range';
import { styles } from './style';

interface RangeControlProps {
  mode: CottiPlatformAnalyticsRangeMode;
  range: CottiPlatformAnalyticsRangeSelection;
  setCustomDate: (field: 'endDate' | 'startDate', value: string) => void;
  setMode: (mode: CottiPlatformAnalyticsRangeMode) => void;
}

const RangeControl = memo<RangeControlProps>(({ mode, range, setCustomDate, setMode }) => {
  const { t } = useTranslation('setting');

  return (
    <Flexbox className={styles.rangeControls}>
      <Text fontSize={13} type={'secondary'}>
        {t('platformAnalytics.range.label')}
      </Text>
      <Segmented
        size={'small'}
        value={String(mode)}
        options={[
          { label: t('platformAnalytics.range.today'), value: '1' },
          { label: t('platformAnalytics.range.days', { count: 7 }), value: '7' },
          { label: t('platformAnalytics.range.days', { count: 30 }), value: '30' },
          { label: t('platformAnalytics.range.days', { count: 90 }), value: '90' },
          { label: t('platformAnalytics.range.custom'), value: 'custom' },
        ]}
        onChange={(value) =>
          setMode(
            value === 'custom'
              ? value
              : (Number(value) as Exclude<CottiPlatformAnalyticsRangeMode, 'custom'>),
          )
        }
      />
      {range.type === 'custom' && (
        <>
          <DatePicker
            allowClear={false}
            className={styles.rangeDate}
            maxDate={dayjs(range.endDate)}
            placeholder={t('platformAnalytics.range.start')}
            value={dayjs(range.startDate)}
            onChange={(date) =>
              date && !Array.isArray(date) && setCustomDate('startDate', date.format('YYYY-MM-DD'))
            }
          />
          <DatePicker
            allowClear={false}
            className={styles.rangeDate}
            maxDate={dayjs()}
            minDate={dayjs(range.startDate)}
            placeholder={t('platformAnalytics.range.end')}
            value={dayjs(range.endDate)}
            onChange={(date) =>
              date && !Array.isArray(date) && setCustomDate('endDate', date.format('YYYY-MM-DD'))
            }
          />
        </>
      )}
    </Flexbox>
  );
});

RangeControl.displayName = 'RangeControl';

export default RangeControl;
