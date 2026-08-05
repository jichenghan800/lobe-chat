import { createStaticStyles, cssVar, responsive } from 'antd-style';

export const styles = createStaticStyles(({ css }) => ({
  content: css`
    overflow: hidden auto;
  `,
  header: css`
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
  `,
  headerCopy: css`
    min-width: 240px;
  `,
  nav: css`
    position: sticky;
    z-index: 2;
    inset-block-start: -24px;

    margin-block-start: -4px;
    padding-block: 12px 4px;

    background: ${cssVar.colorBgLayout};

    ${responsive.sm} {
      inset-block-start: -16px;
    }
  `,
  section: css`
    min-width: 0;
  `,
}));
