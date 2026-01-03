'use client';

import {
  FunnelChart as RechartsFunnelChart,
  Funnel,
  LabelList,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getChartColors, formatNumber, truncateLabel } from '@/lib/chart-utils';

interface FunnelDataItem {
  name: string;
  value: number;
  percentage?: number;
}

interface FunnelChartProps {
  data: FunnelDataItem[];
  showPercentage?: boolean;
  showLegend?: boolean;
}

export function FunnelChart({
  data,
  showPercentage = true,
}: FunnelChartProps) {
  const colors = getChartColors();

  // Ensure data is sorted by value descending
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  // Calculate conversion rates between stages
  const dataWithConversion = sortedData.map((item, index) => {
    const previousValue = index > 0 ? sortedData[index - 1].value : item.value;
    const conversionRate =
      previousValue > 0 ? ((item.value / previousValue) * 100).toFixed(1) : '100';
    return {
      ...item,
      conversionRate: index === 0 ? '100' : conversionRate,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <RechartsFunnelChart margin={{ top: 20, right: 120, left: 20, bottom: 20 }}>
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
            const numValue = typeof value === 'number' ? value : 0;
            const item = props?.payload;
            const lines = [
              `Value: ${formatNumber(numValue)}`,
              showPercentage && item?.percentage
                ? `${item.percentage.toFixed(1)}% of total`
                : null,
              item?.conversionRate && item?.conversionRate !== '100'
                ? `${item.conversionRate}% conversion`
                : null,
            ].filter(Boolean);
            return [lines.join('\n'), name];
          }}
        />
        <Funnel
          dataKey="value"
          data={dataWithConversion}
          isAnimationActive
        >
          <LabelList
            position="right"
            fill="#fff"
            stroke="none"
            dataKey="name"
            content={({ x, y, index }) => {
              const item = dataWithConversion[index as number];
              if (!item) return null;
              const displayName = truncateLabel(item.name, 15);
              const displayValue = formatNumber(item.value);
              const text = showPercentage && item.percentage !== undefined
                ? `${displayName}: ${displayValue} (${item.percentage.toFixed(0)}%)`
                : `${displayName}: ${displayValue}`;
              return (
                <text
                  x={(x as number) + 10}
                  y={y as number}
                  fill="#fff"
                  fontSize={12}
                  dominantBaseline="middle"
                >
                  {text}
                </text>
              );
            }}
          />
          {dataWithConversion.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Funnel>
      </RechartsFunnelChart>
    </ResponsiveContainer>
  );
}
