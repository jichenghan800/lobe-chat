import { createStaticStyles, responsive } from 'antd-style';

export const styles = createStaticStyles(({ css }) => ({
  cottiAiFormGrid: css`
    display: grid;
    grid-template-columns: 220px repeat(3, minmax(150px, 1fr)) minmax(180px, 0.7fr) auto;
    gap: 12px;
    align-items: center;

    ${responsive.lg} {
      grid-template-columns: repeat(2, minmax(180px, 1fr));
    }

    ${responsive.md} {
      grid-template-columns: 1fr;
    }
  `,
  formGrid: css`
    display: grid;
    grid-template-columns: 220px 148px minmax(240px, 1fr) minmax(180px, 0.7fr) auto;
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
