'use client';

import { useMemo, useState, useRef } from 'react';
import { useDimensions } from '@/hooks/useDimensions';
import { getChartColors, formatNumber, truncateLabel } from '@/lib/chart-utils';

interface TimelineEvent {
  id: string;
  label: string;
  start: Date;
  end: Date;
  category?: string;
  progress?: number;
}

interface TimelineChartProps {
  data: Record<string, unknown>[];
  labelColumn: string;
  startColumn: string;
  endColumn: string;
  categoryColumn?: string;
  progressColumn?: string;
  showMilestones?: boolean;
  showProgress?: boolean;
  groupByCategory?: boolean;
  barHeight?: number;
}

/**
 * Timeline/Gantt Chart Component
 *
 * Displays time-based events or tasks with duration.
 * Best for: Project planning, scheduling, event timelines
 */
export function TimelineChart({
  data,
  labelColumn,
  startColumn,
  endColumn,
  categoryColumn,
  progressColumn,
  showMilestones = false,
  showProgress = true,
  groupByCategory = true,
  barHeight = 24,
}: TimelineChartProps) {
  const colors = getChartColors();
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useDimensions(containerRef);

  // Process data into timeline events
  const { events, categories, timeRange } = useMemo(() => {
    const eventList: TimelineEvent[] = [];
    const categorySet = new Set<string>();
    let minTime = Infinity;
    let maxTime = -Infinity;

    data.forEach((row, index) => {
      const label = String(row[labelColumn] ?? `Event ${index + 1}`);
      const startVal = row[startColumn];
      const endVal = row[endColumn];
      const category = categoryColumn ? String(row[categoryColumn] ?? 'Uncategorized') : undefined;
      const progress = progressColumn
        ? typeof row[progressColumn] === 'number'
          ? row[progressColumn]
          : parseFloat(String(row[progressColumn])) || 0
        : undefined;

      // Parse dates
      let start: Date;
      let end: Date;

      if (startVal instanceof Date) {
        start = startVal;
      } else if (typeof startVal === 'number') {
        start = new Date(startVal);
      } else {
        start = new Date(String(startVal));
      }

      if (endVal instanceof Date) {
        end = endVal;
      } else if (typeof endVal === 'number') {
        end = new Date(endVal);
      } else {
        end = new Date(String(endVal));
      }

      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

      // Handle milestone (same start and end)
      if (start.getTime() === end.getTime() && !showMilestones) {
        end = new Date(start.getTime() + 86400000); // Add 1 day
      }

      minTime = Math.min(minTime, start.getTime());
      maxTime = Math.max(maxTime, end.getTime());

      if (category) categorySet.add(category);

      eventList.push({
        id: `event-${index}`,
        label,
        start,
        end,
        category,
        progress: progress !== undefined ? Math.min(100, Math.max(0, progress)) : undefined,
      });
    });

    // Add padding to time range
    const rangePadding = (maxTime - minTime) * 0.05;

    return {
      events: eventList,
      categories: Array.from(categorySet),
      timeRange: {
        min: minTime - rangePadding,
        max: maxTime + rangePadding,
      },
    };
  }, [data, labelColumn, startColumn, endColumn, categoryColumn, progressColumn, showMilestones]);

  // Group events by category if enabled
  const groupedEvents = useMemo(() => {
    if (!groupByCategory || categories.length === 0) {
      return [{ category: null, events }];
    }

    return categories.map((category) => ({
      category,
      events: events.filter((e) => e.category === category),
    }));
  }, [events, categories, groupByCategory]);

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  if (events.length === 0) {
    return (
      <div ref={containerRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
        No timeline data available
      </div>
    );
  }

  if (!width || !height) {
    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
  }

  const margin = { top: 40, right: 20, bottom: 40, left: 150 };
  const chartWidth = width - margin.left - margin.right;

  // Calculate row positions
  let currentY = 0;
  const rowPositions = groupedEvents.flatMap((group) => {
    const positions = group.events.map((event) => {
      const y = currentY;
      currentY += barHeight + 8;
      return { event, y };
    });
    if (group.category) {
      currentY += 16; // Extra space between categories
    }
    return positions;
  });

  const totalHeight = currentY + margin.top + margin.bottom;
  const svgHeight = Math.max(height, totalHeight);

  // Time scale
  const timeScale = (time: number) => {
    return margin.left + ((time - timeRange.min) / (timeRange.max - timeRange.min)) * chartWidth;
  };

  // Generate time axis ticks
  const tickCount = Math.max(2, Math.floor(chartWidth / 100));
  const timeStep = (timeRange.max - timeRange.min) / tickCount;
  const timeTicks = Array.from({ length: tickCount + 1 }, (_, i) => timeRange.min + i * timeStep);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'auto' }}>
      <svg width={width} height={svgHeight}>
        {/* Time axis */}
        <line
          x1={margin.left}
          y1={margin.top - 10}
          x2={width - margin.right}
          y2={margin.top - 10}
          stroke="#333"
          strokeWidth={1}
        />
        {timeTicks.map((tick, i) => (
          <g key={`tick-${i}`}>
            <line
              x1={timeScale(tick)}
              y1={margin.top - 15}
              x2={timeScale(tick)}
              y2={margin.top - 5}
              stroke="#555"
            />
            <text
              x={timeScale(tick)}
              y={margin.top - 20}
              textAnchor="middle"
              fill="#888"
              fontSize={10}
            >
              {formatDate(new Date(tick))}
            </text>
            {/* Grid line */}
            <line
              x1={timeScale(tick)}
              y1={margin.top}
              x2={timeScale(tick)}
              y2={svgHeight - margin.bottom}
              stroke="#222"
              strokeDasharray="3 3"
            />
          </g>
        ))}

        {/* Category headers and events */}
        {groupedEvents.map((group, groupIndex) => {
          const groupEvents = rowPositions.filter((r) =>
            group.events.includes(r.event)
          );
          if (groupEvents.length === 0) return null;

          const groupStartY = groupEvents[0].y + margin.top;

          return (
            <g key={`group-${groupIndex}`}>
              {group.category && (
                <text
                  x={10}
                  y={groupStartY - 5}
                  fill={colors[groupIndex % colors.length]}
                  fontSize={11}
                  fontWeight={600}
                >
                  {truncateLabel(group.category, 20)}
                </text>
              )}

              {groupEvents.map(({ event, y }) => {
                const startX = timeScale(event.start.getTime());
                const endX = timeScale(event.end.getTime());
                const barWidth = Math.max(endX - startX, 4);
                const yPos = y + margin.top;
                const isHovered = hoveredEvent === event.id;
                const isMilestone = event.start.getTime() === event.end.getTime();
                const color = colors[groupIndex % colors.length];

                return (
                  <g
                    key={event.id}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredEvent(event.id)}
                    onMouseLeave={() => setHoveredEvent(null)}
                  >
                    {/* Event label */}
                    <text
                      x={margin.left - 10}
                      y={yPos + barHeight / 2}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fill={isHovered ? '#fff' : '#888'}
                      fontSize={11}
                    >
                      {truncateLabel(event.label, 18)}
                    </text>

                    {isMilestone && showMilestones ? (
                      // Milestone diamond
                      <polygon
                        points={`${startX},${yPos} ${startX + 8},${yPos + barHeight / 2} ${startX},${yPos + barHeight} ${startX - 8},${yPos + barHeight / 2}`}
                        fill={color}
                        stroke={isHovered ? '#fff' : 'transparent'}
                        strokeWidth={2}
                      />
                    ) : (
                      <>
                        {/* Background bar */}
                        <rect
                          x={startX}
                          y={yPos}
                          width={barWidth}
                          height={barHeight}
                          fill={color}
                          fillOpacity={0.3}
                          stroke={isHovered ? '#fff' : color}
                          strokeWidth={isHovered ? 2 : 1}
                          rx={4}
                        />

                        {/* Progress bar */}
                        {showProgress && event.progress !== undefined && (
                          <rect
                            x={startX}
                            y={yPos}
                            width={barWidth * (event.progress / 100)}
                            height={barHeight}
                            fill={color}
                            rx={4}
                          />
                        )}

                        {/* Duration text */}
                        {barWidth > 50 && (
                          <text
                            x={startX + barWidth / 2}
                            y={yPos + barHeight / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#fff"
                            fontSize={10}
                          >
                            {event.progress !== undefined
                              ? `${Math.round(event.progress)}%`
                              : `${Math.round((event.end.getTime() - event.start.getTime()) / 86400000)}d`}
                          </text>
                        )}
                      </>
                    )}

                    <title>
                      {`${event.label}\n${formatDate(event.start)} - ${formatDate(event.end)}${event.progress !== undefined ? `\nProgress: ${Math.round(event.progress)}%` : ''}`}
                    </title>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Today marker */}
        {(() => {
          const today = Date.now();
          if (today >= timeRange.min && today <= timeRange.max) {
            const todayX = timeScale(today);
            return (
              <g>
                <line
                  x1={todayX}
                  y1={margin.top}
                  x2={todayX}
                  y2={svgHeight - margin.bottom}
                  stroke="#ff4d4f"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
                <text
                  x={todayX}
                  y={svgHeight - margin.bottom + 15}
                  textAnchor="middle"
                  fill="#ff4d4f"
                  fontSize={10}
                >
                  Today
                </text>
              </g>
            );
          }
          return null;
        })()}
      </svg>
    </div>
  );
}
