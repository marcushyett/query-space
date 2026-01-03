'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Drawer,
  Tabs,
  Input,
  Button,
  Form,
  Select,
  message,
  Empty,
  Card,
  Typography,
} from 'antd';
import {
  BarChartOutlined,
  TableOutlined,
  NumberOutlined,
  FileTextOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useDashboardStore, DashboardWidget, WidgetType } from '@/stores/dashboardStore';
import { getColumnNames } from '@/lib/sql-column-parser';

const { Text } = Typography;
const { TextArea } = Input;

interface Chart {
  id: string;
  title: string | null;
  type: string;
  config: Record<string, unknown>;
  query: {
    id: string;
    name: string | null;
    sql: string;
  };
}

interface Query {
  id: string;
  name: string | null;
  sql: string;
}

export function AddWidgetDrawer() {
  const {
    isAddWidgetOpen,
    setAddWidgetOpen,
    dashboard,
    addWidget,
  } = useDashboardStore();

  const [activeTab, setActiveTab] = useState<WidgetType>('CHART');
  const [charts, setCharts] = useState<Chart[]>([]);
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [creating, setCreating] = useState(false);

  // Text widget form
  const [textForm] = Form.useForm();

  // KPI widget form
  const [kpiForm] = Form.useForm();
  // Track selected query for KPI widget and its available columns
  const [selectedKpiQuery, setSelectedKpiQuery] = useState<Query | null>(null);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);

  // Fetch charts and queries when drawer opens
  useEffect(() => {
    if (!isAddWidgetOpen || !dashboard) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch charts from projects linked to this dashboard
        const projectIds = dashboard.projects.map((p) => p.id);
        const chartsPromises = projectIds.map((projectId) =>
          fetch(`/api/projects/${projectId}/charts`).then((r) => r.json())
        );

        const queriesPromises = projectIds.map((projectId) =>
          fetch(`/api/projects/${projectId}/queries`).then((r) => r.json())
        );

        const chartsResults = await Promise.all(chartsPromises);
        const queriesResults = await Promise.all(queriesPromises);

        const allCharts: Chart[] = [];
        const allQueries: Query[] = [];

        chartsResults.forEach((result) => {
          if (result.charts) {
            allCharts.push(...result.charts);
          }
        });

        queriesResults.forEach((result) => {
          if (result.queries) {
            allQueries.push(...result.queries);
          }
        });

        setCharts(allCharts);
        setQueries(allQueries);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAddWidgetOpen, dashboard]);

  const filteredCharts = useMemo(() => {
    if (!searchTerm) return charts;
    const term = searchTerm.toLowerCase();
    return charts.filter(
      (chart) =>
        chart.title?.toLowerCase().includes(term) ||
        chart.query?.name?.toLowerCase().includes(term) ||
        chart.type.toLowerCase().includes(term)
    );
  }, [charts, searchTerm]);

  const filteredQueries = useMemo(() => {
    if (!searchTerm) return queries;
    const term = searchTerm.toLowerCase();
    return queries.filter(
      (query) =>
        query.name?.toLowerCase().includes(term) ||
        query.sql.toLowerCase().includes(term)
    );
  }, [queries, searchTerm]);

  const handleAddChartWidget = async (chart: Chart) => {
    if (!dashboard || creating) return;
    setCreating(true);

    try {
      // Calculate position for new widget
      const maxY = dashboard.widgets.reduce(
        (max, w) => Math.max(max, w.positionY + w.height),
        0
      );

      const response = await fetch(`/api/dashboards/${dashboard.id}/widgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CHART',
          chartId: chart.id,
          positionX: 0,
          positionY: maxY,
          width: 6,
          height: 4,
          title: chart.title,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add widget');
      }

      const { widget } = await response.json();

      // Add to local state with full chart data
      const newWidget: DashboardWidget = {
        id: widget.id,
        type: 'CHART',
        positionX: widget.positionX,
        positionY: widget.positionY,
        width: widget.width,
        height: widget.height,
        title: widget.title,
        config: null,
        chart: {
          id: chart.id,
          title: chart.title,
          type: chart.type,
          config: chart.config,
          query: {
            id: chart.query.id,
            name: chart.query.name,
            sql: chart.query.sql,
            sampleResults: null,
          },
        },
        query: null,
      };

      addWidget(newWidget);
      message.success('Chart widget added');
      setAddWidgetOpen(false);
    } catch (error) {
      console.error('Failed to add widget:', error);
      message.error('Failed to add widget');
    } finally {
      setCreating(false);
    }
  };

  const handleAddTableWidget = async (query: Query) => {
    if (!dashboard || creating) return;
    setCreating(true);

    try {
      const maxY = dashboard.widgets.reduce(
        (max, w) => Math.max(max, w.positionY + w.height),
        0
      );

      const response = await fetch(`/api/dashboards/${dashboard.id}/widgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'TABLE',
          queryId: query.id,
          positionX: 0,
          positionY: maxY,
          width: 12,
          height: 4,
          title: query.name,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add widget');
      }

      const { widget } = await response.json();

      const newWidget: DashboardWidget = {
        id: widget.id,
        type: 'TABLE',
        positionX: widget.positionX,
        positionY: widget.positionY,
        width: widget.width,
        height: widget.height,
        title: widget.title,
        config: null,
        chart: null,
        query: {
          id: query.id,
          name: query.name,
          sql: query.sql,
          sampleResults: null,
        },
      };

      addWidget(newWidget);
      message.success('Table widget added');
      setAddWidgetOpen(false);
    } catch (error) {
      console.error('Failed to add widget:', error);
      message.error('Failed to add widget');
    } finally {
      setCreating(false);
    }
  };

  const handleAddKpiWidget = async (values: { queryId: string; valueColumn: string; title: string }) => {
    if (!dashboard || creating) return;
    setCreating(true);

    try {
      const query = queries.find((q) => q.id === values.queryId);
      if (!query) throw new Error('Query not found');

      const maxY = dashboard.widgets.reduce(
        (max, w) => Math.max(max, w.positionY + w.height),
        0
      );

      const response = await fetch(`/api/dashboards/${dashboard.id}/widgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'KPI',
          queryId: query.id,
          positionX: 0,
          positionY: maxY,
          width: 3,
          height: 2,
          title: values.title,
          config: {
            valueColumn: values.valueColumn,
            format: 'number',
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add widget');
      }

      const { widget } = await response.json();

      const newWidget: DashboardWidget = {
        id: widget.id,
        type: 'KPI',
        positionX: widget.positionX,
        positionY: widget.positionY,
        width: widget.width,
        height: widget.height,
        title: widget.title,
        config: { valueColumn: values.valueColumn, format: 'number' },
        chart: null,
        query: {
          id: query.id,
          name: query.name,
          sql: query.sql,
          sampleResults: null,
        },
      };

      addWidget(newWidget);
      message.success('KPI widget added');
      setAddWidgetOpen(false);
      kpiForm.resetFields();
      setSelectedKpiQuery(null);
      setAvailableColumns([]);
    } catch (error) {
      console.error('Failed to add widget:', error);
      message.error('Failed to add widget');
    } finally {
      setCreating(false);
    }
  };

  const handleAddTextWidget = async (values: { content: string; title?: string }) => {
    if (!dashboard || creating) return;
    setCreating(true);

    try {
      const maxY = dashboard.widgets.reduce(
        (max, w) => Math.max(max, w.positionY + w.height),
        0
      );

      const response = await fetch(`/api/dashboards/${dashboard.id}/widgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'TEXT',
          positionX: 0,
          positionY: maxY,
          width: 4,
          height: 2,
          title: values.title || null,
          config: {
            content: values.content,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add widget');
      }

      const { widget } = await response.json();

      const newWidget: DashboardWidget = {
        id: widget.id,
        type: 'TEXT',
        positionX: widget.positionX,
        positionY: widget.positionY,
        width: widget.width,
        height: widget.height,
        title: widget.title,
        config: { content: values.content },
        chart: null,
        query: null,
      };

      addWidget(newWidget);
      message.success('Text widget added');
      setAddWidgetOpen(false);
      textForm.resetFields();
    } catch (error) {
      console.error('Failed to add widget:', error);
      message.error('Failed to add widget');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setAddWidgetOpen(false);
    setSearchTerm('');
    textForm.resetFields();
    kpiForm.resetFields();
    setSelectedKpiQuery(null);
    setAvailableColumns([]);
  };

  const tabItems = [
    {
      key: 'CHART',
      label: (
        <span>
          <BarChartOutlined />
          Chart
        </span>
      ),
      children: (
        <div>
          <Input
            placeholder="Search charts..."
            prefix={<SearchOutlined style={{ color: '#666' }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ marginBottom: 16 }}
            allowClear
          />
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32 }}>Loading...</div>
          ) : filteredCharts.length === 0 ? (
            <Empty description="No charts available" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredCharts.map((chart) => (
                <Card
                  key={chart.id}
                  size="small"
                  hoverable
                  onClick={() => handleAddChartWidget(chart)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <BarChartOutlined style={{ fontSize: 20, color: '#1668dc' }} />
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {chart.title || chart.query?.name || 'Untitled Chart'}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {chart.type.charAt(0).toUpperCase() + chart.type.slice(1)} Chart
                      </Text>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'TABLE',
      label: (
        <span>
          <TableOutlined />
          Table
        </span>
      ),
      children: (
        <div>
          <Input
            placeholder="Search queries..."
            prefix={<SearchOutlined style={{ color: '#666' }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ marginBottom: 16 }}
            allowClear
          />
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32 }}>Loading...</div>
          ) : filteredQueries.length === 0 ? (
            <Empty description="No queries available" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredQueries.map((query) => (
                <Card
                  key={query.id}
                  size="small"
                  hoverable
                  onClick={() => handleAddTableWidget(query)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <TableOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {query.name || 'Untitled Query'}
                      </div>
                      <Text
                        type="secondary"
                        style={{
                          fontSize: 12,
                          display: 'block',
                          maxWidth: 280,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {query.sql}
                      </Text>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'KPI',
      label: (
        <span>
          <NumberOutlined />
          KPI
        </span>
      ),
      children: (
        <Form form={kpiForm} layout="vertical" onFinish={handleAddKpiWidget}>
          <Form.Item
            name="queryId"
            label="Select Query"
            rules={[{ required: true, message: 'Please select a query' }]}
          >
            <Select
              placeholder="Choose a query"
              onChange={(value) => {
                const query = queries.find((q) => q.id === value);
                setSelectedKpiQuery(query || null);
                // Parse columns from the selected query's SQL
                if (query) {
                  const columns = getColumnNames(query.sql);
                  setAvailableColumns(columns);
                } else {
                  setAvailableColumns([]);
                }
                // Clear the valueColumn when query changes
                kpiForm.setFieldValue('valueColumn', undefined);
              }}
            >
              {queries.map((query) => (
                <Select.Option key={query.id} value={query.id}>
                  {query.name || 'Untitled Query'}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="valueColumn"
            label="Value Column"
            rules={[{ required: true, message: 'Please select a value column' }]}
            extra={selectedKpiQuery && availableColumns.length === 0 ?
              "No columns detected. You may type a column name manually." : undefined}
          >
            <Select
              placeholder="Select a column"
              showSearch
              allowClear
              disabled={!selectedKpiQuery}
              optionFilterProp="children"
              notFoundContent={selectedKpiQuery ? "No columns found" : "Select a query first"}
            >
              {availableColumns.map((column) => (
                <Select.Option key={column} value={column}>
                  {column}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="title"
            label="Widget Title"
            rules={[{ required: true, message: 'Please enter a title' }]}
          >
            <Input placeholder="e.g., Total Revenue" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={creating}>
              Add KPI Widget
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'TEXT',
      label: (
        <span>
          <FileTextOutlined />
          Text
        </span>
      ),
      children: (
        <Form form={textForm} layout="vertical" onFinish={handleAddTextWidget}>
          <Form.Item
            name="content"
            label="Content (Markdown supported)"
            rules={[{ required: true, message: 'Please enter content' }]}
          >
            <TextArea
              placeholder="# Dashboard Overview

Write your text here using **markdown** formatting."
              rows={8}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={creating}>
              Add Text Widget
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <Drawer
      title="Add Widget"
      open={isAddWidgetOpen}
      onClose={handleClose}
      width={400}
      styles={{
        body: { padding: '0 16px 16px' },
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key as WidgetType);
          setSearchTerm('');
        }}
        items={tabItems}
      />
    </Drawer>
  );
}
