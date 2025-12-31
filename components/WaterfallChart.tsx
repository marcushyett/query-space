'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { formatNumber, truncateLabel } from '@/lib/chart-utils';

interface WaterfallDataItem {
  name: string;
  value: number;
  isTotal?: boolean;
  start: number;
  end: number;
  fill: string;
}

interface WaterfallChartProps {
  data: WaterfallDataItem[];
}

export function WaterfallChart({ data }: WaterfallChartProps) {
  // Transform data for stacked bar chart visualization
  // We'll use two bars: one invisible for positioning, one for the actual value
  const chartData = data.map((item) => {
    const isPositive = item.value >= 0;
    return {
      name: item.name,
      value: item.value,
      isTotal: item.isTotal,
      fill: item.fill,
      // The invisible spacer bar
      spacer: item.isTotal ? 0 : Math.min(item.start, item.end),
      // The visible bar
      bar: Math.abs(item.end - item.start),
      // For tooltip
      start: item.start,
      end: item.end,
      isPositive,
    };
  });

  // Calculate y-axis domain
  const allValues = data.flatMap((d) => [d.start, d.end]);
  const minValue = Math.min(0, ...allValues);
  const maxValue = Math.max(0, ...allValues);
  const padding = (maxValue - minValue) * 0.1;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        stackOffset="none"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
        <XAxis
          dataKey="name"
          stroke="#888"
          tick={{ fill: '#888', fontSize: 12 }}
          tickLine={{ stroke: '#888' }}
          angle={-45}
          textAnchor="end"
          height={60}
          tickFormatter={(value) => truncateLabel(value, 12)}
        />
        <YAxis
          stroke="#888"
          tick={{ fill: '#888', fontSize: 12 }}
          tickLine={{ stroke: '#888' }}
          tickFormatter={(value) => formatNumber(value)}
          domain={[minValue - padding, maxValue + padding]}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f1f1f',
            border: '1px solid #333',
            borderRadius: 4,
            maxWidth: 300,
          }}
          labelStyle={{ color: '#fff' }}
          itemStyle={{ color: '#fff' }}
          formatter={(value, name, props) => {
            const item = props?.payload;
            if (!item) return [value, name];

            if (item.isTotal) {
              return [`Total: ${formatNumber(item.end)}`, ''];
            }

            const change = item.value >= 0 ? '+' : '';
            return [
              `${change}${formatNumber(item.value)} (${formatNumber(item.start)} → ${formatNumber(item.end)})`,
              '',
            ];
          }}
          labelFormatter={(label) => truncateLabel(label, 30)}
        />
        <ReferenceLine y={0} stroke="#666" />
        {/* Invisible spacer bar */}
        <Bar dataKey="spacer" stackId="stack" fill="transparent" />
        {/* Visible value bar */}
        <Bar dataKey="bar" stackId="stack" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
