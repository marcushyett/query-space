'use client';

import React, { useState, useMemo } from 'react';
import { Button, Segmented, Typography, Space, Tooltip, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
  BarChartOutlined,
  LineChartOutlined,
  AreaChartOutlined,
  PieChartOutlined,
  DotChartOutlined,
  FunnelPlotOutlined,
  RadarChartOutlined,
  HeatMapOutlined,
  StockOutlined,
  ExpandOutlined,
  FullscreenExitOutlined,
  DownOutlined,
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
  ScatterChart as RechartsScatterChart,
  Scatter,
  ZAxis,
  FunnelChart as RechartsFunnelChart,
  Funnel,
  LabelList,
  RadarChart as RechartsRadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ReferenceLine,
} from 'recharts';
import {
  getChartColors,
  formatNumber,
  truncateLabel,
  formatDate,
  getHeatmapColorScale,
  type ChartType,
} from '@/lib/chart-utils';
import type { ChatChartData } from '@/stores/aiChatStore';

const { Text } = Typography;

interface InlineChatChartProps {
  chartData: ChatChartData;
  compact?: boolean;
}

// Basic chart options shown in segmented control
const basicChartOptions = [
  { value: 'column', icon: <BarChartOutlined />, label: 'Bar' },
  { value: 'line', icon: <LineChartOutlined />, label: 'Line' },
  { value: 'area', icon: <AreaChartOutlined />, label: 'Area' },
  { value: 'pie', icon: <PieChartOutlined />, label: 'Pie' },
];

