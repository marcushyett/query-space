'use client';

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getChartColors, formatNumber, formatDate } from '@/lib/chart-utils';

interface AreaChartProps {
  data: Record<string, unknown>[];
  xAxisKey: string;
  yAxisKeys: string[];
  showLegend?: boolean;
  isDateXAxis?: boolean;
  stacked?: boolean;
}

export function AreaChart({
  data,
  xAxisKey,
  yAxisKeys,
  showLegend = true,
  isDateXAxis = false,
  stacked = false,
}: AreaChartProps) {
  const colors = getChartColors();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsAreaChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          dataKey={xAxisKey}
          stroke="#888"
          tick={{ fill: '#888', fontSize: 12 }}
          tickLine={{ stroke: '#888' }}
          angle={-45}
          textAnchor="end"
          height={60}
          tickFormatter={isDateXAxis ? (value) => formatDate(value) : undefined}
        />
        <YAxis
          stroke="#888"
          tick={{ fill: '#888', fontSize: 12 }}
          tickLine={{ stroke: '#888' }}
          tickFormatter={(value) => formatNumber(value)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f1f1f',
            border: '1px solid #333',
            borderRadius: 4,
          }}
          labelStyle={{ color: '#fff' }}
          itemStyle={{ color: '#fff' }}
          formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : String(value ?? ''), '']}
          labelFormatter={isDateXAxis ? (label) => formatDate(label) : undefined}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            formatter={(value) => <span style={{ color: '#888' }}>{value}</span>}
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
            strokeWidth={2}
            stackId={stacked ? 'stack' : undefined}
          />
        ))}
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
