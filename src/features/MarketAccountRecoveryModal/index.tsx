'use client';

import { Flexbox } from '@lobehub/ui';
import { Button, Text } from '@lobehub/ui/base-ui';
import { createModal, type ModalInstance, useModalContext } from '@lobehub/ui/base-ui';
import { t } from 'i18next';
import { ExternalLinkIcon } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface MarketAccountRecoveryContentProps {
  onRetry: () => void | Promise<void>;
}

const getMarketSite = () => {
  const configuredUrl = process.env.NEXT_PUBLIC_MARKET_BASE_URL || 'https://market.lobehub.com';
  const url = new URL(configuredUrl);

  return { host: url.host, url: url.origin };
};

const MarketAccountRecoveryContent = memo<MarketAccountRecoveryContentProps>(({ onRetry }) => {
  const { t } = useTranslation('discover');
  const { close } = useModalContext();
  const marketSite = getMarketSite();

  const handleOpenMarket = useCallback(() => {
    window.open(marketSite.url, '_blank', 'noopener,noreferrer');
  }, [marketSite.url]);

  const handleRetry = useCallback(() => {
    close();
    void onRetry();
  }, [close, onRetry]);

  return (
    <Flexbox gap={20}>
      <Flexbox gap={12}>
        <Text type={'secondary'}>{t('user.switchAccount.modal.description')}</Text>
        <ol style={{ marginBlock: 0, paddingInlineStart: 22 }}>
          <li>{t('user.switchAccount.modal.step1')}</li>
          <li>{t('user.switchAccount.modal.step2', { host: marketSite.host })}</li>
          <li>{t('user.switchAccount.modal.step3')}</li>
        </ol>
      </Flexbox>
      <Flexbox horizontal gap={8} justify={'flex-end'}>
        <Button icon={ExternalLinkIcon} onClick={handleOpenMarket}>
          {t('user.switchAccount.modal.openMarket')}
        </Button>
        <Button type={'primary'} onClick={handleRetry}>
          {t('user.switchAccount.modal.retry')}
        </Button>
      </Flexbox>
    </Flexbox>
  );
});

MarketAccountRecoveryContent.displayName = 'MarketAccountRecoveryContent';

export const openMarketAccountRecoveryModal = (
  onRetry: () => void | Promise<void>,
): ModalInstance =>
  createModal({
    content: <MarketAccountRecoveryContent onRetry={onRetry} />,
    footer: null,
    maskClosable: true,
    styles: { header: { borderBottom: 'none' } },
    title: t('user.switchAccount.modal.title', { ns: 'discover' }),
    width: 'min(90vw, 480px)',
  });
