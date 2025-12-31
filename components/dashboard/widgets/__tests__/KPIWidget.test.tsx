import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { KPIWidget } from '../KPIWidget'
import { useDashboardStore, DashboardWidget } from '@/stores/dashboardStore'
import { ConfigProvider } from 'antd'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

const mockKPIWidget: DashboardWidget = {
  id: 'kpi-1',
  type: 'KPI',
  positionX: 0,
  positionY: 0,
  width: 3,
  height: 2,
  title: 'Total Revenue',
  config: { valueColumn: 'revenue', format: 'currency', prefix: '$' },
  chart: null,
  query: {
    id: 'query-1',
    name: 'Revenue Query',
    sql: 'SELECT SUM(revenue) as revenue FROM sales',
    sampleResults: null,
  },
}

const renderWithProviders = (component: React.ReactNode) => {
  return render(<ConfigProvider>{component}</ConfigProvider>)
}

describe('KPIWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loading state', () => {
    it('should display spinner during loading', () => {
      // Widget with no cached data will trigger loading
      const { container } = renderWithProviders(<KPIWidget widget={mockKPIWidget} />)
      // Ant Design Spin component adds the ant-spin class
      expect(container.querySelector('.ant-spin') || container.querySelector('[class*="spin"]')).toBeTruthy()
    })
  })

  describe('with cached data', () => {
    it('should display formatted currency value', () => {
      useDashboardStore.setState({
        widgetData: new Map([
          ['kpi-1', {
            rows: [{ revenue: 1234567 }],
            fields: [{ name: 'revenue', dataTypeID: 23 }],
          }],
        ]),
      })

      renderWithProviders(<KPIWidget widget={mockKPIWidget} />)
      expect(screen.getByText('$1,234,567')).toBeInTheDocument()
    })

    it('should format large numbers with K suffix', () => {
      const widget: DashboardWidget = {
        ...mockKPIWidget,
        id: 'kpi-k',
        config: { valueColumn: 'count', format: 'number' },
      }

      useDashboardStore.setState({
        widgetData: new Map([
          ['kpi-k', {
            rows: [{ count: 5000 }],
            fields: [{ name: 'count', dataTypeID: 23 }],
          }],
        ]),
      })

      renderWithProviders(<KPIWidget widget={widget} />)
      // Formatted as "5.0K" due to toFixed(1)
      expect(screen.getByText('5.0K')).toBeInTheDocument()
    })

    it('should format millions with M suffix', () => {
      const widget: DashboardWidget = {
        ...mockKPIWidget,
        config: { valueColumn: 'count', format: 'number' },
      }

      useDashboardStore.setState({
        widgetData: new Map([
          ['kpi-1', {
            rows: [{ count: 2500000 }],
            fields: [{ name: 'count', dataTypeID: 23 }],
          }],
        ]),
      })

      renderWithProviders(<KPIWidget widget={widget} />)
      expect(screen.getByText('2.5M')).toBeInTheDocument()
    })

    it('should format percentages correctly', () => {
      const widget: DashboardWidget = {
        ...mockKPIWidget,
        config: { valueColumn: 'rate', format: 'percentage' },
      }

      useDashboardStore.setState({
        widgetData: new Map([
          ['kpi-1', {
            rows: [{ rate: 0.756 }],
            fields: [{ name: 'rate', dataTypeID: 23 }],
          }],
        ]),
      })

      renderWithProviders(<KPIWidget widget={widget} />)
      expect(screen.getByText('75.6%')).toBeInTheDocument()
    })

    it('should show prefix and suffix', () => {
      const widget: DashboardWidget = {
        ...mockKPIWidget,
        config: { valueColumn: 'count', prefix: '~', suffix: ' users' },
      }

      useDashboardStore.setState({
        widgetData: new Map([
          ['kpi-1', {
            rows: [{ count: 42 }],
            fields: [{ name: 'count', dataTypeID: 23 }],
          }],
        ]),
      })

      renderWithProviders(<KPIWidget widget={widget} />)
      expect(screen.getByText('~42 users')).toBeInTheDocument()
    })
  })

  describe('trend indicator', () => {
    it('should show upward trend with positive value', () => {
      const widget: DashboardWidget = {
        ...mockKPIWidget,
        config: { valueColumn: 'revenue', showTrend: true, trendColumn: 'change' },
      }

      useDashboardStore.setState({
        widgetData: new Map([
          ['kpi-1', {
            rows: [{ revenue: 1000, change: 15.5 }],
            fields: [
              { name: 'revenue', dataTypeID: 23 },
              { name: 'change', dataTypeID: 23 },
            ],
          }],
        ]),
      })

      renderWithProviders(<KPIWidget widget={widget} />)
      expect(screen.getByText('+15.5%')).toBeInTheDocument()
    })

    it('should show downward trend with negative value', () => {
      const widget: DashboardWidget = {
        ...mockKPIWidget,
        config: { valueColumn: 'revenue', showTrend: true, trendColumn: 'change' },
      }

      useDashboardStore.setState({
        widgetData: new Map([
          ['kpi-1', {
            rows: [{ revenue: 1000, change: -5.2 }],
            fields: [
              { name: 'revenue', dataTypeID: 23 },
              { name: 'change', dataTypeID: 23 },
            ],
          }],
        ]),
      })

      renderWithProviders(<KPIWidget widget={widget} />)
      expect(screen.getByText('-5.2%')).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('should display error message when query fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Query failed' }),
      })

      renderWithProviders(<KPIWidget widget={mockKPIWidget} />)

      await waitFor(() => {
        expect(screen.getByText('Query execution failed')).toBeInTheDocument()
      })
    })
  })

  describe('empty state', () => {
    it('should show no data message when query returns no rows', () => {
      const widget = { ...mockKPIWidget, id: 'kpi-empty' }
      useDashboardStore.setState({
        widgetData: new Map([
          ['kpi-empty', {
            rows: [],
            fields: [{ name: 'revenue', dataTypeID: 23 }],
          }],
        ]),
      })

      renderWithProviders(<KPIWidget widget={widget} />)
      // Ant Design Empty component may have multiple text nodes
      const elements = screen.getAllByText('No data')
      expect(elements.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('threshold colors', () => {
    it('should show warning color when value exceeds warning threshold', () => {
      const widget: DashboardWidget = {
        ...mockKPIWidget,
        config: {
          valueColumn: 'errors',
          thresholds: { warning: 50, critical: 100 },
        },
      }

      useDashboardStore.setState({
        widgetData: new Map([
          ['kpi-1', {
            rows: [{ errors: 75 }],
            fields: [{ name: 'errors', dataTypeID: 23 }],
          }],
        ]),
      })

      const { container } = renderWithProviders(<KPIWidget widget={widget} />)
      const valueElement = container.querySelector('div[style*="font-weight: 700"]')
      expect(valueElement).toHaveStyle({ color: '#faad14' })
    })

    it('should show critical color when value exceeds critical threshold', () => {
      const widget: DashboardWidget = {
        ...mockKPIWidget,
        config: {
          valueColumn: 'errors',
          thresholds: { warning: 50, critical: 100 },
        },
      }

      useDashboardStore.setState({
        widgetData: new Map([
          ['kpi-1', {
            rows: [{ errors: 150 }],
            fields: [{ name: 'errors', dataTypeID: 23 }],
          }],
        ]),
      })

      const { container } = renderWithProviders(<KPIWidget widget={widget} />)
      const valueElement = container.querySelector('div[style*="font-weight: 700"]')
      expect(valueElement).toHaveStyle({ color: '#ff4d4f' })
    })

    it('should show success color when value is below warning threshold', () => {
      const widget: DashboardWidget = {
        ...mockKPIWidget,
        config: {
          valueColumn: 'errors',
          thresholds: { warning: 50, critical: 100 },
        },
      }

      useDashboardStore.setState({
        widgetData: new Map([
          ['kpi-1', {
            rows: [{ errors: 25 }],
            fields: [{ name: 'errors', dataTypeID: 23 }],
          }],
        ]),
      })

      const { container } = renderWithProviders(<KPIWidget widget={widget} />)
      const valueElement = container.querySelector('div[style*="font-weight: 700"]')
      expect(valueElement).toHaveStyle({ color: '#52c41a' })
    })
  })
})
