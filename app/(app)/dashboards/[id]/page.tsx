'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { message } from 'antd';
import { TechSpinner } from '@/components/TechSpinner';
import {
  DashboardGrid,
  DashboardHeader,
  AddWidgetDrawer,
} from '@/components/dashboard';
import { useDashboardStore, Dashboard } from '@/stores/dashboardStore';

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const dashboardId = params.id as string;

  const {
    dashboard,
    setDashboard,
    isLoading,
    setLoading,
    setEditMode,
    clearWidgetData,
  } = useDashboardStore();

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);

      try {
        const response = await fetch(`/api/dashboards/${dashboardId}`);

        if (!response.ok) {
          if (response.status === 404) {
            message.error('Dashboard not found');
            router.push('/dashboards');
            return;
          }
          throw new Error('Failed to fetch dashboard');
        }

        const data = await response.json();
        setDashboard(data.dashboard as Dashboard);
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
        message.error('Failed to load dashboard');
        router.push('/dashboards');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();

    // Cleanup on unmount
    return () => {
      setDashboard(null);
      setEditMode(false);
      clearWidgetData();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [dashboardId, router, setDashboard, setLoading, setEditMode, clearWidgetData]);

  // Save layout changes (debounced)
  const handleSaveLayout = useCallback(async () => {
    if (!dashboard) return;

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 500ms
    return new Promise<void>((resolve) => {
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          // Update each widget's position
          const updatePromises = dashboard.widgets.map((widget) =>
            fetch(`/api/dashboards/${dashboard.id}/widgets?widgetId=${widget.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                positionX: widget.positionX,
                positionY: widget.positionY,
                width: widget.width,
                height: widget.height,
              }),
            })
          );

          await Promise.all(updatePromises);
          resolve();
        } catch (error) {
          console.error('Failed to save layout:', error);
          message.error('Failed to save layout');
          resolve();
        }
      }, 500);
    });
  }, [dashboard]);

  // Direct save for header actions using batch API
  const handleDirectSave = useCallback(async () => {
    if (!dashboard || dashboard.widgets.length === 0) return;

    try {
      const response = await fetch(`/api/dashboards/${dashboard.id}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layouts: dashboard.widgets.map((widget) => ({
            widgetId: widget.id,
            positionX: widget.positionX,
            positionY: widget.positionY,
            width: widget.width,
            height: widget.height,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save layout');
      }
    } catch (error) {
      console.error('Failed to save layout:', error);
      throw error;
    }
  }, [dashboard]);

  if (isLoading || !dashboard) {
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
        <TechSpinner size="large" />
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#0a0a0a',
      }}
    >
      <DashboardHeader onSaveLayout={handleDirectSave} />
      <DashboardGrid onSaveLayout={handleSaveLayout} />
      <AddWidgetDrawer />
    </div>
  );
}