// All chart types for dropdown
const allChartTypes: { key: ChartType; icon: React.ReactNode; label: string }[] = [
  { key: 'column', icon: <BarChartOutlined />, label: 'Column' },
  { key: 'line', icon: <LineChartOutlined />, label: 'Line' },
  { key: 'area', icon: <AreaChartOutlined />, label: 'Area' },
  { key: 'pie', icon: <PieChartOutlined />, label: 'Pie' },
  { key: 'donut', icon: <PieChartOutlined />, label: 'Donut' },
  { key: 'scatter', icon: <DotChartOutlined />, label: 'Scatter' },
  { key: 'funnel', icon: <FunnelPlotOutlined />, label: 'Funnel' },
  { key: 'waterfall', icon: <StockOutlined />, label: 'Waterfall' },
  { key: 'heatmap', icon: <HeatMapOutlined />, label: 'Heatmap' },
  { key: 'radar', icon: <RadarChartOutlined />, label: 'Radar' },
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
      case 'donut':
        const innerRadius = chartType === 'donut' ? chartHeight * 0.25 : chartHeight * 0.15;
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <RechartsPieChart>
              <Pie
                data={data}
                dataKey={yAxisKeys[0]}
                nameKey={xAxisKey}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
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

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <RechartsScatterChart margin={{ top: 10, right: 10, left: 0, bottom: compact ? 20 : 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                type="number"
                dataKey={xAxisKey}
                name={xAxisKey}
                {...commonAxisProps}
                tickFormatter={(v) => formatNumber(v)}
              />
              <YAxis
                type="number"
                dataKey={yAxisKeys[0]}
                name={yAxisKeys[0]}
                {...commonAxisProps}
                width={40}
                tickFormatter={(v) => formatNumber(v)}
              />
              <RechartsTooltip
                cursor={{ strokeDasharray: '3 3' }}
                {...tooltipStyle}
              />
              <Scatter name="Data" data={data} fill={colors[0]}>
                {data.map((_, index) => (
                  <Cell key={index} fill={colors[index % colors.length]} />
                ))}
              </Scatter>
            </RechartsScatterChart>
          </ResponsiveContainer>
        );

      case 'funnel':
        // Sort data by value descending for funnel
        const funnelData = [...data].sort((a, b) => {
          const aVal = Number(a[yAxisKeys[0]]) || 0;
          const bVal = Number(b[yAxisKeys[0]]) || 0;
          return bVal - aVal;
        });
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <RechartsFunnelChart margin={{ top: 10, right: 80, left: 10, bottom: 10 }}>
              <RechartsTooltip {...tooltipStyle} />
              <Funnel
                dataKey={yAxisKeys[0]}
                data={funnelData}
                isAnimationActive
              >
                <LabelList
                  position="right"
                  fill="#fff"
                  stroke="none"
                  dataKey={xAxisKey}
                  fontSize={10}
                />
                {funnelData.map((_, index) => (
                  <Cell key={index} fill={colors[index % colors.length]} />
                ))}
              </Funnel>
            </RechartsFunnelChart>
          </ResponsiveContainer>
        );

      case 'waterfall':
        // Prepare waterfall data with cumulative values
        let cumulative = 0;
        const waterfallData = data.map((item, index) => {
          const value = Number(item[yAxisKeys[0]]) || 0;
          const start = cumulative;
          cumulative += value;
          return {
            ...item,
            _start: start,
            _end: cumulative,
            _value: value,
            _fill: value >= 0 ? '#52c41a' : '#ff4d4f',
          };
        });
        // Add total bar
        waterfallData.push({
          [xAxisKey]: 'Total',
          [yAxisKeys[0]]: cumulative,
          _start: 0,
          _end: cumulative,
          _value: cumulative,
          _fill: '#1890ff',
        } as typeof waterfallData[0]);

        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={waterfallData}
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
                formatter={(value, name) => {
                  if (name === '_spacer') return [null, null];
                  return [typeof value === 'number' ? formatNumber(value) : String(value ?? ''), ''];
                }}
              />
              <ReferenceLine y={0} stroke="#666" />
              <Bar dataKey="_start" stackId="stack" fill="transparent" />
              <Bar dataKey="_value" stackId="stack" radius={[2, 2, 0, 0]}>
                {waterfallData.map((entry, index) => (
                  <Cell key={index} fill={entry._fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'heatmap':
        // Simple heatmap using scatter with colored cells
        // Extract unique x and y values
        const xValues = [...new Set(data.map(d => String(d[xAxisKey])))];
        const yValues = [...new Set(data.map(d => String(d[yAxisKeys[0]])))];
        const valueKey = yAxisKeys[1] || yAxisKeys[0];
        const allValues = data.map(d => Number(d[valueKey]) || 0);
        const minVal = Math.min(...allValues);
        const maxVal = Math.max(...allValues);

        return (
          <div style={{ width: '100%', height: chartHeight, position: 'relative' }}>
            <svg width="100%" height="100%" style={{ background: 'transparent' }}>
              {data.map((item, idx) => {
                const xIdx = xValues.indexOf(String(item[xAxisKey]));
                const yIdx = yValues.indexOf(String(item[yAxisKeys[0]]));
                const val = Number(item[valueKey]) || 0;
                const cellWidth = 100 / xValues.length;
                const cellHeight = 100 / yValues.length;
                return (
                  <rect
                    key={idx}
                    x={`${xIdx * cellWidth}%`}
                    y={`${yIdx * cellHeight}%`}
                    width={`${cellWidth}%`}
                    height={`${cellHeight}%`}
                    fill={getHeatmapColorScale(val, minVal, maxVal)}
                    stroke="#1a1a1a"
                    strokeWidth={1}
                  >
                    <title>{`${item[xAxisKey]} / ${item[yAxisKeys[0]]}: ${formatNumber(val)}`}</title>
                  </rect>
                );
              })}
            </svg>
          </div>
        );

      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
              <PolarGrid stroke="#333" />
              <PolarAngleAxis
                dataKey={xAxisKey}
                tick={{ fill: '#888', fontSize: 10 }}
                tickFormatter={(v) => truncateLabel(v, 8)}
              />
              <PolarRadiusAxis
                tick={{ fill: '#888', fontSize: 8 }}
                tickFormatter={(v) => formatNumber(v)}
                stroke="#444"
              />
              <RechartsTooltip {...tooltipStyle} />
              {yAxisKeys.map((key, index) => (
                <Radar
                  key={key}
                  name={key}
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              ))}
              {!compact && yAxisKeys.length > 1 && (
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(value) => <span style={{ color: '#888' }}>{truncateLabel(value, 12)}</span>}
                />
              )}
            </RechartsRadarChart>
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

  // Build dropdown menu for all chart types
  const chartTypeMenuItems: MenuProps['items'] = allChartTypes.map(ct => ({
    key: ct.key,
    icon: ct.icon,
    label: ct.label,
    onClick: () => setChartType(ct.key),
  }));

  // Check if current type is a basic type (shown in segmented control)
  const isBasicType = basicChartOptions.some(opt => opt.value === chartType);
  const currentTypeInfo = allChartTypes.find(ct => ct.key === chartType);

  return (
    <div className="inline-chat-chart">
      <div className="inline-chat-chart-header">
        <Space size={4}>
          {isBasicType ? (
            <Segmented
              size="small"
              value={chartType}
              onChange={(value) => setChartType(value as ChartType)}
              options={basicChartOptions.map(opt => ({
                value: opt.value,
                icon: opt.icon,
              }))}
            />
          ) : (
            <Button size="small" type="default" icon={currentTypeInfo?.icon}>
              {currentTypeInfo?.label}
            </Button>
          )}
          <Dropdown menu={{ items: chartTypeMenuItems }} trigger={['click']}>
            <Button size="small" type="text" icon={<DownOutlined />} />
          </Dropdown>
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
