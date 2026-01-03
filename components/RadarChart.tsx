'use client';

import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getChartColors, truncateLabel, formatNumber } from '@/lib/chart-utils';

interface RadarChartProps {
  data: Record<string, unknown>[];
  subjectKey: string;
  series: string[];
  showLegend?: boolean;
  fillOpacity?: number;
}

export function RadarChart({
  data,
  subjectKey,
  series,
  showLegend = true,
  fillOpacity = 0.3,
}: RadarChartProps) {
  const colors = getChartColors();

  // Calculate the domain for the radius axis
  const allValues = data.flatMap((item) =>
    series.map((s) => {
      const val = item[s];
      return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
    })
  );
  const maxValue = Math.max(...allValues, 0);
  const domain = [0, Math.ceil(maxValue * 1.1)];

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
      <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke="#333" />
        <PolarAngleAxis
          dataKey={subjectKey}
          tick={{ fill: '#888', fontSize: 12 }}
          tickFormatter={(value) => truncateLabel(value, 12)}
        />
        <PolarRadiusAxis
          angle={30}
          domain={domain}
          tick={{ fill: '#888', fontSize: 10 }}
          tickFormatter={(value) => formatNumber(value)}
          stroke="#444"
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
          formatter={(value, name) => [
            typeof value === 'number' ? formatNumber(value) : String(value ?? ''),
            truncateLabel(name, 20),
          ]}
        />
        {showLegend && series.length > 1 && (
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            formatter={(value) => (
              <span style={{ color: '#888' }} title={value}>
                {truncateLabel(value, 20)}
              </span>
            )}
          />
        )}
        {series.map((seriesKey, index) => (
          <Radar
            key={seriesKey}
            name={seriesKey}
            dataKey={seriesKey}
            stroke={colors[index % colors.length]}
            fill={colors[index % colors.length]}
            fillOpacity={fillOpacity}
            strokeWidth={2}
          />
        ))}
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}
