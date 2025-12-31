'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { getChartColors, formatNumber, truncateLabel } from '@/lib/chart-utils';

interface BubbleChartProps {
  data: Record<string, unknown>[];
  xColumn: string;
  yColumn: string;
  sizeColumn: string;
  colorColumn?: string;
  labelColumn?: string;
  minSize?: number;
  maxSize?: number;
  opacity?: number;
}

/**
 * Bubble Chart Component
 *
 * Extends scatter plot with a third dimension represented by bubble size.
 * Best for: Three-variable analysis, portfolio visualization
 */
export function BubbleChart({
  data,
  xColumn,
  yColumn,
  sizeColumn,
  colorColumn,
  labelColumn,
  minSize = 50,
  maxSize = 400,
  opacity = 0.7,
}: BubbleChartProps) {
  const colors = getChartColors();

  // Process data and calculate size range
  const processedData = data.map((row, index) => {
    const x = typeof row[xColumn] === 'number'
      ? row[xColumn]
      : parseFloat(String(row[xColumn])) || 0;
    const y = typeof row[yColumn] === 'number'
      ? row[yColumn]
      : parseFloat(String(row[yColumn])) || 0;
    const size = typeof row[sizeColumn] === 'number'
      ? row[sizeColumn]
      : parseFloat(String(row[sizeColumn])) || 10;
    const color = colorColumn ? String(row[colorColumn] ?? '') : '';
    const label = labelColumn ? String(row[labelColumn] ?? '') : '';

    return { x, y, z: size, color, label, index, originalRow: row };
  });

  // Get unique color categories for legend
  const colorCategories = colorColumn
    ? [...new Set(processedData.map((d) => d.color))]
    : [];

  // Get color for a data point
  const getColor = (point: (typeof processedData)[0]) => {
    if (colorColumn && point.color) {
      const categoryIndex = colorCategories.indexOf(point.color);
      return colors[categoryIndex % colors.length];
    }
    return colors[0];
  };

  // Calculate axis domains with padding
  const xValues = processedData.map((d) => d.x);
  const yValues = processedData.map((d) => d.y);
  const sizeValues = processedData.map((d) => d.z);

  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const sizeMin = Math.min(...sizeValues);
  const sizeMax = Math.max(...sizeValues);

  const xPadding = (xMax - xMin) * 0.1 || 1;
  const yPadding = (yMax - yMin) * 0.1 || 1;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 20, right: 30, bottom: 60, left: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          dataKey="x"
          type="number"
          name={xColumn}
          stroke="#888"
          tick={{ fill: '#888', fontSize: 12 }}
          tickLine={{ stroke: '#888' }}
          tickFormatter={(value) => formatNumber(value)}
          domain={[xMin - xPadding, xMax + xPadding]}
          label={{
            value: xColumn,
            position: 'bottom',
            offset: 40,
            fill: '#888',
            fontSize: 12,
          }}
        />
        <YAxis
          dataKey="y"
          type="number"
          name={yColumn}
          stroke="#888"
          tick={{ fill: '#888', fontSize: 12 }}
          tickLine={{ stroke: '#888' }}
          tickFormatter={(value) => formatNumber(value)}
          domain={[yMin - yPadding, yMax + yPadding]}
          label={{
            value: yColumn,
            angle: -90,
            position: 'left',
            offset: 40,
            fill: '#888',
            fontSize: 12,
          }}
        />
        <ZAxis
          dataKey="z"
          type="number"
          range={[minSize, maxSize]}
          domain={[sizeMin, sizeMax]}
          name={sizeColumn}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f1f1f',
            border: '1px solid #333',
            borderRadius: 4,
            maxWidth: 300,
          }}
          labelStyle={{ color: '#fff' }}
          formatter={(value, name) => [formatNumber(value as number), name]}
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            const point = payload[0].payload;
            return (
              <div
                style={{
                  backgroundColor: '#1f1f1f',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: '8px 12px',
                  maxWidth: 300,
                }}
              >
                {point.label && (
                  <div style={{ color: '#fff', fontWeight: 500, marginBottom: 4 }}>
                    {point.label}
                  </div>
                )}
                <div style={{ color: '#888' }}>
                  {xColumn}: <span style={{ color: '#fff' }}>{formatNumber(point.x)}</span>
                </div>
                <div style={{ color: '#888' }}>
                  {yColumn}: <span style={{ color: '#fff' }}>{formatNumber(point.y)}</span>
                </div>
                <div style={{ color: '#888' }}>
                  {sizeColumn}: <span style={{ color: '#fff' }}>{formatNumber(point.z)}</span>
                </div>
                {colorColumn && point.color && (
                  <div style={{ color: '#888' }}>
                    {colorColumn}: <span style={{ color: '#fff' }}>{point.color}</span>
                  </div>
                )}
              </div>
            );
          }}
        />
        <Scatter data={processedData} fillOpacity={opacity}>
          {processedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(entry)} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
