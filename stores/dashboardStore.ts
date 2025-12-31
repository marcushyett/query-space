import { create } from 'zustand';
import type { Layout } from 'react-grid-layout';

export type WidgetType = 'CHART' | 'TABLE' | 'KPI' | 'TEXT';

export interface WidgetConfig {
  // Text widget config
  content?: string;
  // KPI widget config
  valueColumn?: string;
  format?: 'number' | 'currency' | 'percentage';
  prefix?: string;
  suffix?: string;
  showTrend?: boolean;
  trendColumn?: string;
  thresholds?: { warning: number; critical: number };
  // Refresh settings
  refreshInterval?: number; // in seconds
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  title: string | null;
  config: WidgetConfig | null;
  chart: {
    id: string;
    title: string | null;
    type: string;
    config: Record<string, unknown>;
    query: {
      id: string;
      name: string | null;
      sql: string;
      sampleResults: Record<string, unknown>[] | null;
    };
  } | null;
  query: {
    id: string;
    name: string | null;
    sql: string;
    sampleResults: Record<string, unknown>[] | null;
  } | null;
}

export interface Dashboard {
  id: string;
  title: string;
  description: string | null;
  organizationId: string;
  organizationName: string | null;
  projects: { id: string; title: string }[];
  widgets: DashboardWidget[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardListItem {
  id: string;
  title: string;
  description: string | null;
  organizationId: string;
  organizationName: string | null;
  widgetCount: number;
  projects: { id: string; title: string }[];
  createdAt: string;
  updatedAt: string;
}

interface DashboardStore {
  // Current dashboard being viewed/edited
  dashboard: Dashboard | null;
  setDashboard: (dashboard: Dashboard | null) => void;

  // Edit mode toggle
  isEditMode: boolean;
  setEditMode: (mode: boolean) => void;

  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  isSaving: boolean;
  setSaving: (saving: boolean) => void;

  // Widget layout updates (optimistic)
  pendingLayoutChanges: Map<string, Partial<DashboardWidget>>;
  updateWidgetLayout: (widgetId: string, layout: Partial<DashboardWidget>) => void;
  clearPendingLayoutChanges: () => void;

  // Add widget drawer
  isAddWidgetOpen: boolean;
  setAddWidgetOpen: (open: boolean) => void;

  // Widget being edited
  editingWidgetId: string | null;
  setEditingWidgetId: (id: string | null) => void;

  // Convert dashboard widgets to react-grid-layout format
  getGridLayout: () => Layout[];

  // Update widget positions from layout change
  updateFromGridLayout: (layout: Layout[]) => void;

  // Add a widget to the current dashboard
  addWidget: (widget: DashboardWidget) => void;

  // Remove a widget
  removeWidget: (widgetId: string) => void;

  // Update a widget
  updateWidget: (widgetId: string, updates: Partial<DashboardWidget>) => void;

  // Refresh widget data
  refreshingWidgets: Set<string>;
  setWidgetRefreshing: (widgetId: string, refreshing: boolean) => void;

  // Widget data cache (for executed queries)
  widgetData: Map<string, { rows: Record<string, unknown>[]; fields: { name: string; dataTypeID: number }[] }>;
  setWidgetData: (widgetId: string, data: { rows: Record<string, unknown>[]; fields: { name: string; dataTypeID: number }[] }) => void;
  clearWidgetData: () => void;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  dashboard: null,
  isEditMode: false,
  isLoading: false,
  isSaving: false,
  pendingLayoutChanges: new Map(),
  isAddWidgetOpen: false,
  editingWidgetId: null,
  refreshingWidgets: new Set(),
  widgetData: new Map(),

  setDashboard: (dashboard) => {
    set({ dashboard, pendingLayoutChanges: new Map() });
  },

  setEditMode: (mode) => {
    set({ isEditMode: mode });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setSaving: (saving) => {
    set({ isSaving: saving });
  },

  updateWidgetLayout: (widgetId, layout) => {
    set((state) => {
      const newChanges = new Map(state.pendingLayoutChanges);
      const existing = newChanges.get(widgetId) || {};
      newChanges.set(widgetId, { ...existing, ...layout });
      return { pendingLayoutChanges: newChanges };
    });
  },

  clearPendingLayoutChanges: () => {
    set({ pendingLayoutChanges: new Map() });
  },

  setAddWidgetOpen: (open) => {
    set({ isAddWidgetOpen: open });
  },

  setEditingWidgetId: (id) => {
    set({ editingWidgetId: id });
  },

  getGridLayout: () => {
    const { dashboard, pendingLayoutChanges } = get();
    if (!dashboard) return [];

    return dashboard.widgets.map((widget) => {
      const pending = pendingLayoutChanges.get(widget.id);
      return {
        i: widget.id,
        x: pending?.positionX ?? widget.positionX,
        y: pending?.positionY ?? widget.positionY,
        w: pending?.width ?? widget.width,
        h: pending?.height ?? widget.height,
        minW: 2,
        minH: 2,
        maxW: 12,
      };
    });
  },

  updateFromGridLayout: (layout) => {
    const { dashboard } = get();
    if (!dashboard) return;

    set((state) => {
      const newWidgets = state.dashboard!.widgets.map((widget) => {
        const layoutItem = layout.find((l) => l.i === widget.id);
        if (layoutItem) {
          return {
            ...widget,
            positionX: layoutItem.x,
            positionY: layoutItem.y,
            width: layoutItem.w,
            height: layoutItem.h,
          };
        }
        return widget;
      });

      return {
        dashboard: { ...state.dashboard!, widgets: newWidgets },
      };
    });
  },

  addWidget: (widget) => {
    set((state) => {
      if (!state.dashboard) return state;
      return {
        dashboard: {
          ...state.dashboard,
          widgets: [...state.dashboard.widgets, widget],
        },
      };
    });
  },

  removeWidget: (widgetId) => {
    set((state) => {
      if (!state.dashboard) return state;
      return {
        dashboard: {
          ...state.dashboard,
          widgets: state.dashboard.widgets.filter((w) => w.id !== widgetId),
        },
      };
    });
  },

  updateWidget: (widgetId, updates) => {
    set((state) => {
      if (!state.dashboard) return state;
      return {
        dashboard: {
          ...state.dashboard,
          widgets: state.dashboard.widgets.map((w) =>
            w.id === widgetId ? { ...w, ...updates } : w
          ),
        },
      };
    });
  },

  setWidgetRefreshing: (widgetId, refreshing) => {
    set((state) => {
      const newSet = new Set(state.refreshingWidgets);
      if (refreshing) {
        newSet.add(widgetId);
      } else {
        newSet.delete(widgetId);
      }
      return { refreshingWidgets: newSet };
    });
  },

  setWidgetData: (widgetId, data) => {
    set((state) => {
      const newMap = new Map(state.widgetData);
      newMap.set(widgetId, data);
      return { widgetData: newMap };
    });
  },

  clearWidgetData: () => {
    set({ widgetData: new Map() });
  },
}));
