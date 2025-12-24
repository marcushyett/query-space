import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TableBrowser } from '../TableBrowser'
import { useConnectionStore } from '@/stores/connectionStore'
import { useUiStore } from '@/stores/uiStore'
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
    },
  }
})

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <ConfigProvider>{component}</ConfigProvider>
  )
}

describe('TableBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useConnectionStore.setState({ connectionString: null })
    useUiStore.setState({
      tableBrowserOpen: true,
      selectedTable: null,
      tableDetailDrawerOpen: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('without connection', () => {
    it('should show connect message when not connected', () => {
      renderWithProviders(<TableBrowser />)
      expect(screen.getByText(/Connect to a database/i)).toBeInTheDocument()
    })

    it('should not fetch tables when not connected', () => {
      renderWithProviders(<TableBrowser />)
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('with connection', () => {
    beforeEach(() => {
      useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb' })
    })

    it('should show loading state while fetching', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves
      renderWithProviders(<TableBrowser />)
      expect(screen.getByText(/Loading tables/i)).toBeInTheDocument()
    })

    it('should fetch tables on mount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tables: [
            { schema: 'public', name: 'users', type: 'table', rowCount: 100 },
          ],
        }),
      })

      renderWithProviders(<TableBrowser />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/tables', expect.any(Object))
      })
    })

    it('should show empty state when no tables', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tables: [] }),
      })

      renderWithProviders(<TableBrowser />)

      await waitFor(() => {
        expect(screen.getByText(/No tables found/i)).toBeInTheDocument()
      })
    })

    it('should have search input', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tables: [] }),
      })

      renderWithProviders(<TableBrowser />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search tables/i)).toBeInTheDocument()
      })
    })
  })
})
