import { describe, it, expect, beforeEach } from 'vitest'
import { useDashboardStore, Dashboard, DashboardWidget } from '../dashboardStore'

const mockWidget: DashboardWidget = {
  id: 'widget-1',
  type: 'CHART',
  positionX: 0,
  positionY: 0,
  width: 6,
  height: 4,
  title: 'Test Widget',
  config: null,
  chart: {
    id: 'chart-1',
    title: 'Test Chart',
    type: 'column',
    config: { type: 'column', xAxis: 'name', yAxes: ['value'] },
    query: {
      id: 'query-1',
      name: 'Test Query',
      sql: 'SELECT name, value FROM table',
      sampleResults: null,
    },
  },
  query: null,
}

const mockDashboard: Dashboard = {
  id: 'dashboard-1',
  title: 'Test Dashboard',
  description: 'A test dashboard',
  organizationId: 'org-1',
  organizationName: 'Test Org',
  projects: [{ id: 'project-1', title: 'Test Project' }],
  widgets: [mockWidget],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

describe('dashboardStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useDashboardStore.setState({
      dashboard: null,
      isEditMode: false,
      isLoading: false,
      isSaving: false,
      pendingLayoutChanges: new Map(),
      isAddWidgetOpen: false,
      editingWidgetId: null,
      refreshingWidgets: new Set(),
      widgetData: new Map(),
    })
  })

  describe('initial state', () => {
    it('should have null dashboard initially', () => {
      const state = useDashboardStore.getState()
      expect(state.dashboard).toBeNull()
    })

    it('should not be in edit mode initially', () => {
      const state = useDashboardStore.getState()
      expect(state.isEditMode).toBe(false)
    })

    it('should not be loading initially', () => {
      const state = useDashboardStore.getState()
      expect(state.isLoading).toBe(false)
    })

    it('should have empty widget data initially', () => {
      const state = useDashboardStore.getState()
      expect(state.widgetData.size).toBe(0)
    })
  })

  describe('setDashboard', () => {
    it('should set dashboard', () => {
      useDashboardStore.getState().setDashboard(mockDashboard)

      const state = useDashboardStore.getState()
      expect(state.dashboard).toEqual(mockDashboard)
    })

    it('should clear pending layout changes when setting dashboard', () => {
      // Add some pending changes first
      useDashboardStore.setState({
        pendingLayoutChanges: new Map([['widget-1', { positionX: 5 }]]),
      })

      useDashboardStore.getState().setDashboard(mockDashboard)

      const state = useDashboardStore.getState()
      expect(state.pendingLayoutChanges.size).toBe(0)
    })

    it('should allow setting dashboard to null', () => {
      useDashboardStore.getState().setDashboard(mockDashboard)
      useDashboardStore.getState().setDashboard(null)

      const state = useDashboardStore.getState()
      expect(state.dashboard).toBeNull()
    })
  })

  describe('setEditMode', () => {
    it('should toggle edit mode on', () => {
      useDashboardStore.getState().setEditMode(true)

      const state = useDashboardStore.getState()
      expect(state.isEditMode).toBe(true)
    })

    it('should toggle edit mode off', () => {
      useDashboardStore.getState().setEditMode(true)
      useDashboardStore.getState().setEditMode(false)

      const state = useDashboardStore.getState()
      expect(state.isEditMode).toBe(false)
    })
  })

  describe('getGridLayout', () => {
    it('should return empty array when no dashboard', () => {
      const layout = useDashboardStore.getState().getGridLayout()
      expect(layout).toEqual([])
    })

    it('should return layout items for dashboard widgets', () => {
      useDashboardStore.getState().setDashboard(mockDashboard)

      const layout = useDashboardStore.getState().getGridLayout()
      expect(layout).toHaveLength(1)
      expect(layout[0]).toEqual({
        i: 'widget-1',
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        minW: 2,
        minH: 2,
        maxW: 12,
      })
    })

    it('should include pending layout changes', () => {
      useDashboardStore.getState().setDashboard(mockDashboard)
      useDashboardStore.getState().updateWidgetLayout('widget-1', { positionX: 3, width: 8 })

      const layout = useDashboardStore.getState().getGridLayout()
      expect(layout[0].x).toBe(3)
      expect(layout[0].w).toBe(8)
    })
  })

  describe('updateFromGridLayout', () => {
    it('should update widget positions from layout change', () => {
      useDashboardStore.getState().setDashboard(mockDashboard)

      useDashboardStore.getState().updateFromGridLayout([
        { i: 'widget-1', x: 3, y: 2, w: 8, h: 5 },
      ])

      const state = useDashboardStore.getState()
      const widget = state.dashboard?.widgets[0]
      expect(widget?.positionX).toBe(3)
      expect(widget?.positionY).toBe(2)
      expect(widget?.width).toBe(8)
      expect(widget?.height).toBe(5)
    })

    it('should not crash when dashboard is null', () => {
      expect(() => {
        useDashboardStore.getState().updateFromGridLayout([
          { i: 'widget-1', x: 3, y: 2, w: 8, h: 5 },
        ])
      }).not.toThrow()
    })
  })

  describe('addWidget', () => {
    it('should add widget to dashboard', () => {
      useDashboardStore.getState().setDashboard(mockDashboard)

      const newWidget: DashboardWidget = {
        ...mockWidget,
        id: 'widget-2',
        title: 'New Widget',
      }

      useDashboardStore.getState().addWidget(newWidget)

      const state = useDashboardStore.getState()
      expect(state.dashboard?.widgets).toHaveLength(2)
      expect(state.dashboard?.widgets[1].id).toBe('widget-2')
    })

    it('should not add widget when no dashboard', () => {
      const newWidget: DashboardWidget = {
        ...mockWidget,
        id: 'widget-2',
      }

      useDashboardStore.getState().addWidget(newWidget)

      const state = useDashboardStore.getState()
      expect(state.dashboard).toBeNull()
    })
  })

  describe('removeWidget', () => {
    it('should remove widget from dashboard', () => {
      useDashboardStore.getState().setDashboard(mockDashboard)
      useDashboardStore.getState().removeWidget('widget-1')

      const state = useDashboardStore.getState()
      expect(state.dashboard?.widgets).toHaveLength(0)
    })

    it('should not crash when widget does not exist', () => {
      useDashboardStore.getState().setDashboard(mockDashboard)

      expect(() => {
        useDashboardStore.getState().removeWidget('non-existent')
      }).not.toThrow()

      const state = useDashboardStore.getState()
      expect(state.dashboard?.widgets).toHaveLength(1)
    })
  })

  describe('updateWidget', () => {
    it('should update widget properties', () => {
      useDashboardStore.getState().setDashboard(mockDashboard)

      useDashboardStore.getState().updateWidget('widget-1', {
        title: 'Updated Title',
        width: 12,
      })

      const state = useDashboardStore.getState()
      const widget = state.dashboard?.widgets[0]
      expect(widget?.title).toBe('Updated Title')
      expect(widget?.width).toBe(12)
    })
  })

  describe('widget data cache', () => {
    it('should set widget data', () => {
      const data = {
        rows: [{ name: 'test', value: 100 }],
        fields: [
          { name: 'name', dataTypeID: 25 },
          { name: 'value', dataTypeID: 23 },
        ],
      }

      useDashboardStore.getState().setWidgetData('widget-1', data)

      const state = useDashboardStore.getState()
      expect(state.widgetData.get('widget-1')).toEqual(data)
    })

    it('should clear all widget data', () => {
      useDashboardStore.getState().setWidgetData('widget-1', {
        rows: [{ name: 'test' }],
        fields: [{ name: 'name', dataTypeID: 25 }],
      })

      useDashboardStore.getState().clearWidgetData()

      const state = useDashboardStore.getState()
      expect(state.widgetData.size).toBe(0)
    })
  })

  describe('widget refreshing state', () => {
    it('should track refreshing widgets', () => {
      useDashboardStore.getState().setWidgetRefreshing('widget-1', true)

      const state = useDashboardStore.getState()
      expect(state.refreshingWidgets.has('widget-1')).toBe(true)
    })

    it('should remove widget from refreshing state', () => {
      useDashboardStore.getState().setWidgetRefreshing('widget-1', true)
      useDashboardStore.getState().setWidgetRefreshing('widget-1', false)

      const state = useDashboardStore.getState()
      expect(state.refreshingWidgets.has('widget-1')).toBe(false)
    })
  })

  describe('add widget drawer', () => {
    it('should open add widget drawer', () => {
      useDashboardStore.getState().setAddWidgetOpen(true)

      const state = useDashboardStore.getState()
      expect(state.isAddWidgetOpen).toBe(true)
    })

    it('should close add widget drawer', () => {
      useDashboardStore.getState().setAddWidgetOpen(true)
      useDashboardStore.getState().setAddWidgetOpen(false)

      const state = useDashboardStore.getState()
      expect(state.isAddWidgetOpen).toBe(false)
    })
  })

  describe('loading and saving states', () => {
    it('should set loading state', () => {
      useDashboardStore.getState().setLoading(true)

      expect(useDashboardStore.getState().isLoading).toBe(true)
    })

    it('should set saving state', () => {
      useDashboardStore.getState().setSaving(true)

      expect(useDashboardStore.getState().isSaving).toBe(true)
    })
  })
})
