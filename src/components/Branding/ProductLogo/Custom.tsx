import { BRANDING_LOGO_URL, BRANDING_NAME } from '@lobechat/business-const';
import { type IconType } from '@lobehub/icons';
import { type FlexboxProps } from '@lobehub/ui';
import { Flexbox } from '@lobehub/ui';
import { type LobeChatProps } from '@lobehub/ui/brand';
import { createStaticStyles, cssVar } from 'antd-style';
import { type ReactNode } from 'react';
import { memo } from 'react';

import { getBrandLogoUrl, getBrandName } from '@/_custom/registry/branding';
import { type ImageProps } from '@/libs/next/Image';
import Image from '@/libs/next/Image';

const CUSTOM_BRAND_NAME = getBrandName() || BRANDING_NAME;
const CUSTOM_BRAND_LOGO_URL = getBrandLogoUrl() || BRANDING_LOGO_URL;
const hasCustomLogo = !!CUSTOM_BRAND_LOGO_URL;

const getCustomBrandWordmark = () => {
  const compactName = CUSTOM_BRAND_NAME.replaceAll(/\s+/g, '');

  if (!hasCustomLogo) return CUSTOM_BRAND_NAME;

  return compactName.replace(/^灵/, '') || CUSTOM_BRAND_NAME;
};

const CUSTOM_BRAND_WORDMARK = getCustomBrandWordmark();

const styles = createStaticStyles(({ css }) => {
  return {
    extraTitle: css`
      font-weight: 300;
      white-space: nowrap;
    `,
  };
});

const CustomTextLogo = memo<FlexboxProps & { size: number }>(({ size, style, ...rest }) => {
  return (
    <Flexbox
      height={size}
      style={{
        fontSize: size / 1.5,
        fontWeight: 'bolder',
        lineHeight: 1,
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {CUSTOM_BRAND_NAME}
    </Flexbox>
  );
});

const CustomWordmarkLogo = memo<FlexboxProps & { size: number }>(({ size, style, ...rest }) => {
  const fontSize = Math.max(14, Math.round(size * 0.5));
  const aiMatch = /^(.*?)(AI)$/i.exec(CUSTOM_BRAND_WORDMARK);
  const namePart = aiMatch?.[1] || CUSTOM_BRAND_WORDMARK;
  const aiPart = aiMatch?.[2];

  return (
    <Flexbox
      horizontal
      align={'center'}
      flex={'none'}
      height={size}
      style={{
        fontSize,
        fontWeight: 750,
        lineHeight: 1,
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      <span style={{ color: cssVar.colorText }}>{namePart}</span>
      {aiPart && (
        <span
          style={{
            color: cssVar.colorTextSecondary,
            fontSize: Math.max(13, Math.round(size * 0.43)),
            fontWeight: 700,
            marginLeft: 2,
          }}
        >
          {aiPart}
        </span>
      )}
    </Flexbox>
  );
});

const CustomImageLogo = memo<Omit<ImageProps, 'alt' | 'src'> & { size: number }>(
  ({ size, style, ...rest }) => {
    if (!hasCustomLogo) return <CustomTextLogo size={size} style={style} />;

    return (
      <Image
        alt={CUSTOM_BRAND_NAME}
        height={size}
        src={CUSTOM_BRAND_LOGO_URL}
        style={style}
        unoptimized={true}
        width={size}
        {...rest}
      />
    );
  },
);

const Divider: IconType = (({ ref, size = '1em', style, ...rest }) => (
  <svg
    fill="none"
    height={size}
    ref={ref}
    shapeRendering="geometricPrecision"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flex: 'none', lineHeight: 1, ...style }}
    viewBox="0 0 24 24"
    width={size}
    {...rest}
  >
    <path d="M16.88 3.549L7.12 20.451" />
  </svg>
)) as IconType;

const CustomLogo = memo<LobeChatProps>(({ extra, size = 32, className, style, type, ...rest }) => {
  let logoComponent: ReactNode;

  switch (type) {
    case '3d':
    case 'flat': {
      logoComponent = <CustomImageLogo size={size} style={style} {...rest} />;
      break;
    }
    case 'mono': {
      logoComponent = (
        <CustomImageLogo size={size} style={{ filter: 'grayscale(100%)', ...style }} {...rest} />
      );
      break;
    }
    case 'text': {
      logoComponent = <CustomTextLogo size={size} style={style} {...rest} />;
      break;
    }
    case 'combine': {
      logoComponent = hasCustomLogo ? (
        <>
          <CustomImageLogo size={size} />
          <CustomWordmarkLogo size={size} style={{ marginLeft: Math.round(size / 5) }} />
        </>
      ) : (
        <CustomTextLogo size={size} />
      );

      if (!extra)
        logoComponent = (
          <Flexbox horizontal align={'center'} flex={'none'} {...rest}>
            {logoComponent}
          </Flexbox>
        );

      break;
    }
    default: {
      logoComponent = <CustomImageLogo size={size} style={style} {...rest} />;
      break;
    }
  }

  if (!extra) return logoComponent;

  const extraSize = Math.round((size / 3) * 1.9);

  return (
    <Flexbox horizontal align={'center'} className={className} flex={'none'} {...rest}>
      {logoComponent}
      <Divider size={extraSize} style={{ color: cssVar.colorFill }} />
      <div className={styles.extraTitle} style={{ fontSize: extraSize }}>
        {extra}
      </div>
    </Flexbox>
  );
});

export default CustomLogo;
