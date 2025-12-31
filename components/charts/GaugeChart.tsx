'use client';

import { useMemo } from 'react';
import { ResponsiveContainer } from 'recharts';
import { formatNumber } from '@/lib/chart-utils';

interface GaugeThreshold {
  value: number;
  color: string;
}

interface GaugeChartProps {
  value: number;
  min?: number;
  max?: number;
  target?: number;
  thresholds?: GaugeThreshold[];
  gaugeType?: 'arc' | 'semicircle' | 'full';
  showValue?: boolean;
  label?: string;
  unit?: string;
}

/**
 * Gauge Chart Component
 *
 * Displays a single value on a circular scale with optional thresholds.
 * Best for: KPI dashboards, status indicators, progress metrics
 */
export function GaugeChart({
  value,
  min = 0,
  max = 100,
  target,
  thresholds,
  gaugeType = 'semicircle',
  showValue = true,
  label,
  unit = '',
}: GaugeChartProps) {
  // Default thresholds if not provided (traffic light pattern)
  const effectiveThresholds = thresholds || [
    { value: max * 0.33, color: '#ff4d4f' },
    { value: max * 0.66, color: '#faad14' },
    { value: max, color: '#52c41a' },
  ];

  // Calculate gauge parameters based on type
  const gaugeParams = useMemo(() => {
    switch (gaugeType) {
      case 'arc':
        return { startAngle: 225, endAngle: -45, sweep: 270 };
      case 'full':
        return { startAngle: 90, endAngle: -270, sweep: 360 };
      case 'semicircle':
      default:
        return { startAngle: 180, endAngle: 0, sweep: 180 };
    }
  }, [gaugeType]);

  // Get color for current value
  const getValueColor = () => {
    for (const threshold of effectiveThresholds) {
      if (value <= threshold.value) {
        return threshold.color;
      }
    }
    return effectiveThresholds[effectiveThresholds.length - 1]?.color || '#52c41a';
  };

  // Convert value to angle
  const valueToAngle = (val: number) => {
    const clampedValue = Math.max(min, Math.min(max, val));
    const ratio = (clampedValue - min) / (max - min);
    return gaugeParams.startAngle - ratio * gaugeParams.sweep;
  };

  // Convert angle to cartesian coordinates
  const polarToCartesian = (cx: number, cy: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
      x: cx + radius * Math.cos(angleInRadians),
      y: cy - radius * Math.sin(angleInRadians),
    };
  };

  // Generate arc path
  const describeArc = (
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ) => {
    const start = polarToCartesian(cx, cy, radius, startAngle);
    const end = polarToCartesian(cx, cy, radius, endAngle);
    const largeArcFlag = startAngle - endAngle <= 180 ? '0' : '1';

    return [
      'M', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 1, end.x, end.y,
    ].join(' ');
  };

  const valueAngle = valueToAngle(value);
  const valueColor = getValueColor();

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        {({ width, height }) => {
          if (!width || !height) return <svg />;

          const cx = width / 2;
          const margin = gaugeType === 'semicircle' ? 40 : 20;
          const cy = gaugeType === 'semicircle' ? height - margin : height / 2;
          const radius = Math.min(
            cx - 20,
            gaugeType === 'semicircle' ? height - margin - 20 : (height - 40) / 2
          );
          const innerRadius = radius * 0.75;
          const arcWidth = radius - innerRadius;

          return (
            <svg width={width} height={height}>
              {/* Background arc segments for thresholds */}
              {effectiveThresholds.map((threshold, index) => {
                const prevThreshold = index > 0 ? effectiveThresholds[index - 1].value : min;
                const segmentStart = valueToAngle(prevThreshold);
                const segmentEnd = valueToAngle(threshold.value);

                return (
                  <path
                    key={`bg-${index}`}
                    d={describeArc(cx, cy, radius - arcWidth / 2, segmentStart, segmentEnd)}
                    fill="none"
                    stroke={threshold.color}
                    strokeWidth={arcWidth}
                    strokeLinecap="round"
                    opacity={0.2}
                  />
                );
              })}

              {/* Value arc */}
              <path
                d={describeArc(cx, cy, radius - arcWidth / 2, gaugeParams.startAngle, valueAngle)}
                fill="none"
                stroke={valueColor}
                strokeWidth={arcWidth}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
              />

              {/* Center content */}
              <g>
                {showValue && (
                  <>
                    <text
                      x={cx}
                      y={gaugeType === 'semicircle' ? cy - 30 : cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={valueColor}
                      fontSize={radius * 0.25}
                      fontWeight={600}
                    >
                      {formatNumber(value)}{unit}
                    </text>
                    {label && (
                      <text
                        x={cx}
                        y={gaugeType === 'semicircle' ? cy - 10 : cy + radius * 0.15}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#888"
                        fontSize={12}
                      >
                        {label}
                      </text>
                    )}
                  </>
                )}

                {/* Target indicator */}
                {target !== undefined && (
                  <>
                    {(() => {
                      const targetAngle = valueToAngle(target);
                      const targetPos = polarToCartesian(cx, cy, radius + 8, targetAngle);
                      return (
                        <g>
                          <circle
                            cx={targetPos.x}
                            cy={targetPos.y}
                            r={6}
                            fill="#fff"
                            stroke="#333"
                            strokeWidth={2}
                          />
                          <title>Target: {formatNumber(target)}</title>
                        </g>
                      );
                    })()}
                  </>
                )}
              </g>

              {/* Min/Max labels */}
              <text
                x={polarToCartesian(cx, cy, radius + 15, gaugeParams.startAngle).x}
                y={polarToCartesian(cx, cy, radius + 15, gaugeParams.startAngle).y}
                textAnchor="middle"
                fill="#888"
                fontSize={10}
              >
                {formatNumber(min)}
              </text>
              <text
                x={polarToCartesian(cx, cy, radius + 15, gaugeParams.startAngle - gaugeParams.sweep).x}
                y={polarToCartesian(cx, cy, radius + 15, gaugeParams.startAngle - gaugeParams.sweep).y}
                textAnchor="middle"
                fill="#888"
                fontSize={10}
              >
                {formatNumber(max)}
              </text>
            </svg>
          );
        }}
      </ResponsiveContainer>
    </div>
  );
}
