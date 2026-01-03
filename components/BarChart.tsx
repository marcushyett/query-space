'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getChartColors, formatNumber, truncateLabel } from '@/lib/chart-utils';

interface BarChartProps {
  data: Record<string, unknown>[];
  xAxisKey: string;
  yAxisKeys: string[];
  showLegend?: boolean;
  stacked?: boolean;
}

export function BarChart({
  data,
  xAxisKey,
  yAxisKeys,
  showLegend = true,
  stacked = false,
}: BarChartProps) {
  const colors = getChartColors();

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <RechartsBarChart
        data={data}
        layout="vertical"
        margin={{ top: 20, right: 30, left: 80, bottom: 20 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          type="number"
          stroke="#888"
          tick={{ fill: '#888', fontSize: 12 }}
          tickLine={{ stroke: '#888' }}
          tickFormatter={(value) => formatNumber(value)}
        />
        <YAxis
          type="category"
          dataKey={xAxisKey}
          stroke="#888"
          tick={{ fill: '#888', fontSize: 12 }}
          tickLine={{ stroke: '#888' }}
          width={70}
          tickFormatter={(value) => truncateLabel(value, 12)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f1f1f',
            border: '1px solid #333',
            borderRadius: 4,
            maxWidth: 300,
            wordWrap: 'break-word',
          }}
          labelStyle={{ color: '#fff', wordWrap: 'break-word', whiteSpace: 'pre-wrap' }}
          itemStyle={{ color: '#fff' }}
          formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : String(value ?? ''), '']}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            formatter={(value) => <span style={{ color: '#888' }} title={value}>{truncateLabel(value, 20)}</span>}
          />
        )}
        {yAxisKeys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[index % colors.length]}
            radius={stacked && index < yAxisKeys.length - 1 ? [0, 0, 0, 0] : [0, 4, 4, 0]}
            stackId={stacked ? 'stack' : undefined}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
