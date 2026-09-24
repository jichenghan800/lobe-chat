import { createStaticStyles, cssVar, responsive } from 'antd-style';

export const styles = createStaticStyles(({ css }) => ({
  auxiliaryGrid: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;

    ${responsive.md} {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    ${responsive.sm} {
      grid-template-columns: 1fr;
    }
  `,
  auxiliaryItem: css`
    min-width: 0;
    padding-block: 4px;
    padding-inline: 8px;
  `,
  chart: css`
    width: 100%;
    min-height: 220px;
  `,
  disclosure: css`
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    background: ${cssVar.colorBgContainer};

    & > summary {
      cursor: pointer;
      padding-block: 14px;
      padding-inline: 20px;
      font-weight: 500;
    }
  `,
  content: css`
    overflow: hidden auto;
  `,
  detailEmpty: css`
    padding-block: 56px;
    padding-inline: 24px;
  `,
  detailHeader: css`
    padding-block: 20px 0;
    padding-inline: 20px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  detailIdentity: css`
    min-width: 0;
  `,
  detailIdentityCopy: css`
    min-width: 0;
    max-width: 196px;
  `,
  detailInlineError: css`
    padding-block: 12px 0;
    padding-inline: 20px;
  `,
  detailModelFallback: css`
    display: grid;
    flex: none;
    place-items: center;

    width: 28px;
    height: 28px;
    border-radius: ${cssVar.borderRadius};

    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillTertiary};
  `,
  detailSearch: css`
    flex: 1;
    min-width: 220px;
    max-width: 360px;

    ${responsive.sm} {
      width: 100%;
      max-width: none;
    }
  `,
  detailSection: css`
    overflow: hidden;
    background: ${cssVar.colorBgContainer};
  `,
  detailSort: css`
    min-width: 180px;
  `,
  detailToolbar: css`
    padding-block: 16px;
    padding-inline: 20px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    ${responsive.sm} {
      align-items: stretch;
    }
  `,
  errorCategory: css`
    overflow: hidden;

    max-width: 228px;
    margin: 0;

    font-family: ${cssVar.fontFamilyCode};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  featureCard: css`
    min-width: 0;
    min-height: 160px;
    background: ${cssVar.colorBgContainer};
  `,
  featureGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(240px, 1fr));
    gap: 12px;

    ${responsive.lg} {
      grid-template-columns: repeat(2, minmax(220px, 1fr));
    }

    ${responsive.sm} {
      grid-template-columns: 1fr;
    }
  `,
  featureMetricGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  `,
  featurePrimary: css`
    padding-block-end: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  generatedAt: css`
    color: ${cssVar.colorTextTertiary};
  `,
  headerCopy: css`
    min-width: 240px;
  `,
  metricCard: css`
    min-width: 0;
    min-height: 120px;
    background: ${cssVar.colorBgContainer};
  `,
  metricGrid: css`
    display: grid;
    grid-template-columns: repeat(4, minmax(180px, 1fr));
    gap: 12px;

    ${responsive.lg} {
      grid-template-columns: repeat(2, minmax(180px, 1fr));
    }

    ${responsive.md} {
      grid-template-columns: repeat(2, minmax(160px, 1fr));
    }

    ${responsive.sm} {
      grid-template-columns: 1fr;
    }
  `,
  metricIcon: css`
    display: grid;
    flex: none;
    place-items: center;

    width: 32px;
    height: 32px;
    border-radius: ${cssVar.borderRadius};

    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillTertiary};
  `,
  metricValue: css`
    font-family: ${cssVar.fontFamilyCode};
    font-variant-numeric: tabular-nums;
  `,
  pageHeader: css`
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
  `,
  rangeControls: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;

    ${responsive.sm} {
      align-items: stretch;
      justify-content: flex-start;
      width: 100%;
    }
  `,
  rangeDate: css`
    width: 148px;

    ${responsive.sm} {
      flex: 1;
      min-width: 132px;
    }
  `,
  section: css`
    background: ${cssVar.colorBgContainer};
  `,
}));
