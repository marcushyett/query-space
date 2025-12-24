'use client';

import { useState } from 'react';
import { Table, Typography, Alert, Tabs } from 'antd';
import { TableOutlined, BarChartOutlined } from '@ant-design/icons';
import { useQueryStore } from '@/stores/queryStore';
import { VisualizationPanel } from './VisualizationPanel';
import { TechSpinner } from './TechSpinner';
import { isChartable } from '@/lib/chart-utils';

const { Text } = Typography;

export function QueryResults() {
  const { queryResults, isExecuting } = useQueryStore();
  const [activeTab, setActiveTab] = useState('table');

  if (isExecuting) {
    return (
      <div className="loading-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <TechSpinner />
        <Text>Executing query...</Text>
      </div>
    );
  }

  if (!queryResults) {
    return (
      <div className="empty-state">
        <Text type="secondary">Execute a query to see results (Cmd+Enter)</Text>
      </div>
    );
  }

  if (queryResults.rows.length === 0) {
    return (
      <div className="p-4">
        <Alert
          title="Query executed successfully"
          description={`No rows returned. Execution time: ${queryResults.executionTime}ms`}
          type="info"
          showIcon
        />
      </div>
    );
  }

  const columns = queryResults.fields.map((field) => ({
    title: field.name,
    dataIndex: field.name,
    key: field.name,
    ellipsis: true,
    render: (text: unknown) => {
      if (text === null) return <Text type="secondary">NULL</Text>;
      if (typeof text === 'object') return JSON.stringify(text);
      return String(text);
    },
  }));

  const canVisualize = isChartable(queryResults);

  const tabItems = [
    {
      key: 'table',
      label: (
        <span>
          <TableOutlined />
          Table
        </span>
      ),
      children: (
        <div className="h-full overflow-auto">
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
      ),
    },
    {
      key: 'chart',
      label: (
        <span>
          <BarChartOutlined />
          Chart
          {!canVisualize && <Text type="secondary" className="chart-na-label">(N/A)</Text>}
        </span>
      ),
      disabled: !canVisualize,
      children: <VisualizationPanel queryResult={queryResults} />,
    },
  ];

  return (
    <div className="panel">
      <div className="results-header">
        <Text>
          {queryResults.rowCount} {queryResults.rowCount === 1 ? 'row' : 'rows'}
        </Text>
        <Text type="secondary">{queryResults.executionTime}ms</Text>
      </div>
      <div className="flex-1 overflow-hidden">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="results-tabs"
        />
      </div>
    </div>
  );
}
