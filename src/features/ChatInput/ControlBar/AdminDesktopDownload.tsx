'use client';

import { Icon } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { ExternalLinkIcon, MonitorDownIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DOWNLOAD_URL } from '@/const/url';
import { useClientDataSWR } from '@/libs/swr';
import { cottiPeopleManagementService } from '@/services/cottiPeopleManagement';
import { useUserStore } from '@/store/user';

const styles = createStaticStyles(({ css }) => ({
  link: css`
    display: flex;
    gap: 8px;
    align-items: center;

    padding: 10px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 6px;

    color: ${cssVar.colorText};

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
}));

/** Download entry only: this does not enable device routing or change sandbox selection. */
export const AdminDesktopDownload = () => {
  const { t } = useTranslation('chat');
  const userId = useUserStore((s) => (s.isSignedIn ? s.user?.id : undefined));
  const access = useClientDataSWR(
    userId ? ['cotti', 'admin-desktop-download', userId] : null,
    () => cottiPeopleManagementService.getAccess(),
    { revalidateOnFocus: true, shouldRetryOnError: false, suspense: false },
  );
  if (!userId || access.error || access.data?.allowed !== true) return null;

  return (
    <a
      className={styles.link}
      href={DOWNLOAD_URL.default}
      rel="noopener noreferrer"
      target="_blank"
    >
      <Icon icon={MonitorDownIcon} size={16} />
      <span style={{ flex: 1 }}>{t('heteroAgent.executionTarget.downloadDesktop')}</span>
      <Icon icon={ExternalLinkIcon} size={13} />
    </a>
  );
};
