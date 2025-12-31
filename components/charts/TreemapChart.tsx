'use client';

import { useMemo, useCallback } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { getChartColors, formatNumber, truncateLabel } from '@/lib/chart-utils';

interface TreemapNode {
  name: string;
  value?: number;
  children?: TreemapNode[];
  color?: string;
  [key: string]: unknown;
}

interface TreemapContentProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  value?: number;
  depth: number;
  showLabels: boolean;
  labelMinSize: number;
  getNodeColor: (node: TreemapNode, depth: number) => string;
}

// Extracted outside component to prevent recreation on each render
function TreemapContent({
  x,
  y,
  width,
  height,
  name,
  value,
  depth,
  showLabels,
  labelMinSize,
  getNodeColor,
}: TreemapContentProps) {
  const showLabel = showLabels && width >= labelMinSize && height >= 20;
  const nodeData: TreemapNode = { name, value };

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={getNodeColor(nodeData, depth)}
        stroke="#1a1a1a"
        strokeWidth={2}
        rx={4}
        style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
      />
      {showLabel && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - (value !== undefined ? 6 : 0)}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#fff"
            fontSize={12}
            fontWeight={500}
            style={{ pointerEvents: 'none' }}
          >
            {truncateLabel(name, Math.floor(width / 8))}
          </text>
          {value !== undefined && height >= 40 && (
            <text
              x={x + width / 2}
              y={y + height / 2 + 10}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(255,255,255,0.7)"
              fontSize={10}
              style={{ pointerEvents: 'none' }}
            >
              {formatNumber(value)}
            </text>
          )}
        </>
      )}
    </g>
  );
}

interface TreemapChartProps {
  data: Record<string, unknown>[];
  pathColumns: string[];
  valueColumn: string;
  colorByValue?: boolean;
  showLabels?: boolean;
  labelMinSize?: number;
}

/**
 * Treemap Chart Component
 *
 * Displays hierarchical data as nested rectangles where size represents value.
 * Best for: Part-to-whole analysis with hierarchical categories
 */
export function TreemapChart({
  data,
  pathColumns,
  valueColumn,
  colorByValue = false,
  showLabels = true,
  labelMinSize = 40,
}: TreemapChartProps) {
  const colors = getChartColors();

  // Build hierarchical data structure from flat data
  const hierarchicalData = useMemo(() => {
    const root: TreemapNode = { name: 'root', children: [] };

    data.forEach((row) => {
      let currentNode = root;

      pathColumns.forEach((col, depth) => {
        const nodeName = String(row[col] ?? 'Unknown');
        let child = currentNode.children?.find((c) => c.name === nodeName);

        if (!child) {
          child = {
            name: nodeName,
            children: [],
            color: colors[depth % colors.length],
          };
          currentNode.children = currentNode.children || [];
          currentNode.children.push(child);
        }

        // If this is the last path column, add the value
        if (depth === pathColumns.length - 1) {
          const value = typeof row[valueColumn] === 'number'
            ? row[valueColumn]
            : parseFloat(String(row[valueColumn])) || 0;

          // For leaf nodes, set value directly
          if (child.children && child.children.length === 0) {
            child.value = (child.value || 0) + value;
            delete child.children;
          } else {
            // Check if a leaf with this exact name/value combo exists
            const existingLeaf = child.children?.find(
              (c) => c.name === nodeName && c.value !== undefined
            );
            if (existingLeaf) {
              existingLeaf.value = (existingLeaf.value || 0) + value;
            } else if (!child.children || child.children.length === 0) {
              child.value = (child.value || 0) + value;
              delete child.children;
            }
          }
        }

        currentNode = child;
      });
    });

    // Clean up the structure - remove empty children arrays
    const cleanNode = (node: TreemapNode): TreemapNode => {
      if (node.children && node.children.length > 0) {
        node.children = node.children.map(cleanNode);
      } else if (node.children && node.children.length === 0) {
        delete node.children;
      }
      return node;
    };

    return cleanNode(root).children || [];
  }, [data, pathColumns, valueColumn, colors]);

  // Calculate color based on value if colorByValue is enabled
  const getNodeColor = useCallback((node: TreemapNode, depth: number) => {
    if (colorByValue && node.value !== undefined) {
      const allValues = data.map((row) => {
        const v = row[valueColumn];
        return typeof v === 'number' ? v : parseFloat(String(v)) || 0;
      });
      const minValue = Math.min(...allValues);
      const maxValue = Math.max(...allValues);
      const ratio = maxValue > minValue
        ? (node.value - minValue) / (maxValue - minValue)
        : 0.5;
      // Interpolate between light and dark blue
      const r = Math.round(135 + (24 - 135) * ratio);
      const g = Math.round(206 + (144 - 206) * ratio);
      const b = Math.round(250 + (255 - 250) * ratio);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return node.color || colors[depth % colors.length];
  }, [colorByValue, data, valueColumn, colors]);

  // Content renderer that passes stable props
  const renderContent = useCallback((props: Record<string, unknown>) => (
    <TreemapContent
      x={props.x as number}
      y={props.y as number}
      width={props.width as number}
      height={props.height as number}
      name={props.name as string}
      value={props.value as number | undefined}
      depth={props.depth as number}
      showLabels={showLabels}
      labelMinSize={labelMinSize}
      getNodeColor={getNodeColor}
    />
  ), [showLabels, labelMinSize, getNodeColor]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={hierarchicalData}
        dataKey="value"
        aspectRatio={4 / 3}
        stroke="#1a1a1a"
        content={renderContent}
      >
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f1f1f',
            border: '1px solid #333',
            borderRadius: 4,
            maxWidth: 300,
          }}
          labelStyle={{ color: '#fff' }}
          formatter={(value) => [formatNumber(value as number), 'Value']}
        />
      </Treemap>
    </ResponsiveContainer>
  );
}
