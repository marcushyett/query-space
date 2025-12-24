'use client';

import { Table, Typography, Alert } from 'antd';
import { useQueryStore } from '@/stores/queryStore';

const { Text } = Typography;

export function QueryResults() {
  const { queryResults, isExecuting } = useQueryStore();

  if (isExecuting) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <Text>Executing query...</Text>
      </div>
    );
  }

  if (!queryResults) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#666' }}>
        <Text type="secondary">Execute a query to see results (Cmd+Enter)</Text>
      </div>
    );
  }

  if (queryResults.rows.length === 0) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          message="Query executed successfully"
          description={`No rows returned. Execution time: ${queryResults.executionTime}ms`}
          type="info"
          showIcon
        />
      </div>
    );
  }

  // Generate columns from fields
  const columns = queryResults.fields.map((field) => ({
    title: field.name,
    dataIndex: field.name,
    key: field.name,
    ellipsis: true,
    render: (text: any) => {
      if (text === null) return <Text type="secondary">NULL</Text>;
      if (typeof text === 'object') return JSON.stringify(text);
      return String(text);
    },
  }));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text>
          {queryResults.rowCount} {queryResults.rowCount === 1 ? 'row' : 'rows'}
        </Text>
        <Text type="secondary">{queryResults.executionTime}ms</Text>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Table
          columns={columns}
          dataSource={queryResults.rows.map((row, index) => ({
            ...row,
            key: index,
          }))}
          pagination={{
            pageSize: 100,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} rows`,
          }}
          scroll={{ x: 'max-content' }}
          size="small"
        />
      </div>
    </div>
  );
}
