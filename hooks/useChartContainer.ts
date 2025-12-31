'use client';

import { useRef, RefObject } from 'react';
import { useDimensions } from './useDimensions';

interface ChartContainerState {
  containerRef: RefObject<HTMLDivElement | null>;
  width: number;
  height: number;
  isReady: boolean;
}

/**
 * Shared hook for chart containers
 * Provides responsive dimensions and loading state management
 */
export function useChartContainer(): ChartContainerState {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useDimensions(containerRef);

  return {
    containerRef,
    width,
    height,
    isReady: width > 0 && height > 0,
  };
}

/**
 * Common container styles for SVG charts
 */
export const chartContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
};

/**
 * Style for loading/empty container state
 */
export const chartLoadingStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

/**
 * Style for empty data message
 */
export const chartEmptyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: '#888',
};

/**
 * Common tooltip style
 */
export const chartTooltipStyle: React.CSSProperties = {
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
};

/**
 * Fixed tooltip style (follows mouse)
 */
export const chartFixedTooltipStyle: React.CSSProperties = {
  position: 'fixed',
  backgroundColor: '#1f1f1f',
  border: '1px solid #333',
  borderRadius: 4,
  padding: '8px 12px',
  color: '#fff',
  fontSize: 12,
  pointerEvents: 'none',
  zIndex: 1000,
  maxWidth: 200,
};

/**
 * Legend container style
 */
export const chartLegendStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 10,
  left: 10,
  backgroundColor: 'rgba(31, 31, 31, 0.9)',
  border: '1px solid #333',
  borderRadius: 4,
  padding: '8px 12px',
  fontSize: 11,
  color: '#888',
};
