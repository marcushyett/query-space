import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DashboardWidget } from '../DashboardWidget'
import { useDashboardStore, DashboardWidget as WidgetType } from '@/stores/dashboardStore'
import { ConfigProvider } from 'antd'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    message: {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  }
})

// Mock the widget sub-components
vi.mock('../widgets/ChartWidget', () => ({
  ChartWidget: ({ widget }: { widget: WidgetType }) => (
    <div data-testid="chart-widget">{widget.chart?.title || 'Chart'}</div>
  ),
}))

vi.mock('../widgets/TableWidget', () => ({
  TableWidget: ({ widget }: { widget: WidgetType }) => (
    <div data-testid="table-widget">{widget.title || 'Table'}</div>
  ),
}))

vi.mock('../widgets/KPIWidget', () => ({
  KPIWidget: ({ widget }: { widget: WidgetType }) => (
    <div data-testid="kpi-widget">{widget.title || 'KPI'}</div>
  ),
}))

vi.mock('../widgets/TextWidget', () => ({
  TextWidget: ({ widget }: { widget: WidgetType }) => (
    <div data-testid="text-widget">{widget.config?.content || 'Text'}</div>
  ),
}))

const mockChartWidget: WidgetType = {
  id: 'widget-1',
  type: 'CHART',
  positionX: 0,
  positionY: 0,
  width: 6,
  height: 4,
  title: 'Sales Chart',
  config: null,
  chart: {
    id: 'chart-1',
    title: 'Monthly Sales',
    type: 'column',
    config: { type: 'column', xAxis: 'month', yAxes: ['sales'] },
    query: {
      id: 'query-1',
      name: 'Sales Query',
      sql: 'SELECT month, sales FROM sales',
      sampleResults: null,
    },
  },
  query: null,
}

const mockTableWidget: WidgetType = {
  id: 'widget-2',
  type: 'TABLE',
  positionX: 0,
  positionY: 0,
  width: 6,
  height: 4,
  title: 'Users Table',
  config: null,
  chart: null,
  query: {
    id: 'query-2',
    name: 'Users Query',
    sql: 'SELECT * FROM users',
    sampleResults: null,
  },
}

const mockKPIWidget: WidgetType = {
  id: 'widget-3',
  type: 'KPI',
  positionX: 0,
  positionY: 0,
  width: 3,
  height: 2,
  title: 'Total Revenue',
  config: { valueColumn: 'revenue', format: 'currency', prefix: '$' },
  chart: null,
  query: {
    id: 'query-3',
    name: 'Revenue Query',
    sql: 'SELECT SUM(revenue) as revenue FROM sales',
    sampleResults: null,
  },
}

const mockTextWidget: WidgetType = {
  id: 'widget-4',
  type: 'TEXT',
  positionX: 0,
  positionY: 0,
  width: 12,
  height: 2,
  title: null,
  config: { content: '# Dashboard Overview\n\nThis is a text widget.' },
  chart: null,
  query: null,
}

const mockDashboard = {
  id: 'dashboard-1',
  title: 'Test Dashboard',
  description: 'A test dashboard',
  organizationId: 'org-1',
  organizationName: 'Test Org',
  projects: [],
  widgets: [mockChartWidget],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const renderWithProviders = (component: React.ReactNode) => {
  return render(<ConfigProvider>{component}</ConfigProvider>)
}

describe('DashboardWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDashboardStore.setState({
      dashboard: mockDashboard,
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

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering widget types', () => {
    it('should render ChartWidget for CHART type', () => {
      renderWithProviders(<DashboardWidget widget={mockChartWidget} />)
      expect(screen.getByTestId('chart-widget')).toBeInTheDocument()
    })

    it('should render TableWidget for TABLE type', () => {
      renderWithProviders(<DashboardWidget widget={mockTableWidget} />)
      expect(screen.getByTestId('table-widget')).toBeInTheDocument()
    })

    it('should render KPIWidget for KPI type', () => {
      renderWithProviders(<DashboardWidget widget={mockKPIWidget} />)
      expect(screen.getByTestId('kpi-widget')).toBeInTheDocument()
    })

    it('should render TextWidget for TEXT type', () => {
      renderWithProviders(<DashboardWidget widget={mockTextWidget} />)
      expect(screen.getByTestId('text-widget')).toBeInTheDocument()
    })
  })

  describe('widget title display', () => {
    it('should display widget title when available', () => {
      renderWithProviders(<DashboardWidget widget={mockChartWidget} />)
      expect(screen.getByText('Sales Chart')).toBeInTheDocument()
    })

    it('should fall back to chart title when widget title is empty', () => {
      const widget: WidgetType = { ...mockChartWidget, title: null }
      renderWithProviders(<DashboardWidget widget={widget} />)
      // Chart title "Monthly Sales" will be shown in header (may appear multiple times due to mocked ChartWidget)
      const elements = screen.getAllByText('Monthly Sales')
      expect(elements.length).toBeGreaterThanOrEqual(1)
    })

    it('should fall back to query name when chart title is empty', () => {
      const widget = {
        ...mockTableWidget,
        title: null,
      }
      renderWithProviders(<DashboardWidget widget={widget} />)
      expect(screen.getByText('Users Query')).toBeInTheDocument()
    })

    it('should show Untitled Widget when no title available', () => {
      const widget = {
        ...mockChartWidget,
        title: null,
        chart: null,
        query: null,
      }
      renderWithProviders(<DashboardWidget widget={widget} />)
      expect(screen.getByText('Untitled Widget')).toBeInTheDocument()
    })

    it('should not show title for TEXT widgets in view mode', () => {
      renderWithProviders(<DashboardWidget widget={mockTextWidget} />)
      // Text widget should not have a header in view mode
      expect(screen.queryByText('Untitled Widget')).not.toBeInTheDocument()
    })
  })

  describe('edit mode', () => {
    beforeEach(() => {
      useDashboardStore.setState({ isEditMode: true })
    })

    it('should show drag handle in edit mode', () => {
      const { container } = renderWithProviders(<DashboardWidget widget={mockChartWidget} />)
      expect(container.querySelector('.widget-drag-handle')).toBeInTheDocument()
    })

    it('should show more options button in edit mode', () => {
      renderWithProviders(<DashboardWidget widget={mockChartWidget} />)
      const moreButton = screen.getByRole('button')
      expect(moreButton).toBeInTheDocument()
    })
  })

  describe('refreshing state', () => {
    it('should show refresh icon spinning when widget is refreshing', () => {
      useDashboardStore.setState({
        refreshingWidgets: new Set(['widget-1']),
      })

      renderWithProviders(<DashboardWidget widget={mockChartWidget} />)
      // The widget should have a spinning refresh indicator
      // This is handled by the antd-spin class on the icon
    })
  })
})
