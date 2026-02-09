import { BRANDING_NAME } from '@lobechat/business-const';
import { memo, useEffect } from 'react';

import { getBrandName } from '@/_custom/registry/branding';
import { isDesktop } from '@/const/version';
import { useElectronStore } from '@/store/electron';

const PAGE_TITLE_BRAND_NAME = getBrandName() || BRANDING_NAME;

const PageTitle = memo<{ title: string }>(({ title }) => {
  const setCurrentPageTitle = useElectronStore((s) => s.setCurrentPageTitle);

  useEffect(() => {
    document.title = title ? `${title} · ${PAGE_TITLE_BRAND_NAME}` : PAGE_TITLE_BRAND_NAME;

    // Sync title to electron store for navigation history
    if (isDesktop) {
      setCurrentPageTitle(title);
    }
  }, [title, setCurrentPageTitle]);

  return null;
});

export default PageTitle;
