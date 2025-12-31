'use client';

import { useMemo } from 'react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';
import { getChartColors, formatNumber } from '@/lib/chart-utils';

interface HistogramChartProps {
  data: Record<string, unknown>[];
  valueColumn: string;
  binCount?: number;
  showNormal?: boolean;
  cumulative?: boolean;
  showDensity?: boolean;
}

/**
 * Histogram Chart Component
 *
 * Displays frequency distribution of continuous data in bins.
 * Best for: Distribution analysis, understanding data spread
 */
export function HistogramChart({
  data,
  valueColumn,
  binCount = 10,
  showNormal = false,
  cumulative = false,
  showDensity = false,
}: HistogramChartProps) {
  const colors = getChartColors();

  // Calculate histogram data
  const histogramData = useMemo(() => {
    // Extract numeric values
    const values = data
      .map((row) => {
        const val = row[valueColumn];
        return typeof val === 'number' ? val : parseFloat(String(val));
      })
      .filter((v) => !isNaN(v))
      .sort((a, b) => a - b);

    if (values.length === 0) return [];

    const min = values[0];
    const max = values[values.length - 1];
    const range = max - min || 1;
    const binWidth = range / binCount;

    // Create bins
    const bins: { binStart: number; binEnd: number; binLabel: string; count: number; cumulative: number; density: number }[] = [];
    let cumulativeCount = 0;

    for (let i = 0; i < binCount; i++) {
      const binStart = min + i * binWidth;
      const binEnd = min + (i + 1) * binWidth;
      const count = values.filter((v) =>
        i === binCount - 1
          ? v >= binStart && v <= binEnd
          : v >= binStart && v < binEnd
      ).length;

      cumulativeCount += count;

      bins.push({
        binStart,
        binEnd,
        binLabel: `${formatNumber(binStart)}-${formatNumber(binEnd)}`,
        count,
        cumulative: cumulativeCount,
        density: count / values.length / binWidth,
      });
    }

    // Calculate normal distribution if needed
    if (showNormal) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
      const stdDev = Math.sqrt(variance);

      bins.forEach((bin) => {
        const x = (bin.binStart + bin.binEnd) / 2;
        const exponent = -((x - mean) ** 2) / (2 * variance);
        const normalDensity = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
        (bin as Record<string, unknown>).normalDensity = normalDensity * values.length * binWidth;
      });
    }

    return bins;
  }, [data, valueColumn, binCount, showNormal]);

  // Calculate statistics for display
  const stats = useMemo(() => {
    const values = data
      .map((row) => {
        const val = row[valueColumn];
        return typeof val === 'number' ? val : parseFloat(String(val));
      })
      .filter((v) => !isNaN(v));

    if (values.length === 0) return null;

    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const sortedValues = [...values].sort((a, b) => a - b);
    const median = sortedValues[Math.floor(n / 2)];
    const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    return { n, mean, median, stdDev, min: sortedValues[0], max: sortedValues[n - 1] };
  }, [data, valueColumn]);

  const yDataKey = cumulative ? 'cumulative' : showDensity ? 'density' : 'count';

  if (histogramData.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
        No numeric data available for histogram
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={histogramData}
          margin={{ top: 20, right: 30, bottom: 60, left: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
          <XAxis
            dataKey="binLabel"
            stroke="#888"
            tick={{ fill: '#888', fontSize: 10 }}
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
            label={{
              value: cumulative ? 'Cumulative Count' : showDensity ? 'Density' : 'Frequency',
              angle: -90,
              position: 'left',
              offset: 40,
              fill: '#888',
              fontSize: 12,
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f1f1f',
              border: '1px solid #333',
              borderRadius: 4,
              maxWidth: 300,
            }}
            labelStyle={{ color: '#fff' }}
            formatter={(value, name) => {
              const label = name === 'normalDensity' ? 'Normal Curve' :
                cumulative ? 'Cumulative' : showDensity ? 'Density' : 'Count';
              return [formatNumber(value as number), label];
            }}
          />

          <Bar
            dataKey={yDataKey}
            fill={colors[0]}
            fillOpacity={0.8}
            stroke={colors[0]}
            strokeWidth={1}
          />

          {showNormal && (
            <Line
              type="monotone"
              dataKey="normalDensity"
              stroke={colors[1]}
              strokeWidth={2}
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Statistics panel */}
      {stats && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            backgroundColor: 'rgba(31, 31, 31, 0.9)',
            border: '1px solid #333',
            borderRadius: 4,
            padding: '8px 12px',
            fontSize: 11,
            color: '#888',
          }}
        >
          <div>n = {stats.n}</div>
          <div>Mean: {formatNumber(stats.mean)}</div>
          <div>Median: {formatNumber(stats.median)}</div>
          <div>StdDev: {formatNumber(stats.stdDev)}</div>
        </div>
      )}
    </div>
  );
}
