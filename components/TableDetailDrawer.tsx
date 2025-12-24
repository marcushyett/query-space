'use client';

import { useEffect } from 'react';
import { Drawer, Table, Typography, Tag, Tabs, Empty, Button, App, Grid } from 'antd';
import {
  KeyOutlined,
  LinkOutlined,
  CopyOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { useTableInfo } from '@/hooks/useTableInfo';
import { useUiStore } from '@/stores/uiStore';
import { useQueryStore } from '@/stores/queryStore';
import { TechSpinner } from './TechSpinner';
import type { ColumnInfo, IndexInfo } from '@/app/api/table-info/route';

const { Text } = Typography;
const { useBreakpoint } = Grid;

export function TableDetailDrawer() {
  const { message } = App.useApp();
  const {
    tableDetailDrawerOpen,
    selectedTable,
    setTableDetailDrawerOpen,
    setSelectedTable,
  } = useUiStore();
  const { tableInfo, isLoading, fetchTableInfo, clearTableInfo } = useTableInfo();
  const { setCurrentQuery, currentQuery } = useQueryStore();
  const screens = useBreakpoint();

  // Responsive drawer width: full width on mobile, 600px on larger screens
  const isMobile = !screens.md;
  const drawerWidth = isMobile ? '100%' : 600;

  // Fetch table info when selected table changes
  useEffect(() => {
    if (selectedTable && tableDetailDrawerOpen) {
      const [schema, table] = selectedTable.split('.');
      fetchTableInfo(schema, table);
    }
  }, [selectedTable, tableDetailDrawerOpen, fetchTableInfo]);

  const handleClose = () => {
    setTableDetailDrawerOpen(false);
    setSelectedTable(null);
    clearTableInfo();
  };

  const insertColumnName = (columnName: string) => {
    const newQuery = currentQuery
      ? `${currentQuery.trimEnd()} ${columnName}`
      : columnName;
    setCurrentQuery(newQuery);
    message.success(`Inserted: ${columnName}`);
    // Close drawer on mobile after inserting
    if (isMobile) {
      handleClose();
    }
  };

  const generateSelectQuery = () => {
    if (!tableInfo) return;
    const query = `SELECT *\nFROM "${tableInfo.schema}"."${tableInfo.name}"\nLIMIT 100;`;
    setCurrentQuery(query);
    message.success('Query generated');
    // Close drawer on mobile and take user to query
    if (isMobile) {
      handleClose();
    }
  };

  const copyTableName = () => {
    if (!tableInfo) return;
    const fullName = `"${tableInfo.schema}"."${tableInfo.name}"`;
    navigator.clipboard.writeText(fullName);
    message.success('Copied to clipboard');
  };

  // Column definitions for the columns table
  const columnColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ColumnInfo) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {record.isPrimaryKey && (
            <KeyOutlined style={{ color: '#888' }} aria-label="Primary Key" />
          )}
          {record.isForeignKey && (
            <LinkOutlined style={{ color: '#888' }} aria-label={`References: ${record.references}`} />
          )}
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => insertColumnName(name)}
          >
            {name}
          </Button>
        </span>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag style={{ fontFamily: 'JetBrains Mono' }}>
          {type}
        </Tag>
      ),
    },
    {
      title: 'Nullable',
      dataIndex: 'nullable',
      key: 'nullable',
      width: 80,
      render: (nullable: boolean) =>
        nullable ? (
          <Text type="secondary">Yes</Text>
        ) : (
          <Text strong>No</Text>
        ),
    },
    {
      title: 'Default',
      dataIndex: 'defaultValue',
      key: 'defaultValue',
      ellipsis: true,
      render: (value: string | null) =>
        value ? (
          <Text code style={{ fontSize: 12 }}>
            {value}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ];

  // Column definitions for indexes table
  const indexColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Columns',
      dataIndex: 'columns',
      key: 'columns',
      render: (columns: string[] | undefined) => columns?.join(', ') || '-',
    },
    {
      title: 'Type',
      key: 'type',
      render: (_: unknown, record: IndexInfo) => (
        <>
          {record?.isPrimary && <Tag>Primary</Tag>}
          {record?.isUnique && !record?.isPrimary && <Tag>Unique</Tag>}
          {!record?.isPrimary && !record?.isUnique && <Tag>Index</Tag>}
        </>
      ),
    },
  ];

  // Column definitions for sample data
  const sampleColumns =
    tableInfo?.columns.map((col) => ({
      title: col.name,
      dataIndex: col.name,
      key: col.name,
      ellipsis: true,
      render: (value: unknown) => {
        if (value === null) return <Text type="secondary">NULL</Text>;
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      },
    })) || [];

  // Safely get indexes length
  const indexesLength = tableInfo?.indexes?.length ?? 0;
  const sampleDataLength = tableInfo?.sampleData?.length ?? 0;

  const tabItems = [
    {
      key: 'columns',
      label: `Columns (${tableInfo?.columns?.length ?? 0})`,
      children: (
        <Table
          columns={columnColumns}
          dataSource={tableInfo?.columns?.map((col, i) => ({ ...col, key: i })) ?? []}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
        />
      ),
    },
    {
      key: 'indexes',
      label: `Indexes (${indexesLength})`,
      children:
        indexesLength === 0 ? (
          <Empty description="No indexes defined" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            columns={indexColumns}
            dataSource={tableInfo?.indexes?.map((idx, i) => ({ ...idx, key: i })) ?? []}
            pagination={false}
            size="small"
          />
        ),
    },
    {
      key: 'sample',
      label: `Sample Data`,
      children:
        sampleDataLength === 0 ? (
          <Empty description="No data in table" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            columns={sampleColumns}
            dataSource={tableInfo?.sampleData?.map((row, i) => ({ ...row, key: i })) ?? []}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
          />
        ),
    },
  ];

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{selectedTable}</span>
          {tableInfo?.rowCount !== null && (
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
              (~{tableInfo?.rowCount?.toLocaleString()} rows)
            </Text>
          )}
        </div>
      }
      placement="right"
      width={drawerWidth}
      open={tableDetailDrawerOpen}
      onClose={handleClose}
      extra={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            icon={<CopyOutlined />}
            size="small"
            onClick={copyTableName}
            aria-label="Copy table name"
          />
          <Button
            icon={<CodeOutlined />}
            size="small"
            type="primary"
            onClick={generateSelectQuery}
            aria-label="Generate SELECT query"
          >
            SELECT *
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <TechSpinner size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
            Loading table information...
          </Text>
        </div>
      ) : tableInfo ? (
        <Tabs items={tabItems} defaultActiveKey="columns" />
      ) : (
        <Empty description="Select a table to view details" />
      )}
    </Drawer>
  );
}
