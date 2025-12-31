'use client';

import {
  ScatterChart as RechartsScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
  Cell,
} from 'recharts';
import { getChartColors, formatNumber, truncateLabel } from '@/lib/chart-utils';

interface ScatterChartProps {
  data: Record<string, unknown>[];
  xAxisKey: string;
  yAxisKey: string;
  sizeKey?: string;
  colorKey?: string;
  showLegend?: boolean;
}

export function ScatterChart({
  data,
  xAxisKey,
  yAxisKey,
  sizeKey,
  colorKey,
  showLegend = true,
}: ScatterChartProps) {
  const colors = getChartColors();

  // Group data by color key if provided
  const groupedData: Record<string, Record<string, unknown>[]> = colorKey
    ? data.reduce<Record<string, Record<string, unknown>[]>>(
        (acc, item) => {
          const key = String(item[colorKey] ?? 'default');
          if (!acc[key]) acc[key] = [];
          acc[key].push(item);
          return acc;
        },
        {}
      )
    : { default: data };

  const seriesNames = Object.keys(groupedData);

  // Calculate size range if sizeKey is provided
  const _sizeRange: { min: number; max: number } = sizeKey
    ? data.reduce<{ min: number; max: number }>(
        (range, item) => {
          const size = Number(item[sizeKey]) || 0;
          return {
            min: Math.min(range.min, size),
            max: Math.max(range.max, size),
          };
        },
        { min: Infinity, max: -Infinity }
      )
    : { min: 60, max: 60 };
  void _sizeRange; // Used for potential future ZAxis range

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          type="number"
          dataKey={xAxisKey}
          name={xAxisKey}
          stroke="#888"
          tick={{ fill: '#888', fontSize: 12 }}
          tickLine={{ stroke: '#888' }}
          tickFormatter={(value) => formatNumber(value)}
          label={{
            value: xAxisKey,
            position: 'bottom',
            offset: 40,
            fill: '#888',
            fontSize: 12,
          }}
        />
        <YAxis
          type="number"
          dataKey={yAxisKey}
          name={yAxisKey}
          stroke="#888"
          tick={{ fill: '#888', fontSize: 12 }}
          tickLine={{ stroke: '#888' }}
          tickFormatter={(value) => formatNumber(value)}
          label={{
            value: yAxisKey,
            angle: -90,
            position: 'insideLeft',
            fill: '#888',
            fontSize: 12,
          }}
        />
        {sizeKey && (
          <ZAxis
            type="number"
            dataKey={sizeKey}
            range={[30, 400]}
            name={sizeKey}
          />
        )}
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{
            backgroundColor: '#1f1f1f',
            border: '1px solid #333',
            borderRadius: 4,
            maxWidth: 300,
          }}
          labelStyle={{ color: '#fff' }}
          itemStyle={{ color: '#fff' }}
          formatter={(value, name) => [
            typeof value === 'number' ? value.toLocaleString() : String(value ?? ''),
            truncateLabel(name, 20),
          ]}
        />
        {showLegend && colorKey && (
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            formatter={(value) => (
              <span style={{ color: '#888' }} title={value}>
                {truncateLabel(value, 20)}
              </span>
            )}
          />
        )}
        {seriesNames.map((seriesName, index) => (
          <Scatter
            key={seriesName}
            name={seriesName === 'default' ? yAxisKey : seriesName}
            data={groupedData[seriesName]}
            fill={colors[index % colors.length]}
          >
            {!sizeKey &&
              groupedData[seriesName].map((_: Record<string, unknown>, idx: number) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={colors[index % colors.length]}
                />
              ))}
          </Scatter>
        ))}
      </RechartsScatterChart>
    </ResponsiveContainer>
  );
}
