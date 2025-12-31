'use client';

import { useMemo, useState } from 'react';
import { ResponsiveContainer } from 'recharts';
import { getChartColors, formatNumber, truncateLabel } from '@/lib/chart-utils';

interface SunburstNode {
  name: string;
  value?: number;
  children?: SunburstNode[];
  color?: string;
  path?: string[];
}

interface SunburstChartProps {
  data: Record<string, unknown>[];
  pathColumns: string[];
  valueColumn: string;
  innerRadius?: number;
  showLabels?: boolean;
  highlightAncestors?: boolean;
}

/**
 * Sunburst Chart Component
 *
 * Displays hierarchical data as concentric rings where angle represents value.
 * Best for: Hierarchical part-to-whole with multiple levels
 */
export function SunburstChart({
  data,
  pathColumns,
  valueColumn,
  innerRadius = 30,
  showLabels = true,
  highlightAncestors = true,
}: SunburstChartProps) {
  const colors = getChartColors();
  const [hoveredPath, setHoveredPath] = useState<string[] | null>(null);

  // Build hierarchical data structure
  const hierarchicalData = useMemo(() => {
    const root: SunburstNode = { name: 'root', children: [], value: 0, path: [] };

    data.forEach((row) => {
      let currentNode = root;
      const currentPath: string[] = [];

      pathColumns.forEach((col, depth) => {
        const nodeName = String(row[col] ?? 'Unknown');
        currentPath.push(nodeName);
        let child = currentNode.children?.find((c) => c.name === nodeName);

        if (!child) {
          child = {
            name: nodeName,
            children: [],
            color: colors[depth % colors.length],
            path: [...currentPath],
            value: 0,
          };
          currentNode.children = currentNode.children || [];
          currentNode.children.push(child);
        }

        // If last column, add value
        if (depth === pathColumns.length - 1) {
          const value = typeof row[valueColumn] === 'number'
            ? row[valueColumn]
            : parseFloat(String(row[valueColumn])) || 0;
          child.value = (child.value || 0) + value;
        }

        currentNode = child;
      });
    });

    // Calculate parent values (sum of children)
    const calculateValues = (node: SunburstNode): number => {
      if (!node.children || node.children.length === 0) {
        return node.value || 0;
      }
      const sum = node.children.reduce((acc, child) => acc + calculateValues(child), 0);
      node.value = sum;
      return sum;
    };
    calculateValues(root);

    return root;
  }, [data, pathColumns, valueColumn, colors]);

  // Flatten hierarchy into arc segments
  const arcs = useMemo(() => {
    const result: {
      name: string;
      value: number;
      depth: number;
      startAngle: number;
      endAngle: number;
      color: string;
      path: string[];
    }[] = [];

    const totalValue = hierarchicalData.value || 1;

    const processNode = (
      node: SunburstNode,
      depth: number,
      startAngle: number,
      angleRange: number
    ) => {
      if (!node.children) return;

      let currentAngle = startAngle;

      node.children.forEach((child) => {
        const childAngle = ((child.value || 0) / totalValue) * 360;
        if (childAngle > 0.5) { // Skip very small segments
          result.push({
            name: child.name,
            value: child.value || 0,
            depth,
            startAngle: currentAngle,
            endAngle: currentAngle + childAngle,
            color: child.color || colors[depth % colors.length],
            path: child.path || [],
          });

          if (child.children && child.children.length > 0) {
            processNode(child, depth + 1, currentAngle, childAngle);
          }
        }
        currentAngle += childAngle;
      });
    };

    processNode(hierarchicalData, 0, 0, 360);
    return result;
  }, [hierarchicalData, colors]);

  // Convert polar to cartesian coordinates
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  // Generate arc path
  const describeArc = (
    x: number,
    y: number,
    innerR: number,
    outerR: number,
    startAngle: number,
    endAngle: number
  ) => {
    const start1 = polarToCartesian(x, y, outerR, endAngle);
    const end1 = polarToCartesian(x, y, outerR, startAngle);
    const start2 = polarToCartesian(x, y, innerR, startAngle);
    const end2 = polarToCartesian(x, y, innerR, endAngle);

    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
      'M', start1.x, start1.y,
      'A', outerR, outerR, 0, largeArcFlag, 0, end1.x, end1.y,
      'L', start2.x, start2.y,
      'A', innerR, innerR, 0, largeArcFlag, 1, end2.x, end2.y,
      'Z',
    ].join(' ');
  };

  const isHighlighted = (path: string[]) => {
    if (!hoveredPath || !highlightAncestors) return false;
    // Check if this path is an ancestor of or equal to the hovered path
    if (path.length > hoveredPath.length) return false;
    return path.every((p, i) => p === hoveredPath[i]);
  };

  const maxDepth = Math.max(...arcs.map((a) => a.depth), 0) + 1;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        {({ width, height }) => {
          if (!width || !height) return <svg />;

          const cx = width / 2;
          const cy = height / 2;
          const maxRadius = Math.min(cx, cy) - 20;
          const ringWidth = (maxRadius - innerRadius) / maxDepth;

          return (
            <svg width={width} height={height}>
              {arcs.map((arc, index) => {
                const arcInnerRadius = innerRadius + arc.depth * ringWidth;
                const arcOuterRadius = arcInnerRadius + ringWidth - 2;
                const isHovered = isHighlighted(arc.path);
                const opacity = hoveredPath
                  ? isHovered ? 1 : 0.3
                  : 1;

                const midAngle = (arc.startAngle + arc.endAngle) / 2;
                const labelRadius = (arcInnerRadius + arcOuterRadius) / 2;
                const labelPos = polarToCartesian(cx, cy, labelRadius, midAngle);
                const arcAngle = arc.endAngle - arc.startAngle;
                const showLabel = showLabels && arcAngle > 15 && ringWidth > 20;

                return (
                  <g key={`arc-${index}`}>
                    <path
                      d={describeArc(cx, cy, arcInnerRadius, arcOuterRadius, arc.startAngle, arc.endAngle)}
                      fill={arc.color}
                      stroke="#1a1a1a"
                      strokeWidth={1}
                      opacity={opacity}
                      style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                      onMouseEnter={() => setHoveredPath(arc.path)}
                      onMouseLeave={() => setHoveredPath(null)}
                    >
                      <title>
                        {arc.path.join(' → ')}: {formatNumber(arc.value)}
                      </title>
                    </path>
                    {showLabel && (
                      <text
                        x={labelPos.x}
                        y={labelPos.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#fff"
                        fontSize={10}
                        style={{ pointerEvents: 'none' }}
                        opacity={opacity}
                      >
                        {truncateLabel(arc.name, 8)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Center circle */}
              <circle
                cx={cx}
                cy={cy}
                r={innerRadius - 2}
                fill="#1a1a1a"
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#888"
                fontSize={12}
              >
                {formatNumber(hierarchicalData.value || 0)}
              </text>
            </svg>
          );
        }}
      </ResponsiveContainer>

      {/* Tooltip */}
      {hoveredPath && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            backgroundColor: '#1f1f1f',
            border: '1px solid #333',
            borderRadius: 4,
            padding: '8px 12px',
            color: '#fff',
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          <div style={{ color: '#888', marginBottom: 4 }}>{hoveredPath.join(' → ')}</div>
          <div>
            {formatNumber(
              arcs.find((a) => a.path.join('/') === hoveredPath.join('/'))?.value || 0
            )}
          </div>
        </div>
      )}
    </div>
  );
}
