import { createStaticStyles, responsive } from 'antd-style';

export const styles = createStaticStyles(({ css }) => ({
  formGrid: css`
    display: grid;
    grid-template-columns: 240px minmax(200px, 1fr) minmax(180px, 0.7fr) auto;
    gap: 12px;
    align-items: center;

    ${responsive.md} {
      grid-template-columns: 1fr;
    }
  `,
  table: css`
    :where(.ant-table-cell) {
      word-break: break-word;
      white-space: normal;
      vertical-align: middle;
    }
  `,
}));
