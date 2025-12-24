'use client';

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getChartColors, formatNumber } from '@/lib/chart-utils';

interface PieChartProps {
  data: Record<string, unknown>[];
  nameKey: string;
  valueKey: string;
  showLegend?: boolean;
}

export function PieChart({
  data,
  nameKey,
  valueKey,
  showLegend = true,
}: PieChartProps) {
  const colors = getChartColors();

  // Transform data for pie chart
  const pieData = data.map((item) => ({
    name: String(item[nameKey] ?? ''),
    value: typeof item[valueKey] === 'number' ? item[valueKey] : parseFloat(String(item[valueKey])) || 0,
  }));

  // Calculate total for percentage
  const total = pieData.reduce((sum, item) => sum + (item.value as number), 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsPieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          labelLine={true}
          label={({ name, value, percent }) => `${name}: ${formatNumber(value as number)} (${((percent ?? 0) * 100).toFixed(1)}%)`}
          outerRadius="70%"
          innerRadius="30%"
          fill="#8884d8"
          dataKey="value"
          paddingAngle={2}
        >
          {pieData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f1f1f',
            border: '1px solid #333',
            borderRadius: 4,
          }}
          labelStyle={{ color: '#fff' }}
          itemStyle={{ color: '#fff' }}
          formatter={(value) => {
            const numValue = typeof value === 'number' ? value : 0;
            const percentage = total > 0 ? ((numValue / total) * 100).toFixed(1) : 0;
            return [`${numValue.toLocaleString()} (${percentage}%)`, ''];
          }}
        />
        {showLegend && (
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value) => <span style={{ color: '#888' }}>{value}</span>}
          />
        )}
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}
