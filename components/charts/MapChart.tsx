'use client';

import { useMemo, useState, useRef } from 'react';
import { useDimensions } from '@/hooks/useDimensions';
import { getChartColors, formatNumber } from '@/lib/chart-utils';

interface MapChartProps {
  data: Record<string, unknown>[];
  regionColumn: string;
  valueColumn: string;
  mapType?: 'world' | 'usa' | 'europe' | 'asia';
  displayMode?: 'choropleth' | 'bubble' | 'both';
  showLabels?: boolean;
  colorScale?: 'sequential' | 'diverging';
  latColumn?: string;
  lonColumn?: string;
}

// Simplified world map paths (major regions only)
const WORLD_REGIONS: Record<string, { path: string; center: [number, number] }> = {
  'North America': {
    path: 'M 50 80 L 150 60 L 180 100 L 160 150 L 100 160 L 40 130 Z',
    center: [100, 110],
  },
  'South America': {
    path: 'M 100 180 L 130 170 L 150 220 L 140 280 L 100 300 L 80 250 L 90 200 Z',
    center: [110, 230],
  },
  'Europe': {
    path: 'M 260 70 L 320 60 L 350 90 L 340 120 L 280 130 L 250 100 Z',
    center: [300, 95],
  },
  'Africa': {
    path: 'M 260 140 L 320 130 L 350 180 L 340 260 L 280 280 L 250 230 L 240 180 Z',
    center: [290, 200],
  },
  'Asia': {
    path: 'M 360 60 L 500 40 L 540 100 L 520 160 L 420 170 L 350 130 L 340 90 Z',
    center: [440, 100],
  },
  'Oceania': {
    path: 'M 480 200 L 540 190 L 560 230 L 530 260 L 490 250 L 470 220 Z',
    center: [510, 225],
  },
};

// US state abbreviations to simple positions
const US_STATES: Record<string, [number, number]> = {
  WA: [80, 60], OR: [70, 90], CA: [60, 160], NV: [90, 140], ID: [110, 90],
  MT: [150, 60], WY: [160, 100], UT: [120, 140], AZ: [110, 190], CO: [170, 150],
  NM: [150, 200], ND: [220, 60], SD: [220, 90], NE: [220, 120], KS: [230, 160],
  OK: [230, 200], TX: [220, 250], MN: [280, 70], IA: [280, 110], MO: [290, 150],
  AR: [290, 200], LA: [300, 250], WI: [320, 80], IL: [320, 130], MS: [320, 210],
  MI: [360, 90], IN: [350, 130], AL: [350, 210], OH: [380, 120], KY: [370, 160],
  TN: [360, 180], GA: [380, 210], FL: [400, 270], WV: [400, 140], VA: [420, 160],
  NC: [430, 180], SC: [420, 200], PA: [420, 110], NY: [440, 90], NJ: [450, 120],
  MD: [440, 140], DE: [455, 135], CT: [465, 105], MA: [475, 95], RI: [480, 100],
  VT: [460, 75], NH: [470, 70], ME: [490, 55], AK: [80, 280], HI: [130, 300],
};

/**
 * Map Chart Component
 *
 * Displays geographic data on a simplified map visualization.
 * Best for: Regional comparisons, geographic distribution, location-based data
 */
