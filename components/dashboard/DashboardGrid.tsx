'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import GridLayout from 'react-grid-layout';
import { useDashboardStore, GridLayoutItem } from '@/stores/dashboardStore';
import { DashboardWidget } from './DashboardWidget';
import { Empty } from 'antd';
import { AppstoreAddOutlined } from '@ant-design/icons';

import 'react-grid-layout/css/styles.css';

interface DashboardGridProps {
  onSaveLayout?: () => void;
}

export function DashboardGrid({ onSaveLayout }: DashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(1200);
  const {
    dashboard,
    isEditMode,
    getGridLayout,
    updateFromGridLayout,
    setAddWidgetOpen,
  } = useDashboardStore();

  // Measure container width on mount and resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setGridWidth(containerRef.current.offsetWidth);
      }
    };

    // Initial measurement
    updateWidth();

    // Update on resize
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const layout = getGridLayout();

  const handleLayoutChange = useCallback(
    (newLayout: GridLayoutItem[]) => {
      updateFromGridLayout(newLayout);
      // Debounce save
      if (onSaveLayout) {
        onSaveLayout();
      }
    },
    [updateFromGridLayout, onSaveLayout]
  );

  if (!dashboard) {
    return null;
  }

  if (dashboard.widgets.length === 0) {
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
        padding: 16,
        background: '#0a0a0a',
      }}
    >
      {React.createElement(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        GridLayout as any,
        {
          className: 'dashboard-grid',
          layout: layout,
          cols: 12,
          rowHeight: 80,
          width: gridWidth,
          margin: [16, 16],
          containerPadding: [0, 0],
          isDraggable: isEditMode,
          isResizable: isEditMode,
          onLayoutChange: handleLayoutChange,
          draggableHandle: '.widget-drag-handle',
          useCSSTransforms: true,
          compactType: 'vertical',
        },
        dashboard.widgets.map((widget) => (
          <div key={widget.id} className="dashboard-widget-container">
            <DashboardWidget widget={widget} />
          </div>
        ))
      )}

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
      `}</style>
    </div>
  );
}
