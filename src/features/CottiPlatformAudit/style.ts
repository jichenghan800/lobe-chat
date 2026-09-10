import { createStaticStyles, cssVar, responsive } from 'antd-style';

export const styles = createStaticStyles(({ css }) => ({
  attachment: css`
    display: flex;
    flex-direction: column;
    gap: 6px;

    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};
  `,
  attachmentDetails: css`
    summary {
      cursor: pointer;

      display: flex;
      gap: 6px;
      align-items: center;

      color: ${cssVar.colorTextSecondary};
    }

    &[open] summary {
      margin-block-end: 8px;
    }
  `,
  content: css`
    overflow: auto;

    max-height: 44vh;
    padding: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    line-height: 1.65;
    overflow-wrap: anywhere;
    white-space: pre-wrap;

    background: ${cssVar.colorFillQuaternary};
  `,
  detailMeta: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    ${responsive.sm} {
      grid-template-columns: 1fr;
    }
  `,
  filterGrid: css`
    display: grid;
    grid-template-columns: minmax(250px, 1fr) repeat(2, minmax(150px, 190px));
    gap: 12px;
    align-items: center;

    ${responsive.md} {
      grid-template-columns: 1fr 1fr;
    }

    ${responsive.sm} {
      grid-template-columns: 1fr;
    }
  `,
  metricGrid: css`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;

    ${responsive.md} {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    ${responsive.sm} {
      grid-template-columns: 1fr;
    }
  `,
  notice: css`
    border-color: ${cssVar.colorBorderSecondary};
  `,
  table: css`
    :where(.ant-table-cell) {
      word-break: break-word;
      white-space: normal;
      vertical-align: top;
    }
  `,
  toolbar: css`
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
  `,
}));
