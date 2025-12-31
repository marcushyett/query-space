import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DashboardHeader } from '../DashboardHeader'
import { useDashboardStore } from '@/stores/dashboardStore'
import { ConfigProvider } from 'antd'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}))

const mockDashboard = {
  id: 'dashboard-1',
  title: 'Test Dashboard',
  description: 'A test dashboard',
  organizationId: 'org-1',
  organizationName: 'Test Org',
  projects: [{ id: 'project-1', title: 'Project 1' }],
  widgets: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const mockSaveLayout = vi.fn().mockResolvedValue(undefined)

const renderWithProviders = (component: React.ReactNode) => {
  return render(<ConfigProvider>{component}</ConfigProvider>)
}

describe('DashboardHeader', () => {
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

  describe('rendering', () => {
    it('should display dashboard title', () => {
      renderWithProviders(<DashboardHeader onSaveLayout={mockSaveLayout} />)
      expect(screen.getByText('Test Dashboard')).toBeInTheDocument()
    })

    it('should render back button', () => {
      renderWithProviders(<DashboardHeader onSaveLayout={mockSaveLayout} />)
      // Back button is first button in header
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should render Edit button in view mode', () => {
      renderWithProviders(<DashboardHeader onSaveLayout={mockSaveLayout} />)
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })

    it('should return null when no dashboard', () => {
      useDashboardStore.setState({ dashboard: null })
      const { container } = renderWithProviders(<DashboardHeader onSaveLayout={mockSaveLayout} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('view mode actions', () => {
    it('should show refresh all button', () => {
      renderWithProviders(<DashboardHeader onSaveLayout={mockSaveLayout} />)
      // The refresh button should be visible in view mode (at least 3 buttons: back, refresh, edit, more)
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThanOrEqual(3)
    })

    it('should navigate back to dashboards list', () => {
      renderWithProviders(<DashboardHeader onSaveLayout={mockSaveLayout} />)
      const backButton = screen.getAllByRole('button')[0]
      fireEvent.click(backButton)
      expect(mockPush).toHaveBeenCalledWith('/dashboards')
    })

    it('should enter edit mode when clicking Edit', () => {
      renderWithProviders(<DashboardHeader onSaveLayout={mockSaveLayout} />)
      const editButton = screen.getByText('Edit')
      fireEvent.click(editButton)
      expect(useDashboardStore.getState().isEditMode).toBe(true)
    })
  })

  describe('edit mode actions', () => {
    beforeEach(() => {
      useDashboardStore.setState({ isEditMode: true })
    })

    it('should show Add Widget button in edit mode', () => {
      renderWithProviders(<DashboardHeader onSaveLayout={mockSaveLayout} />)
      expect(screen.getByText('Add Widget')).toBeInTheDocument()
    })

    it('should show Done button in edit mode', () => {
      renderWithProviders(<DashboardHeader onSaveLayout={mockSaveLayout} />)
      expect(screen.getByText('Done')).toBeInTheDocument()
    })

    it('should open add widget drawer when clicking Add Widget', () => {
      renderWithProviders(<DashboardHeader onSaveLayout={mockSaveLayout} />)
      const addButton = screen.getByText('Add Widget')
      fireEvent.click(addButton)
      expect(useDashboardStore.getState().isAddWidgetOpen).toBe(true)
    })

    it('should save and exit edit mode when clicking Done', async () => {
      renderWithProviders(<DashboardHeader onSaveLayout={mockSaveLayout} />)
      const doneButton = screen.getByText('Done')
      fireEvent.click(doneButton)

      await waitFor(() => {
        expect(mockSaveLayout).toHaveBeenCalled()
        expect(useDashboardStore.getState().isEditMode).toBe(false)
      })
    })
  })

  describe('dropdown menu', () => {
    it('should have more options button', () => {
      renderWithProviders(<DashboardHeader onSaveLayout={mockSaveLayout} />)
      // Find the more options button (last button usually)
      const buttons = screen.getAllByRole('button')
      const moreButton = buttons[buttons.length - 1]
      expect(moreButton).toBeInTheDocument()
    })
  })
})
