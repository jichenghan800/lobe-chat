import { createStaticStyles, cssVar } from 'antd-style';

export const styles = createStaticStyles(({ css }) => ({
  detail: css`
    overflow: hidden;
    min-width: 0;
    height: 100%;
    background: ${cssVar.colorBgContainer};
  `,
  detailHeader: css`
    z-index: 2;

    flex: none;

    padding-block: 16px 12px;
    padding-inline: 24px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorBgContainer};
  `,
  detailMeta: css`
    overflow: hidden;
    min-width: 0;
  `,
  detailTitle: css`
    overflow: hidden;
    flex: 1;

    min-width: 0;

    font-size: 18px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  layout: css`
    overflow: hidden;
    width: 100%;
    height: 100%;

    @media (width <= 767px) {
      &[data-has-detail='true'] .overview-list-panel {
        display: none;
      }

      &[data-has-detail='false'] .overview-detail-panel {
        display: none;
      }
    }
  `,
  list: css`
    display: flex;
    flex-direction: column;
    gap: 2px;

    padding-block: 6px 16px;
    padding-inline: 8px;
  `,
  listBody: css`
    overflow: hidden auto;
    min-height: 0;
  `,
  listHeader: css`
    flex: none;
    padding-block: 14px 8px;
    padding-inline: 12px;
  `,
  listPanel: css`
    flex: none;

    width: 340px;
    min-width: 280px;
    max-width: 380px;
    height: 100%;
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorBgLayout};

    @media (width <= 767px) {
      width: 100%;
      max-width: none;
      border-inline-end: none;
    }
  `,
  mobileBack: css`
    display: none;

    @media (width <= 767px) {
      display: inline-flex;
    }
  `,
  pagination: css`
    flex: none;
    padding-block: 8px 12px;
    padding-inline: 12px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
  transcript: css`
    min-height: 0;
  `,
  truncated: css`
    padding-block: 8px;
    padding-inline: 24px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    color: ${cssVar.colorWarningText};

    background: ${cssVar.colorWarningBg};
  `,
  turnTime: css`
    padding-block-start: 16px;

    font-size: ${cssVar.fontSizeSM};
    font-variant-numeric: tabular-nums;
    line-height: ${cssVar.lineHeightSM};
    color: ${cssVar.colorTextTertiary};
    white-space: nowrap;
  `,
  turnTimeLine: css`
    flex: 1;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
}));