export function MapChart({
  data,
  regionColumn,
  valueColumn,
  mapType = 'world',
  displayMode = 'choropleth',
  showLabels = true,
  colorScale = 'sequential',
  latColumn: _latColumn,
  lonColumn: _lonColumn,
}: MapChartProps) {
  // Future: latColumn and lonColumn will be used for point-based maps
  void _latColumn;
  void _lonColumn;
  const colors = getChartColors();
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useDimensions(containerRef);

  // Process data
  const processedData = useMemo(() => {
    const regionValues = new Map<string, number>();

    data.forEach((row) => {
      const region = String(row[regionColumn] ?? '').trim();
      const value = typeof row[valueColumn] === 'number'
        ? row[valueColumn]
        : parseFloat(String(row[valueColumn])) || 0;

      if (region) {
        regionValues.set(region, (regionValues.get(region) || 0) + value);
      }
    });

    return regionValues;
  }, [data, regionColumn, valueColumn]);

  // Calculate value range for color scaling
  const { minValue, maxValue } = useMemo(() => {
    const values = Array.from(processedData.values());
    return {
      minValue: Math.min(...values, 0),
      maxValue: Math.max(...values, 1),
    };
  }, [processedData]);

  // Get color for a value
  const getColor = (value: number) => {
    const ratio = (value - minValue) / (maxValue - minValue || 1);

    if (colorScale === 'diverging') {
      // Red to White to Blue
      const midpoint = (minValue + maxValue) / 2;
      if (value < midpoint) {
        const t = (value - minValue) / (midpoint - minValue || 1);
        return `rgb(${Math.round(220 - 100 * t)}, ${Math.round(50 + 150 * t)}, ${Math.round(50 + 150 * t)})`;
      } else {
        const t = (value - midpoint) / (maxValue - midpoint || 1);
        return `rgb(${Math.round(120 - 96 * t)}, ${Math.round(200 - 56 * t)}, ${Math.round(200 + 55 * t)})`;
      }
    } else {
      // Sequential: light to dark blue
      const r = Math.round(200 - 176 * ratio);
      const g = Math.round(220 - 76 * ratio);
      const b = Math.round(255);
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  // Match region names (fuzzy matching)
  const matchRegion = (inputRegion: string, availableRegions: string[]): string | null => {
    const normalized = inputRegion.toLowerCase().trim();
    for (const region of availableRegions) {
      if (region.toLowerCase().includes(normalized) || normalized.includes(region.toLowerCase())) {
        return region;
      }
    }
    return null;
  };

  if (!width || !height) {
    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
  }

  const mapWidth = mapType === 'usa' ? 550 : 600;
  const mapHeight = mapType === 'usa' ? 350 : 320;
  const scale = Math.min(width / mapWidth, height / mapHeight) * 0.85;
  const offsetX = (width - mapWidth * scale) / 2;
  const offsetY = (height - mapHeight * scale) / 2;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width={width} height={height}>
              <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>
                {mapType === 'usa' ? (
                  // US States as circles
                  Object.entries(US_STATES).map(([state, [x, y]]) => {
                    const value = processedData.get(state) || 0;
                    const hasValue = processedData.has(state);
                    const isHovered = hoveredRegion === state;
                    const bubbleSize = displayMode !== 'choropleth'
                      ? 8 + (value / maxValue) * 20
                      : 15;

                    return (
                      <g key={state}>
                        <circle
                          cx={x}
                          cy={y}
                          r={bubbleSize}
                          fill={hasValue ? getColor(value) : '#333'}
                          stroke={isHovered ? '#fff' : '#1a1a1a'}
                          strokeWidth={isHovered ? 2 : 1}
                          opacity={hoveredRegion && !isHovered ? 0.5 : 1}
                          style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                          onMouseEnter={() => setHoveredRegion(state)}
                          onMouseLeave={() => setHoveredRegion(null)}
                        >
                          <title>{state}: {formatNumber(value)}</title>
                        </circle>
                        {showLabels && bubbleSize >= 12 && (
                          <text
                            x={x}
                            y={y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#fff"
                            fontSize={8}
                            style={{ pointerEvents: 'none' }}
                          >
                            {state}
                          </text>
                        )}
                      </g>
                    );
                  })
                ) : (
                  // World regions as paths
                  Object.entries(WORLD_REGIONS).map(([region, { path, center }]) => {
                    const matchedKey = matchRegion(region, Array.from(processedData.keys())) ||
                      Array.from(processedData.keys()).find((k) => matchRegion(k, [region]));
                    const value = matchedKey ? processedData.get(matchedKey) || 0 : 0;
                    const hasValue = matchedKey !== undefined;
                    const isHovered = hoveredRegion === region;

                    return (
                      <g key={region}>
                        <path
                          d={path}
                          fill={hasValue ? getColor(value) : '#333'}
                          stroke={isHovered ? '#fff' : '#1a1a1a'}
                          strokeWidth={isHovered ? 2 : 1}
                          opacity={hoveredRegion && !isHovered ? 0.5 : 1}
                          style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                          onMouseEnter={() => setHoveredRegion(region)}
                          onMouseLeave={() => setHoveredRegion(null)}
                        >
                          <title>{region}: {formatNumber(value)}</title>
                        </path>

                        {/* Bubble overlay for bubble mode */}
                        {displayMode !== 'choropleth' && hasValue && value > 0 && (
                          <circle
                            cx={center[0]}
                            cy={center[1]}
                            r={8 + (value / maxValue) * 25}
                            fill={colors[0]}
                            fillOpacity={0.6}
                            stroke={colors[0]}
                            strokeWidth={2}
                            style={{ pointerEvents: 'none' }}
                          />
                        )}

                        {showLabels && (
                          <text
                            x={center[0]}
                            y={center[1]}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#fff"
                            fontSize={10}
                            style={{ pointerEvents: 'none' }}
                          >
                            {region}
                          </text>
                        )}
                      </g>
                    );
                  })
                )}
              </g>

              {/* Legend */}
              <defs>
                <linearGradient id="mapColorScale" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor={getColor(minValue)} />
                  <stop offset="100%" stopColor={getColor(maxValue)} />
                </linearGradient>
              </defs>
              <rect
                x={width - 50}
                y={20}
                width={20}
                height={100}
                fill="url(#mapColorScale)"
                rx={4}
              />
              <text x={width - 55} y={25} fill="#888" fontSize={10} textAnchor="end">
                {formatNumber(maxValue)}
              </text>
              <text x={width - 55} y={120} fill="#888" fontSize={10} textAnchor="end">
                {formatNumber(minValue)}
              </text>
      </svg>

      {/* Tooltip */}
      {hoveredRegion && (
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
          <div style={{ fontWeight: 500 }}>{hoveredRegion}</div>
          <div style={{ color: '#888' }}>
            Value: {formatNumber(processedData.get(hoveredRegion) || 0)}
          </div>
        </div>
      )}
    </div>
  );
}
