'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getChartColors, formatNumber } from '@/lib/chart-utils';

interface ColumnChartProps {
  data: Record<string, unknown>[];
  xAxisKey: string;
  yAxisKeys: string[];
  showLegend?: boolean;
}

export function ColumnChart({
  data,
  xAxisKey,
  yAxisKeys,
  showLegend = true,
}: ColumnChartProps) {
  const colors = getChartColors();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
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
          formatter={(value: number) => [value.toLocaleString(), '']}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            formatter={(value) => <span style={{ color: '#888' }}>{value}</span>}
          />
        )}
        {yAxisKeys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[index % colors.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
