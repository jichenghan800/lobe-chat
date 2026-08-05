import { createStaticStyles, cssVar, responsive } from 'antd-style';

export const sharedStyles = createStaticStyles(({ css }) => ({
  actionRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
  `,
  card: css`
    background: ${cssVar.colorBgContainer};
  `,
  copy: css`
    color: ${cssVar.colorTextSecondary};
  `,
  sectionHeader: css`
    padding-block-end: 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  sectionTitle: css`
    font-size: 18px;
    font-weight: 600;
  `,
  toolbar: css`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;

    ${responsive.sm} {
      align-items: stretch;
    }
  `,
}));
