import type { TableProps } from 'antd';
import { ConfigProvider, Table } from 'antd';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import type { ReactElement } from 'react';
import { memo } from 'react';

const prefixCls = 'ant';

const styles = createStaticStyles(({ css }) => ({
  hoverToActive: css`
    opacity: 0.6;

    &:hover {
      opacity: 1;
    }
  `,
  table: css`
    .${prefixCls}-table {
      background: transparent;

      th,
      td {
        border: none !important;
        font-size: 13px;
      }

      .${prefixCls}-table-cell:before {
        display: none;
      }
    }

    tr {
      td:first-child,
      th:first-child {
        padding-inline-start: 24px !important;
      }

      td:last-child,
      th:last-child {
        padding-inline-end: 24px !important;
      }
    }
  `,
}));

interface InlineTableExtraProps {
  hoverToActive?: boolean;
}

interface InlineTableProps<RecordType> extends InlineTableExtraProps, TableProps<RecordType> {}

const InlineTable = <RecordType,>({
  hoverToActive,
  className,
  ...rest
}: InlineTableProps<RecordType>) => {
  return (
    <ConfigProvider
      theme={{
        components: {
          Table: {
            headerBg: cssVar.colorFillQuaternary,
            headerBorderRadius: 0,
          },
        },
      }}
    >
      <Table<RecordType>
        bordered={false}
        className={cx(styles.table, hoverToActive && styles.hoverToActive, className)}
        pagination={false}
        scroll={{ x: 'max-content' }}
        size={'small'}
        {...rest}
      />
    </ConfigProvider>
  );
};

interface InlineTableComponent {
  (props: InlineTableExtraProps & TableProps): ReactElement;
  <RecordType>(props: InlineTableProps<RecordType>): ReactElement;
}

export default memo(InlineTable) as InlineTableComponent;
