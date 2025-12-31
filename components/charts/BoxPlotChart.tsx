'use client';

import { useMemo, useState, useRef } from 'react';
import { useDimensions } from '@/hooks/useDimensions';
import { getChartColors, formatNumber, truncateLabel } from '@/lib/chart-utils';

interface BoxPlotStats {
  category: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean?: number;
  outliers: number[];
}

interface BoxPlotChartProps {
  data: Record<string, unknown>[];
  categoryColumn: string;
  valueColumn: string;
  orientation?: 'vertical' | 'horizontal';
  showOutliers?: boolean;
  showMean?: boolean;
  whiskerType?: 'iqr' | 'minmax' | 'stddev';
}

/**
 * Box Plot Chart Component
 *
 * Displays statistical distribution of data showing quartiles and outliers.
 * Best for: Distribution comparison, statistical analysis, identifying outliers
 */
export function BoxPlotChart({
  data,
  categoryColumn,
  valueColumn,
  orientation = 'vertical',
  showOutliers = true,
  showMean = false,
  whiskerType = 'iqr',
}: BoxPlotChartProps) {
  const colors = getChartColors();
  const [hoveredBox, setHoveredBox] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useDimensions(containerRef);

  // Calculate box plot statistics for each category
  const boxPlotData = useMemo(() => {
    const grouped = new Map<string, number[]>();

    data.forEach((row) => {
      const category = String(row[categoryColumn] ?? 'Unknown');
      const value = typeof row[valueColumn] === 'number'
        ? row[valueColumn]
        : parseFloat(String(row[valueColumn]));

      if (!isNaN(value)) {
        if (!grouped.has(category)) {
          grouped.set(category, []);
        }
        grouped.get(category)!.push(value);
      }
    });

    const stats: BoxPlotStats[] = [];

    grouped.forEach((values, category) => {
      values.sort((a, b) => a - b);
      const n = values.length;

      if (n === 0) return;

      const q1Index = Math.floor(n * 0.25);
      const medianIndex = Math.floor(n * 0.5);
      const q3Index = Math.floor(n * 0.75);

      const q1 = values[q1Index];
      const median = values[medianIndex];
      const q3 = values[q3Index];
      const iqr = q3 - q1;

      let whiskerMin: number;
      let whiskerMax: number;

      switch (whiskerType) {
        case 'minmax':
          whiskerMin = values[0];
          whiskerMax = values[n - 1];
          break;
        case 'stddev': {
          const mean = values.reduce((a, b) => a + b, 0) / n;
          const stddev = Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n);
          whiskerMin = Math.max(values[0], mean - 2 * stddev);
          whiskerMax = Math.min(values[n - 1], mean + 2 * stddev);
          break;
        }
        case 'iqr':
        default:
          whiskerMin = Math.max(values[0], q1 - 1.5 * iqr);
          whiskerMax = Math.min(values[n - 1], q3 + 1.5 * iqr);
      }

      const outliers = values.filter((v) => v < whiskerMin || v > whiskerMax);
      const mean = showMean ? values.reduce((a, b) => a + b, 0) / n : undefined;

      stats.push({
        category,
        min: whiskerMin,
        q1,
        median,
        q3,
        max: whiskerMax,
        mean,
        outliers: showOutliers ? outliers : [],
      });
    });

    return stats;
  }, [data, categoryColumn, valueColumn, showOutliers, showMean, whiskerType]);

  const allValues = boxPlotData.flatMap((b) => [b.min, b.max, ...b.outliers]);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const padding = (maxValue - minValue) * 0.1;

  const isHorizontal = orientation === 'horizontal';

  if (!width || !height) {
    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
  }

  const margin = { top: 20, right: 30, bottom: 60, left: 80 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const boxCount = boxPlotData.length;
  const boxSize = isHorizontal ? chartHeight / boxCount : chartWidth / boxCount;
  const boxWidth = boxSize * 0.6;

  const valueScale = (value: number) => {
    const range = maxValue - minValue + 2 * padding;
    const ratio = (value - minValue + padding) / range;
    return isHorizontal
      ? margin.left + ratio * chartWidth
      : margin.top + (1 - ratio) * chartHeight;
  };

  const categoryScale = (index: number) => {
    return isHorizontal
      ? margin.top + index * boxSize + boxSize / 2
      : margin.left + index * boxSize + boxSize / 2;
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height}>
        {/* Grid lines */}
        {Array.from({ length: 5 }).map((_, i) => {
          const value = minValue - padding + ((maxValue - minValue + 2 * padding) * i) / 4;
          const pos = valueScale(value);
          return (
            <g key={`grid-${i}`}>
              {isHorizontal ? (
                <line x1={pos} y1={margin.top} x2={pos} y2={height - margin.bottom} stroke="#333" strokeDasharray="3 3" />
              ) : (
                <line x1={margin.left} y1={pos} x2={width - margin.right} y2={pos} stroke="#333" strokeDasharray="3 3" />
              )}
              <text
                x={isHorizontal ? pos : margin.left - 10}
                y={isHorizontal ? height - margin.bottom + 20 : pos}
                textAnchor={isHorizontal ? 'middle' : 'end'}
                dominantBaseline={isHorizontal ? 'hanging' : 'middle'}
                fill="#888"
                fontSize={10}
              >
                {formatNumber(value)}
              </text>
            </g>
          );
        })}

        {/* Category labels */}
        {boxPlotData.map((box, index) => (
          <text
            key={`label-${index}`}
            x={isHorizontal ? margin.left - 10 : categoryScale(index)}
            y={isHorizontal ? categoryScale(index) : height - margin.bottom + 20}
            textAnchor={isHorizontal ? 'end' : 'middle'}
            dominantBaseline={isHorizontal ? 'middle' : 'hanging'}
            fill="#888"
            fontSize={11}
            transform={isHorizontal ? undefined : `rotate(-45 ${categoryScale(index)} ${height - margin.bottom + 20})`}
          >
            {truncateLabel(box.category, 12)}
          </text>
        ))}

        {/* Box plots */}
        {boxPlotData.map((box, index) => {
          const color = colors[index % colors.length];
          const isHovered = hoveredBox === box.category;
          const opacity = hoveredBox === null ? 1 : isHovered ? 1 : 0.4;

          const boxX = isHorizontal ? valueScale(box.q1) : categoryScale(index) - boxWidth / 2;
          const boxY = isHorizontal ? categoryScale(index) - boxWidth / 2 : valueScale(box.q3);
          const boxW = isHorizontal ? valueScale(box.q3) - valueScale(box.q1) : boxWidth;
          const boxH = isHorizontal ? boxWidth : valueScale(box.q1) - valueScale(box.q3);

          return (
            <g
              key={`box-${index}`}
              opacity={opacity}
              style={{ transition: 'opacity 0.2s' }}
              onMouseEnter={() => setHoveredBox(box.category)}
              onMouseLeave={() => setHoveredBox(null)}
            >
              {/* Whiskers */}
              {isHorizontal ? (
                <>
                  <line x1={valueScale(box.min)} y1={categoryScale(index)} x2={valueScale(box.q1)} y2={categoryScale(index)} stroke={color} strokeWidth={2} />
                  <line x1={valueScale(box.q3)} y1={categoryScale(index)} x2={valueScale(box.max)} y2={categoryScale(index)} stroke={color} strokeWidth={2} />
                  <line x1={valueScale(box.min)} y1={categoryScale(index) - boxWidth / 4} x2={valueScale(box.min)} y2={categoryScale(index) + boxWidth / 4} stroke={color} strokeWidth={2} />
                  <line x1={valueScale(box.max)} y1={categoryScale(index) - boxWidth / 4} x2={valueScale(box.max)} y2={categoryScale(index) + boxWidth / 4} stroke={color} strokeWidth={2} />
                </>
              ) : (
                <>
                  <line x1={categoryScale(index)} y1={valueScale(box.min)} x2={categoryScale(index)} y2={valueScale(box.q1)} stroke={color} strokeWidth={2} />
                  <line x1={categoryScale(index)} y1={valueScale(box.q3)} x2={categoryScale(index)} y2={valueScale(box.max)} stroke={color} strokeWidth={2} />
                  <line x1={categoryScale(index) - boxWidth / 4} y1={valueScale(box.min)} x2={categoryScale(index) + boxWidth / 4} y2={valueScale(box.min)} stroke={color} strokeWidth={2} />
                  <line x1={categoryScale(index) - boxWidth / 4} y1={valueScale(box.max)} x2={categoryScale(index) + boxWidth / 4} y2={valueScale(box.max)} stroke={color} strokeWidth={2} />
                </>
              )}

              {/* Box */}
              <rect x={boxX} y={boxY} width={Math.abs(boxW)} height={Math.abs(boxH)} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={2} rx={2} style={{ cursor: 'pointer' }} />

              {/* Median line */}
              {isHorizontal ? (
                <line x1={valueScale(box.median)} y1={categoryScale(index) - boxWidth / 2} x2={valueScale(box.median)} y2={categoryScale(index) + boxWidth / 2} stroke="#fff" strokeWidth={2} />
              ) : (
                <line x1={categoryScale(index) - boxWidth / 2} y1={valueScale(box.median)} x2={categoryScale(index) + boxWidth / 2} y2={valueScale(box.median)} stroke="#fff" strokeWidth={2} />
              )}

              {/* Mean marker */}
              {showMean && box.mean !== undefined && (
                <circle cx={isHorizontal ? valueScale(box.mean) : categoryScale(index)} cy={isHorizontal ? categoryScale(index) : valueScale(box.mean)} r={4} fill="#fff" stroke={color} strokeWidth={2} />
              )}

              {/* Outliers */}
              {box.outliers.map((outlier, oIndex) => (
                <circle key={`outlier-${oIndex}`} cx={isHorizontal ? valueScale(outlier) : categoryScale(index)} cy={isHorizontal ? categoryScale(index) : valueScale(outlier)} r={4} fill="transparent" stroke={color} strokeWidth={2} />
              ))}

              <title>{`${box.category}\nMin: ${formatNumber(box.min)}\nQ1: ${formatNumber(box.q1)}\nMedian: ${formatNumber(box.median)}\nQ3: ${formatNumber(box.q3)}\nMax: ${formatNumber(box.max)}${box.mean !== undefined ? `\nMean: ${formatNumber(box.mean)}` : ''}${box.outliers.length > 0 ? `\nOutliers: ${box.outliers.length}` : ''}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
