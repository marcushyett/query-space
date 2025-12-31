'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { ResponsiveContainer } from 'recharts';
import { getChartColors, formatNumber, truncateLabel } from '@/lib/chart-utils';

interface NetworkNode {
  id: string;
  name: string;
  value: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  group?: string;
}

interface NetworkLink {
  source: string;
  target: string;
  value: number;
}

interface NetworkChartProps {
  data: Record<string, unknown>[];
  sourceColumn: string;
  targetColumn: string;
  weightColumn?: string;
  nodeSize?: number;
  sizeByConnections?: boolean;
  showLabels?: boolean;
  layout?: 'force' | 'circular' | 'hierarchical';
  linkDistance?: number;
}

/**
 * Network/Force Graph Chart Component
 *
 * Displays relationships between entities as nodes and edges.
 * Best for: Social networks, dependencies, relationship visualization
 */
export function NetworkChart({
  data,
  sourceColumn,
  targetColumn,
  weightColumn,
  nodeSize = 8,
  sizeByConnections = true,
  showLabels = true,
  layout = 'force',
  linkDistance = 100,
}: NetworkChartProps) {
  const colors = getChartColors();
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
  const iterationRef = useRef(0);

  // Process data into nodes and links
  const { initialNodes, links, nodeConnections } = useMemo(() => {
    const nodeMap = new Map<string, { connections: number; group: string }>();
    const linkList: NetworkLink[] = [];

    data.forEach((row) => {
      const source = String(row[sourceColumn] ?? '');
      const target = String(row[targetColumn] ?? '');
      const weight = weightColumn
        ? typeof row[weightColumn] === 'number'
          ? row[weightColumn]
          : parseFloat(String(row[weightColumn])) || 1
        : 1;

      if (source && target) {
        if (!nodeMap.has(source)) {
          nodeMap.set(source, { connections: 0, group: 'source' });
        }
        if (!nodeMap.has(target)) {
          nodeMap.set(target, { connections: 0, group: 'target' });
        }

        nodeMap.get(source)!.connections++;
        nodeMap.get(target)!.connections++;

        linkList.push({ source, target, value: weight });
      }
    });

    // Create initial node positions
    const nodeArray: NetworkNode[] = Array.from(nodeMap.entries()).map(([id, data], index) => {
      const angle = (2 * Math.PI * index) / nodeMap.size;
      const radius = 150;
      return {
        id,
        name: id,
        value: data.connections,
        x: 200 + radius * Math.cos(angle),
        y: 200 + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        group: data.group,
      };
    });

    return {
      initialNodes: nodeArray,
      links: linkList,
      nodeConnections: nodeMap,
    };
  }, [data, sourceColumn, targetColumn, weightColumn]);

  // Force simulation (simplified)
  useEffect(() => {
    if (layout !== 'force' || initialNodes.length === 0) {
      setNodes(initialNodes);
      return;
    }

    const simulationNodes = initialNodes.map((n) => ({ ...n }));
    iterationRef.current = 0;

    const simulate = () => {
      const alpha = Math.max(0.1, 1 - iterationRef.current / 100);

      // Apply forces
      simulationNodes.forEach((node) => {
        // Centering force
        node.vx += (300 - node.x) * 0.01 * alpha;
        node.vy += (200 - node.y) * 0.01 * alpha;
      });

      // Repulsion between nodes
      for (let i = 0; i < simulationNodes.length; i++) {
        for (let j = i + 1; j < simulationNodes.length; j++) {
          const dx = simulationNodes[j].x - simulationNodes[i].x;
          const dy = simulationNodes[j].y - simulationNodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (30 * alpha) / dist;

          simulationNodes[i].vx -= (dx / dist) * force;
          simulationNodes[i].vy -= (dy / dist) * force;
          simulationNodes[j].vx += (dx / dist) * force;
          simulationNodes[j].vy += (dy / dist) * force;
        }
      }

      // Link attraction
      links.forEach((link) => {
        const sourceNode = simulationNodes.find((n) => n.id === link.source);
        const targetNode = simulationNodes.find((n) => n.id === link.target);
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = ((dist - linkDistance) * 0.01 * alpha);

          sourceNode.vx += (dx / dist) * force;
          sourceNode.vy += (dy / dist) * force;
          targetNode.vx -= (dx / dist) * force;
          targetNode.vy -= (dy / dist) * force;
        }
      });

      // Apply velocity and damping
      simulationNodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= 0.8;
        node.vy *= 0.8;
      });

      setNodes([...simulationNodes]);

      iterationRef.current++;
      if (iterationRef.current < 150 && alpha > 0.1) {
        animationRef.current = requestAnimationFrame(simulate);
      }
    };

    animationRef.current = requestAnimationFrame(simulate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [initialNodes, links, layout, linkDistance]);

  // Handle circular layout
  useEffect(() => {
    if (layout === 'circular') {
      setNodes(initialNodes);
    }
  }, [layout, initialNodes]);

  // Get node size based on connections
  const getNodeSize = (node: NetworkNode) => {
    if (!sizeByConnections) return nodeSize;
    const maxConnections = Math.max(...nodes.map((n) => n.value), 1);
    return nodeSize + (node.value / maxConnections) * nodeSize * 2;
  };

  // Check if link is connected to hovered node
  const isLinkHighlighted = (link: NetworkLink) => {
    if (!hoveredNode) return false;
    return link.source === hoveredNode || link.target === hoveredNode;
  };

  // Check if node is connected to hovered node
  const isNodeHighlighted = (node: NetworkNode) => {
    if (!hoveredNode) return true;
    if (node.id === hoveredNode) return true;
    return links.some(
      (l) =>
        (l.source === hoveredNode && l.target === node.id) ||
        (l.target === hoveredNode && l.source === node.id)
    );
  };

  if (nodes.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
        No network data available
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ResponsiveContainer width="100%" height="100%">
        {({ width, height }) => {
          if (!width || !height) return <svg />;

          // Scale nodes to fit viewport
          const xValues = nodes.map((n) => n.x);
          const yValues = nodes.map((n) => n.y);
          const minX = Math.min(...xValues);
          const maxX = Math.max(...xValues);
          const minY = Math.min(...yValues);
          const maxY = Math.max(...yValues);

          const margin = 50;
          const scaleX = (x: number) =>
            margin + ((x - minX) / (maxX - minX || 1)) * (width - 2 * margin);
          const scaleY = (y: number) =>
            margin + ((y - minY) / (maxY - minY || 1)) * (height - 2 * margin);

          return (
            <svg width={width} height={height}>
              {/* Links */}
              {links.map((link, index) => {
                const sourceNode = nodes.find((n) => n.id === link.source);
                const targetNode = nodes.find((n) => n.id === link.target);
                if (!sourceNode || !targetNode) return null;

                const highlighted = isLinkHighlighted(link);
                const opacity = hoveredNode ? (highlighted ? 0.8 : 0.1) : 0.4;

                return (
                  <line
                    key={`link-${index}`}
                    x1={scaleX(sourceNode.x)}
                    y1={scaleY(sourceNode.y)}
                    x2={scaleX(targetNode.x)}
                    y2={scaleY(targetNode.y)}
                    stroke="#666"
                    strokeWidth={Math.min(link.value, 4)}
                    opacity={opacity}
                    style={{ transition: 'opacity 0.2s' }}
                  />
                );
              })}

              {/* Nodes */}
              {nodes.map((node, index) => {
                const size = getNodeSize(node);
                const highlighted = isNodeHighlighted(node);
                const opacity = highlighted ? 1 : 0.3;

                return (
                  <g
                    key={`node-${index}`}
                    style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                    opacity={opacity}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <circle
                      cx={scaleX(node.x)}
                      cy={scaleY(node.y)}
                      r={size}
                      fill={colors[index % colors.length]}
                      stroke="#1a1a1a"
                      strokeWidth={2}
                    >
                      <title>
                        {node.name}: {node.value} connections
                      </title>
                    </circle>
                    {showLabels && (
                      <text
                        x={scaleX(node.x)}
                        y={scaleY(node.y) + size + 12}
                        textAnchor="middle"
                        fill="#888"
                        fontSize={10}
                      >
                        {truncateLabel(node.name, 10)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          );
        }}
      </ResponsiveContainer>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          backgroundColor: 'rgba(31, 31, 31, 0.9)',
          border: '1px solid #333',
          borderRadius: 4,
          padding: '8px 12px',
          fontSize: 11,
          color: '#888',
        }}
      >
        <div>Nodes: {nodes.length}</div>
        <div>Links: {links.length}</div>
      </div>
    </div>
  );
}
