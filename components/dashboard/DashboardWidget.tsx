'use client';

import { useState, useCallback } from 'react';
import { Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import {
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  DragOutlined,
} from '@ant-design/icons';
import { useDashboardStore, DashboardWidget as WidgetType } from '@/stores/dashboardStore';
import { ChartWidget } from './widgets/ChartWidget';
import { TableWidget } from './widgets/TableWidget';
import { KPIWidget } from './widgets/KPIWidget';
import { TextWidget } from './widgets/TextWidget';

interface DashboardWidgetProps {
  widget: WidgetType;
}

export function DashboardWidget({ widget }: DashboardWidgetProps) {
  const {
    isEditMode,
    removeWidget,
    setEditingWidgetId,
    refreshingWidgets,
    setWidgetRefreshing,
    dashboard,
  } = useDashboardStore();

  const [isHovered, setIsHovered] = useState(false);
  const isRefreshing = refreshingWidgets.has(widget.id);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setWidgetRefreshing(widget.id, true);

    try {
      // Get the query SQL from either chart or query
      const sql = widget.chart?.query?.sql || widget.query?.sql;
      if (!sql) {
        message.warning('No query associated with this widget');
        return;
      }

      // Execute the query
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });

      if (!response.ok) {
        throw new Error('Query execution failed');
      }

      // Data will be updated through the widget's own fetch logic
      message.success('Widget refreshed');
    } catch (error) {
      console.error('Failed to refresh widget:', error);
      message.error('Failed to refresh widget');
    } finally {
      setWidgetRefreshing(widget.id, false);
    }
  }, [widget, isRefreshing, setWidgetRefreshing]);

  const handleDelete = useCallback(async () => {
    if (!dashboard) return;

    try {
      const response = await fetch(
        `/api/dashboards/${dashboard.id}/widgets?widgetId=${widget.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete widget');
      }

      removeWidget(widget.id);
      message.success('Widget removed');
    } catch (error) {
      console.error('Failed to delete widget:', error);
      message.error('Failed to delete widget');
    }
  }, [dashboard, widget.id, removeWidget]);

  const menuItems: MenuProps['items'] = [
    {
      key: 'refresh',
      label: 'Refresh',
      icon: <ReloadOutlined spin={isRefreshing} />,
      onClick: handleRefresh,
      disabled: widget.type === 'TEXT',
    },
    {
      key: 'edit',
      label: 'Edit',
      icon: <EditOutlined />,
      onClick: () => setEditingWidgetId(widget.id),
    },
    { type: 'divider' },
    {
      key: 'delete',
      label: 'Delete',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: handleDelete,
    },
  ];

  const getWidgetTitle = () => {
    if (widget.title) return widget.title;
    if (widget.chart?.title) return widget.chart.title;
    if (widget.query?.name) return widget.query.name;
    return widget.type === 'TEXT' ? '' : 'Untitled Widget';
  };

  const renderWidgetContent = () => {
    switch (widget.type) {
      case 'CHART':
        return <ChartWidget widget={widget} />;
      case 'TABLE':
        return <TableWidget widget={widget} />;
      case 'KPI':
        return <KPIWidget widget={widget} />;
      case 'TEXT':
        return <TextWidget widget={widget} />;
      default:
        return <div style={{ padding: 16, color: '#888' }}>Unknown widget type</div>;
    }
  };

  const title = getWidgetTitle();

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Widget Header */}
      {(title || isEditMode) && widget.type !== 'TEXT' && (
        <div
          className={isEditMode ? 'widget-drag-handle' : ''}
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid #222',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 40,
            cursor: isEditMode ? 'move' : 'default',
            background: isEditMode && isHovered ? '#1a1a1a' : 'transparent',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {isEditMode && (
              <DragOutlined style={{ color: '#666', fontSize: 12 }} />
            )}
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#ccc',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </span>
          </div>

          {(isEditMode || isHovered) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {!isEditMode && widget.type !== 'TEXT' && (
                <button
                  onClick={handleRefresh}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 4,
                    cursor: 'pointer',
                    color: '#666',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Refresh"
                >
                  <ReloadOutlined spin={isRefreshing} style={{ fontSize: 14 }} />
                </button>
              )}
              {isEditMode && (
                <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 4,
                      cursor: 'pointer',
                      color: '#666',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreOutlined style={{ fontSize: 16 }} />
                  </button>
                </Dropdown>
              )}
            </div>
          )}
        </div>
      )}

      {/* Text widget edit mode header */}
      {widget.type === 'TEXT' && isEditMode && (
        <div
          className="widget-drag-handle"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            padding: 4,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <DragOutlined style={{ color: '#666', fontSize: 12, cursor: 'move' }} />
          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <button
              style={{
                background: 'none',
                border: 'none',
                padding: 4,
                cursor: 'pointer',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreOutlined style={{ fontSize: 14 }} />
            </button>
          </Dropdown>
        </div>
      )}

      {/* Widget Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {renderWidgetContent()}
      </div>
    </div>
  );
}
