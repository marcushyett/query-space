'use client';

import { useMemo, useState } from 'react';
import { ResponsiveContainer, Tooltip } from 'recharts';
import { formatNumber, truncateLabel, getHeatmapColorScale } from '@/lib/chart-utils';

interface HeatmapDataItem {
  x: string;
  y: string;
  value: number;
}

interface HeatmapChartProps {
  data: HeatmapDataItem[];
  xValues: string[];
  yValues: string[];
  minValue: number;
  maxValue: number;
}

export function HeatmapChart({
  data,
  xValues,
  yValues,
  minValue,
  maxValue,
}: HeatmapChartProps) {
  const [hoveredCell, setHoveredCell] = useState<HeatmapDataItem | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Create a lookup map for quick data access
  const dataMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((item) => {
      map.set(`${item.x}-${item.y}`, item.value);
    });
    return map;
  }, [data]);

  // Calculate cell dimensions
  const margin = { top: 40, right: 120, bottom: 80, left: 100 };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        {({ width, height }) => {
          if (!width || !height) return <svg />;

          const chartWidth = width - margin.left - margin.right;
          const chartHeight = height - margin.top - margin.bottom;
          const cellWidth = chartWidth / xValues.length;
          const cellHeight = chartHeight / yValues.length;

          return (
            <svg width={width} height={height}>
              {/* Y-axis labels */}
              {yValues.map((yVal, yIdx) => (
                <text
                  key={`y-${yIdx}`}
                  x={margin.left - 10}
                  y={margin.top + yIdx * cellHeight + cellHeight / 2}
                  textAnchor="end"
                  alignmentBaseline="middle"
                  fill="#888"
                  fontSize={12}
                >
                  {truncateLabel(yVal, 12)}
                </text>
              ))}

              {/* X-axis labels */}
              {xValues.map((xVal, xIdx) => (
                <text
                  key={`x-${xIdx}`}
                  x={margin.left + xIdx * cellWidth + cellWidth / 2}
                  y={height - margin.bottom + 20}
                  textAnchor="end"
                  fill="#888"
                  fontSize={12}
                  transform={`rotate(-45 ${margin.left + xIdx * cellWidth + cellWidth / 2} ${height - margin.bottom + 20})`}
                >
                  {truncateLabel(xVal, 12)}
                </text>
              ))}

              {/* Heatmap cells */}
              {yValues.map((yVal, yIdx) =>
                xValues.map((xVal, xIdx) => {
                  const value = dataMap.get(`${xVal}-${yVal}`) ?? 0;
                  const color = getHeatmapColorScale(value, minValue, maxValue);
                  const isHovered =
                    hoveredCell?.x === xVal && hoveredCell?.y === yVal;

                  return (
                    <rect
                      key={`cell-${xIdx}-${yIdx}`}
                      x={margin.left + xIdx * cellWidth}
                      y={margin.top + yIdx * cellHeight}
                      width={cellWidth - 2}
                      height={cellHeight - 2}
                      fill={color}
                      stroke={isHovered ? '#fff' : 'transparent'}
                      strokeWidth={isHovered ? 2 : 0}
                      rx={2}
                      style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => {
                        setHoveredCell({ x: xVal, y: yVal, value });
                        setTooltipPosition({
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      onMouseMove={(e) => {
                        setTooltipPosition({
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                    />
                  );
                })
              )}

              {/* Legend */}
              <defs>
                <linearGradient id="heatmapGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop
                    offset="0%"
                    stopColor={getHeatmapColorScale(minValue, minValue, maxValue)}
                  />
                  <stop
                    offset="100%"
                    stopColor={getHeatmapColorScale(maxValue, minValue, maxValue)}
                  />
                </linearGradient>
              </defs>
              <rect
                x={width - margin.right + 20}
                y={margin.top}
                width={20}
                height={chartHeight}
                fill="url(#heatmapGradient)"
                rx={4}
              />
              <text
                x={width - margin.right + 50}
                y={margin.top + 10}
                fill="#888"
                fontSize={10}
              >
                {formatNumber(maxValue)}
              </text>
              <text
                x={width - margin.right + 50}
                y={margin.top + chartHeight}
                fill="#888"
                fontSize={10}
              >
                {formatNumber(minValue)}
              </text>
            </svg>
          );
        }}
      </ResponsiveContainer>

      {/* Custom tooltip */}
      {hoveredCell && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y + 10,
            backgroundColor: '#1f1f1f',
            border: '1px solid #333',
            borderRadius: 4,
            padding: '8px 12px',
            color: '#fff',
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 1000,
            maxWidth: 200,
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <strong>{hoveredCell.x}</strong> / <strong>{hoveredCell.y}</strong>
          </div>
          <div>Value: {formatNumber(hoveredCell.value)}</div>
        </div>
      )}
    </div>
  );
}
