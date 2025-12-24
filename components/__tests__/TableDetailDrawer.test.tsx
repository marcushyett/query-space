import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TableDetailDrawer } from '../TableDetailDrawer'
import { useConnectionStore } from '@/stores/connectionStore'
import { useUiStore } from '@/stores/uiStore'
import { useQueryStore } from '@/stores/queryStore'
import { ConfigProvider } from 'antd'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
})

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    message: {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
  }
})

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <ConfigProvider>{component}</ConfigProvider>
  )
}

describe('TableDetailDrawer', () => {
  const mockTableInfoResponse = {
    schema: 'public',
    name: 'users',
    columns: [
      { name: 'id', type: 'integer', nullable: false, defaultValue: null, isPrimaryKey: true, isForeignKey: false, references: null },
      { name: 'name', type: 'varchar', nullable: true, defaultValue: null, isPrimaryKey: false, isForeignKey: false, references: null },
      { name: 'email', type: 'varchar', nullable: false, defaultValue: null, isPrimaryKey: false, isForeignKey: false, references: null },
    ],
    indexes: [
      { name: 'users_pkey', columns: ['id'], isUnique: true, isPrimary: true },
    ],
    sampleData: [
      { id: 1, name: 'John', email: 'john@test.com' },
    ],
    rowCount: 100,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb' })
    useUiStore.setState({
      tableDetailDrawerOpen: false,
      selectedTable: null,
    })
    useQueryStore.setState({
      currentQuery: '',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when closed', () => {
    it('should not be visible when tableDetailDrawerOpen is false', () => {
      renderWithProviders(<TableDetailDrawer />)
      // Drawer should not show column tabs when closed
      expect(screen.queryByRole('tab', { name: /Columns/i })).not.toBeInTheDocument()
    })
  })

  describe('when open', () => {
    beforeEach(() => {
      useUiStore.setState({
        tableDetailDrawerOpen: true,
        selectedTable: 'public.users',
      })
    })

    it('should fetch table info when opened', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTableInfoResponse,
      })

      renderWithProviders(<TableDetailDrawer />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/table-info', expect.any(Object))
      })
    })

    it('should show loading state while fetching', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      renderWithProviders(<TableDetailDrawer />)

      expect(screen.getByText(/Loading table information/i)).toBeInTheDocument()
    })

    it('should display table name in title', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTableInfoResponse,
      })

      renderWithProviders(<TableDetailDrawer />)

      expect(screen.getByText('public.users')).toBeInTheDocument()
    })

    it('should display columns after loading', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTableInfoResponse,
      })

      renderWithProviders(<TableDetailDrawer />)

      await waitFor(() => {
        expect(screen.getByText('id')).toBeInTheDocument()
        expect(screen.getByText('name')).toBeInTheDocument()
        expect(screen.getByText('email')).toBeInTheDocument()
      })
    })

    it('should display column types', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTableInfoResponse,
      })

      renderWithProviders(<TableDetailDrawer />)

      await waitFor(() => {
        expect(screen.getByText('integer')).toBeInTheDocument()
        expect(screen.getAllByText('varchar')).toHaveLength(2)
      })
    })

    it('should show row count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTableInfoResponse,
      })

      renderWithProviders(<TableDetailDrawer />)

      await waitFor(() => {
        expect(screen.getByText(/100 rows/i)).toBeInTheDocument()
      })
    })
  })
})
