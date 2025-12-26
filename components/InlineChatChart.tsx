'use client';

import React, { useState, useMemo } from 'react';
import { Button, Segmented, Typography, Space, Tooltip } from 'antd';
import {
  BarChartOutlined,
  LineChartOutlined,
  AreaChartOutlined,
  PieChartOutlined,
  ExpandOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  AreaChart as RechartsAreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getChartColors, formatNumber, truncateLabel, formatDate, ChartType } from '@/lib/chart-utils';
import type { ChatChartData } from '@/stores/aiChatStore';

const { Text } = Typography;

interface InlineChatChartProps {
  chartData: ChatChartData;
  compact?: boolean;
}

const chartTypeOptions = [
  { value: 'column', icon: <BarChartOutlined />, label: 'Bar' },
  { value: 'line', icon: <LineChartOutlined />, label: 'Line' },
  { value: 'area', icon: <AreaChartOutlined />, label: 'Area' },
  { value: 'pie', icon: <PieChartOutlined />, label: 'Pie' },
];

export function InlineChatChart({ chartData, compact = false }: InlineChatChartProps) {
  const [chartType, setChartType] = useState<ChartType>(chartData.config.type || 'column');
  const [isExpanded, setIsExpanded] = useState(false);

  const colors = getChartColors();

  // Detect if x-axis is date
  const isDateXAxis = useMemo(() => {
    if (chartData.data.length === 0) return false;
    const firstValue = chartData.data[0][chartData.xAxisKey];
    if (!firstValue) return false;
    const date = new Date(String(firstValue));
    return !isNaN(date.getTime()) && String(firstValue).match(/^\d{4}-\d{2}-\d{2}/);
  }, [chartData]);

  const chartHeight = isExpanded ? 400 : compact ? 180 : 250;

  const renderChart = () => {
    const { data, xAxisKey, yAxisKeys } = chartData;

    if (data.length === 0) {
      return (
        <div style={{
          height: chartHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666'
        }}>
          <Text type="secondary">No data to visualize</Text>
        </div>
      );
    }

    const commonAxisProps = {
      stroke: '#555',
      tick: { fill: '#888', fontSize: 10 },
      tickLine: { stroke: '#555' },
    };

    const tooltipStyle = {
      contentStyle: {
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 4,
        fontSize: 11,
      },
      labelStyle: { color: '#fff' },
      itemStyle: { color: '#fff' },
    };

    switch (chartType) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <RechartsPieChart>
              <Pie
                data={data}
                dataKey={yAxisKeys[0]}
                nameKey={xAxisKey}
                cx="50%"
                cy="50%"
                innerRadius={chartHeight * 0.2}
                outerRadius={chartHeight * 0.35}
                paddingAngle={2}
                label={({ name, percent }) =>
                  `${truncateLabel(name, 10)} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={{ stroke: '#555' }}
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <RechartsTooltip
                {...tooltipStyle}
                formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : String(value ?? ''), '']}
              />
              {!compact && (
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(value) => <span style={{ color: '#888' }}>{truncateLabel(value, 12)}</span>}
                />
              )}
            </RechartsPieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <RechartsLineChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: compact ? 20 : 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey={xAxisKey}
                {...commonAxisProps}
                angle={-45}
                textAnchor="end"
                height={compact ? 30 : 50}
                tickFormatter={isDateXAxis ? (v) => formatDate(v) : (v) => truncateLabel(v, 8)}
              />
              <YAxis
                {...commonAxisProps}
                width={40}
                tickFormatter={(v) => formatNumber(v)}
              />
              <RechartsTooltip
                {...tooltipStyle}
                formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : String(value ?? ''), '']}
                labelFormatter={isDateXAxis ? (l) => formatDate(l) : undefined}
              />
              {!compact && yAxisKeys.length > 1 && (
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(value) => <span style={{ color: '#888' }}>{truncateLabel(value, 12)}</span>}
                />
              )}
              {yAxisKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 2, fill: colors[index % colors.length] }}
                  activeDot={{ r: 4 }}
                />
              ))}
            </RechartsLineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <RechartsAreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: compact ? 20 : 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey={xAxisKey}
                {...commonAxisProps}
                angle={-45}
                textAnchor="end"
                height={compact ? 30 : 50}
                tickFormatter={isDateXAxis ? (v) => formatDate(v) : (v) => truncateLabel(v, 8)}
              />
              <YAxis
                {...commonAxisProps}
                width={40}
                tickFormatter={(v) => formatNumber(v)}
              />
              <RechartsTooltip
                {...tooltipStyle}
                formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : String(value ?? ''), '']}
                labelFormatter={isDateXAxis ? (l) => formatDate(l) : undefined}
              />
              {!compact && yAxisKeys.length > 1 && (
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(value) => <span style={{ color: '#888' }}>{truncateLabel(value, 12)}</span>}
                />
              )}
              {yAxisKeys.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.3}
                  stackId={chartData.config.stacked ? 'stack' : undefined}
                />
              ))}
            </RechartsAreaChart>
          </ResponsiveContainer>
        );

      case 'column':
      default:
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: compact ? 20 : 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey={xAxisKey}
                {...commonAxisProps}
                angle={-45}
                textAnchor="end"
                height={compact ? 30 : 50}
                tickFormatter={(v) => truncateLabel(v, 8)}
              />
              <YAxis
                {...commonAxisProps}
                width={40}
                tickFormatter={(v) => formatNumber(v)}
              />
              <RechartsTooltip
                {...tooltipStyle}
                formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : String(value ?? ''), '']}
              />
              {!compact && yAxisKeys.length > 1 && (
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(value) => <span style={{ color: '#888' }}>{truncateLabel(value, 12)}</span>}
                />
              )}
              {yAxisKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={colors[index % colors.length]}
                  radius={[2, 2, 0, 0]}
                  stackId={chartData.config.stacked ? 'stack' : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="inline-chat-chart">
      <div className="inline-chat-chart-header">
        <Space size={4}>
          <Segmented
            size="small"
            value={chartType}
            onChange={(value) => setChartType(value as ChartType)}
            options={chartTypeOptions.map(opt => ({
              value: opt.value,
              icon: opt.icon,
            }))}
          />
        </Space>
        <Tooltip title={isExpanded ? 'Collapse' : 'Expand'}>
          <Button
            type="text"
            size="small"
            icon={isExpanded ? <FullscreenExitOutlined /> : <ExpandOutlined />}
            onClick={() => setIsExpanded(!isExpanded)}
          />
        </Tooltip>
      </div>
      <div className="inline-chat-chart-body">
        {renderChart()}
      </div>
      {chartData.data.length > 0 && (
        <div className="inline-chat-chart-footer">
          <Text type="secondary" style={{ fontSize: 10 }}>
            {chartData.data.length} data points
            {chartData.yAxisKeys.length > 1 && ` • ${chartData.yAxisKeys.length} series`}
          </Text>
        </div>
      )}
    </div>
  );
}
