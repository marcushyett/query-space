'use client';

import { useState, useEffect, useMemo } from 'react';
import { Table, Spin, Empty, Typography } from 'antd';
import { useDashboardStore, DashboardWidget } from '@/stores/dashboardStore';

const { Text } = Typography;

interface TableWidgetProps {
  widget: DashboardWidget;
}

export function TableWidget({ widget }: TableWidgetProps) {
  const { refreshingWidgets, widgetData, setWidgetData, dashboard } = useDashboardStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRefreshing = refreshingWidgets.has(widget.id);
  const cachedData = widgetData.get(widget.id);

  // Fetch query data on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!widget.query?.sql) return;
      if (cachedData) return; // Already have data
      if (!dashboard?.organizationId) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: dashboard.organizationId,
            sql: widget.query.sql,
          }),
        });

        if (!response.ok) {
          throw new Error('Query execution failed');
        }

        const result = await response.json();
        setWidgetData(widget.id, {
          rows: result.rows || [],
          fields: result.fields || [],
        });
      } catch (err) {
        console.error('Failed to fetch table data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [widget.id, widget.query?.sql, cachedData, setWidgetData, dashboard?.organizationId]);

  // Re-fetch on refresh
  useEffect(() => {
    if (!isRefreshing) return;

    const fetchData = async () => {
      if (!widget.query?.sql) return;
      if (!dashboard?.organizationId) return;

      try {
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: dashboard.organizationId,
            sql: widget.query.sql,
          }),
        });

        if (!response.ok) {
          throw new Error('Query execution failed');
        }

        const result = await response.json();
        setWidgetData(widget.id, {
          rows: result.rows || [],
          fields: result.fields || [],
        });
      } catch (err) {
        console.error('Failed to refresh table data:', err);
      }
    };

    fetchData();
  }, [isRefreshing, widget.id, widget.query?.sql, setWidgetData, dashboard?.organizationId]);

  const columns = useMemo(() => {
    if (!cachedData?.fields) return [];
    return cachedData.fields.map((field) => ({
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
  }, [cachedData?.fields]);

  const dataSource = useMemo(() => {
    if (!cachedData?.rows) return [];
    return cachedData.rows.map((row, index) => ({
      ...row,
      key: `row-${index}`,
    }));
  }, [cachedData?.rows]);

  if (isLoading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="small" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Empty
          description={<span style={{ color: '#ff4d4f', fontSize: 12 }}>{error}</span>}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  if (!cachedData || cachedData.rows.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="No data" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', position: 'relative' }}>
      {isRefreshing && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
          }}
        >
          <Spin size="small" />
        </div>
      )}
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={{
          defaultPageSize: 10,
          pageSizeOptions: ['10', '25', '50'],
          showSizeChanger: true,
          size: 'small',
          showTotal: (total) => `${total} rows`,
        }}
        scroll={{ x: 'max-content' }}
        size="small"
        style={{ fontSize: 12 }}
      />
    </div>
  );
}
