import { ORG_NAME } from '@lobechat/business-const';
import { type LobeHubProps } from '@lobehub/ui/brand';
import { LobeHub } from '@lobehub/ui/brand';
import { memo } from 'react';

import { getBrandName } from '@/_custom/registry/branding';
import { isCustomORG } from '@/const/version';

const CUSTOM_BRAND_NAME = getBrandName();

export const OrgBrand = memo<LobeHubProps>((props) => {
  if (CUSTOM_BRAND_NAME) {
    return <span>{CUSTOM_BRAND_NAME}</span>;
  }

  if (isCustomORG) {
    return <span>{ORG_NAME}</span>;
  }

  return <LobeHub {...props} />;
});
