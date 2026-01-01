'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { useDashboardStore, GridLayoutItem } from '@/stores/dashboardStore';
import { DashboardWidget } from './DashboardWidget';
import { Empty, Spin } from 'antd';
import { AppstoreAddOutlined } from '@ant-design/icons';

import 'react-grid-layout/css/styles.css';

// Create the responsive grid layout with width provider
const ResponsiveGridLayout = WidthProvider(Responsive);

// Breakpoints for responsive layout
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };

interface DashboardGridProps {
  onSaveLayout?: () => void;
}

// Generate responsive layouts from the base layout
function generateResponsiveLayouts(baseLayout: GridLayoutItem[]) {
  const layouts: { [key: string]: GridLayoutItem[] } = {};

  // Large screens - use original layout
  layouts.lg = baseLayout;

  // Medium screens - adjust positions
  layouts.md = baseLayout.map(item => ({
    ...item,
    w: Math.min(item.w, COLS.md),
    x: Math.min(item.x, COLS.md - Math.min(item.w, COLS.md)),
  }));

  // Small screens (tablet) - stack more vertically
  layouts.sm = baseLayout.map((item, idx) => ({
    ...item,
    w: Math.min(item.w, COLS.sm),
    x: 0,
    y: idx * 4, // Stack vertically
  }));

  // Extra small (mobile) - full width
  layouts.xs = baseLayout.map((item, idx) => ({
    ...item,
    w: COLS.xs,
    x: 0,
    y: idx * 4,
  }));

  // Extra extra small - full width, minimal
  layouts.xxs = baseLayout.map((item, idx) => ({
    ...item,
    w: COLS.xxs,
    x: 0,
    y: idx * 4,
  }));

  return layouts;
}

export function DashboardGrid({ onSaveLayout }: DashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentBreakpoint, setCurrentBreakpoint] = useState('lg');
  const [isMounted, setIsMounted] = useState(false);
  const {
    dashboard,
    isEditMode,
    getGridLayout,
    updateFromGridLayout,
    setAddWidgetOpen,
  } = useDashboardStore();

  // Wait for client-side mount to avoid hydration mismatches
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const baseLayout = getGridLayout();
  const layouts = generateResponsiveLayouts(baseLayout);

  // Detect if on mobile/touch device
  const isMobile = currentBreakpoint === 'xs' || currentBreakpoint === 'xxs';

  const handleLayoutChange = useCallback(
    (_currentLayout: GridLayoutItem[], allLayouts: { [key: string]: GridLayoutItem[] }) => {
      // Only save the large layout to the database (source of truth)
      if (allLayouts.lg) {
        updateFromGridLayout(allLayouts.lg);
      }
      // Debounce save
      if (onSaveLayout) {
        onSaveLayout();
      }
    },
    [updateFromGridLayout, onSaveLayout]
  );

  const handleBreakpointChange = useCallback((newBreakpoint: string) => {
    setCurrentBreakpoint(newBreakpoint);
  }, []);

  if (!dashboard) {
    return null;
  }

  // Wait for client-side mount before rendering the grid
  if (!isMounted) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
        }}
      >
        <Spin />
      </div>
    );
  }

  if (!dashboard.widgets || dashboard.widgets.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
        }}
      >
        <Empty
          image={<AppstoreAddOutlined style={{ fontSize: 64, color: '#333' }} />}
          description={
            <div style={{ color: '#888' }}>
              <div style={{ marginBottom: 8, fontSize: 16 }}>
                No widgets yet
              </div>
              <div style={{ fontSize: 13, color: '#666' }}>
                {isEditMode
                  ? 'Click "Add Widget" to get started'
                  : 'Switch to edit mode to add widgets'}
              </div>
            </div>
          }
        >
          {isEditMode && (
            <button
              onClick={() => setAddWidgetOpen(true)}
              style={{
                background: '#1668dc',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Add Widget
            </button>
          )}
        </Empty>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'auto',
        padding: isMobile ? 8 : 16,
        background: '#0a0a0a',
      }}
    >
      <ResponsiveGridLayout
        className="dashboard-grid"
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={isMobile ? 60 : 80}
        margin={isMobile ? [8, 8] : [16, 16]}
        containerPadding={[0, 0]}
        isDraggable={isEditMode && !isMobile}
        isResizable={isEditMode && !isMobile}
        onLayoutChange={handleLayoutChange}
        onBreakpointChange={handleBreakpointChange}
        draggableHandle=".widget-drag-handle"
        useCSSTransforms={true}
        compactType="vertical"
      >
        {dashboard.widgets.map((widget) => (
          <div key={widget.id} className="dashboard-widget-container">
            <DashboardWidget widget={widget} />
          </div>
        ))}
      </ResponsiveGridLayout>

      <style jsx global>{`
        .dashboard-grid {
          min-height: 100%;
        }

        .dashboard-widget-container {
          background: #141414;
          border: 1px solid #222;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .dashboard-widget-container:hover {
          border-color: #333;
        }

        .react-grid-item.react-grid-placeholder {
          background: #1668dc;
          opacity: 0.2;
          border-radius: 8px;
        }

        .react-grid-item > .react-resizable-handle {
          background: none;
        }

        .react-grid-item > .react-resizable-handle::after {
          content: '';
          position: absolute;
          right: 6px;
          bottom: 6px;
          width: 8px;
          height: 8px;
          border-right: 2px solid #444;
          border-bottom: 2px solid #444;
        }

        .react-grid-item:hover > .react-resizable-handle::after {
          border-color: #666;
        }

        /* Mobile-specific styles */
        @media (max-width: 768px) {
          .dashboard-widget-container {
            border-radius: 6px;
          }

          .widget-drag-handle {
            display: none !important;
          }

          .react-grid-item > .react-resizable-handle {
            display: none !important;
          }
        }

        /* Touch-friendly adjustments */
        @media (pointer: coarse) {
          .dashboard-widget-container {
            -webkit-tap-highlight-color: transparent;
          }
        }
      `}</style>
    </div>
  );
}
