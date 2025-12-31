'use client';

import { useMemo, useState, useRef } from 'react';
import { useDimensions } from '@/hooks/useDimensions';
import { getChartColors, formatNumber, truncateLabel } from '@/lib/chart-utils';

interface SankeyNode {
  name: string;
  value: number;
  x: number;
  y: number;
  height: number;
  column: number;
}

interface SankeyLink {
  source: number;
  target: number;
  value: number;
  sourceNode: SankeyNode;
  targetNode: SankeyNode;
}

interface SankeyChartProps {
  data: Record<string, unknown>[];
  sourceColumn: string;
  targetColumn: string;
  valueColumn: string;
  nodeWidth?: number;
  nodePadding?: number;
  linkOpacity?: number;
  colorMode?: 'source' | 'target' | 'gradient';
}

/**
 * Sankey Diagram Component
 *
 * Displays flow between nodes where link width represents flow magnitude.
 * Best for: Flow analysis, process visualization, resource allocation
 */
export function SankeyChart({
  data,
  sourceColumn,
  targetColumn,
  valueColumn,
  nodeWidth = 24,
  nodePadding = 8,
  linkOpacity = 0.5,
  colorMode = 'source',
}: SankeyChartProps) {
  const colors = getChartColors();
  const [hoveredLink, setHoveredLink] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useDimensions(containerRef);

  // Process data into nodes and links
  const { nodes, links } = useMemo(() => {
    const nodeMap = new Map<string, { name: string; column: number; totalValue: number }>();
    const linkList: { source: string; target: string; value: number }[] = [];

    // First pass: identify unique nodes and their columns
    data.forEach((row) => {
      const source = String(row[sourceColumn] ?? '');
      const target = String(row[targetColumn] ?? '');
      const value = typeof row[valueColumn] === 'number'
        ? row[valueColumn]
        : parseFloat(String(row[valueColumn])) || 0;

      if (source && target && value > 0) {
        if (!nodeMap.has(source)) {
          nodeMap.set(source, { name: source, column: 0, totalValue: 0 });
        }
        if (!nodeMap.has(target)) {
          nodeMap.set(target, { name: target, column: 1, totalValue: 0 });
        }

        // Ensure target is in a later column than source
        const sourceNode = nodeMap.get(source)!;
        const targetNode = nodeMap.get(target)!;
        if (targetNode.column <= sourceNode.column) {
          targetNode.column = sourceNode.column + 1;
        }

        sourceNode.totalValue += value;
        targetNode.totalValue += value;

        linkList.push({ source, target, value });
      }
    });

    // Convert to array and assign indices
    const nodeArray = Array.from(nodeMap.entries()).map(([nodeName, nodeData], index) => ({
      ...nodeData,
      name: nodeName,
      index,
    }));

    // Create index lookup
    const nodeIndexMap = new Map(nodeArray.map((n, i) => [n.name, i]));

    // Create links with indices
    const processedLinks = linkList.map((link) => ({
      source: nodeIndexMap.get(link.source)!,
      target: nodeIndexMap.get(link.target)!,
      value: link.value,
    }));

    return {
      nodes: nodeArray,
      links: processedLinks,
    };
  }, [data, sourceColumn, targetColumn, valueColumn]);

  // Calculate layout
  const layout = useMemo(() => {
    if (nodes.length === 0) return { nodes: [], links: [] };

    // Group nodes by column
    const columns: typeof nodes[] = [];
    const maxColumn = Math.max(...nodes.map((n) => n.column), 0);

    for (let i = 0; i <= maxColumn; i++) {
      columns.push(nodes.filter((n) => n.column === i));
    }

    // Calculate node positions
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    return { columns, margin, maxColumn };
  }, [nodes]);

  // Generate link path
  const generateLinkPath = (
    sourceX: number,
    sourceY: number,
    sourceHeight: number,
    targetX: number,
    targetY: number,
    targetHeight: number
  ) => {
    const sourceMidY = sourceY + sourceHeight / 2;
    const targetMidY = targetY + targetHeight / 2;
    const curvature = 0.5;
    const xi = (sourceX + targetX) / 2;

    return `
      M ${sourceX},${sourceY}
      C ${xi},${sourceY} ${xi},${targetY} ${targetX},${targetY}
      L ${targetX},${targetY + targetHeight}
      C ${xi},${targetY + targetHeight} ${xi},${sourceY + sourceHeight} ${sourceX},${sourceY + sourceHeight}
      Z
    `;
  };

  if (nodes.length === 0) {
    return (
      <div ref={containerRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
        No valid flow data available
      </div>
    );
  }

  if (!width || !height || !layout.columns) {
    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
  }

  const { columns, margin, maxColumn } = layout;
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const columnWidth = chartWidth / (maxColumn + 1);

  // Calculate node heights based on value
  const maxColumnValue = Math.max(
    ...columns.map((col) => col.reduce((sum, n) => sum + n.totalValue, 0)),
    1
  );
  const heightScale = (chartHeight - (Math.max(...columns.map((c) => c.length), 1) - 1) * nodePadding) / maxColumnValue;

  // Position nodes
  const positionedNodes: SankeyNode[] = [];
  columns.forEach((col, colIndex) => {
    const x = margin.left + colIndex * columnWidth;
    let y = margin.top;
    col.forEach((node) => {
      const nodeHeight = Math.max(node.totalValue * heightScale / 2, 4);
      positionedNodes.push({
        name: node.name,
        value: node.totalValue,
        x,
        y,
        height: nodeHeight,
        column: colIndex,
      });
      y += nodeHeight + nodePadding;
    });
  });

  // Create positioned links
  const positionedLinks: SankeyLink[] = links.map((link) => {
    const sourceNode = positionedNodes[link.source];
    const targetNode = positionedNodes[link.target];
    return {
      ...link,
      sourceNode,
      targetNode,
    };
  });

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height}>
        {/* Links */}
        {positionedLinks.map((link, index) => {
          const sourceX = link.sourceNode.x + nodeWidth;
          const targetX = link.targetNode.x;
          const linkHeight = Math.max((link.value / link.sourceNode.value) * link.sourceNode.height, 2);
          const sourceY = link.sourceNode.y;
          const targetY = link.targetNode.y;

          let fillColor = colors[link.source % colors.length];
          if (colorMode === 'target') {
            fillColor = colors[link.target % colors.length];
          }

          const isHovered = hoveredLink === index;
          const opacity = hoveredLink === null ? linkOpacity : isHovered ? 0.8 : 0.2;

          return (
            <path
              key={`link-${index}`}
              d={generateLinkPath(sourceX, sourceY, linkHeight, targetX, targetY, linkHeight)}
              fill={fillColor}
              opacity={opacity}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              onMouseEnter={() => setHoveredLink(index)}
              onMouseLeave={() => setHoveredLink(null)}
            >
              <title>
                {link.sourceNode.name} → {link.targetNode.name}: {formatNumber(link.value)}
              </title>
            </path>
          );
        })}

        {/* Nodes */}
        {positionedNodes.map((node, index) => (
          <g key={`node-${index}`}>
            <rect
              x={node.x}
              y={node.y}
              width={nodeWidth}
              height={node.height}
              fill={colors[node.column % colors.length]}
              stroke="#1a1a1a"
              strokeWidth={1}
              rx={2}
            >
              <title>{node.name}: {formatNumber(node.value)}</title>
            </rect>
            <text
              x={node.column === maxColumn ? node.x - 5 : node.x + nodeWidth + 5}
              y={node.y + node.height / 2}
              textAnchor={node.column === maxColumn ? 'end' : 'start'}
              dominantBaseline="middle"
              fill="#888"
              fontSize={11}
            >
              {truncateLabel(node.name, 15)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
