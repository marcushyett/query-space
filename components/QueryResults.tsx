'use client';

import { useState, useMemo } from 'react';
import { Table, Typography, Alert, Tabs, Tooltip } from 'antd';
import { TableOutlined, BarChartOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useQueryStore } from '@/stores/queryStore';
import { VisualizationPanel } from './VisualizationPanel';
import { TechSpinner } from './TechSpinner';
import { isChartable, isNumericType } from '@/lib/chart-utils';

const { Text } = Typography;

export function QueryResults() {
  const { queryResults, isExecuting } = useQueryStore();
  const [activeTab, setActiveTab] = useState('table');

  // Determine why visualization might not be available - must be before early returns
  const visualizationStatus = useMemo(() => {
    if (!queryResults) {
      return { available: false, reason: 'Execute a query to visualize results' };
    }
    if (queryResults.rows.length === 0) {
      return { available: false, reason: 'No data to visualize' };
    }
    if (queryResults.fields.length < 2) {
      return { available: false, reason: 'Need at least 2 columns to create a chart' };
    }
    const hasNumeric = queryResults.fields.some(f => isNumericType(f.dataTypeID));
    if (!hasNumeric) {
      return {
        available: false,
        reason: 'Need at least one numeric column (e.g., COUNT, SUM, integer, decimal) for chart values'
      };
    }
    return { available: true, reason: '' };
  }, [queryResults]);

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
              key: `row-${index}`,
            }))}
            pagination={{
              defaultPageSize: 50,
              pageSizeOptions: ['25', '50', '100', '250', '500'],
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} rows`,
              showQuickJumper: queryResults.rows.length > 100,
              size: 'small',
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
        <Tooltip
          title={!canVisualize ? visualizationStatus.reason : 'Visualize query results as a chart'}
          placement="top"
        >
          <span>
            <BarChartOutlined />
            Chart
            {!canVisualize && (
              <span style={{ marginLeft: 4 }}>
                <InfoCircleOutlined style={{ fontSize: 12, color: '#666' }} />
              </span>
            )}
          </span>
        </Tooltip>
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
