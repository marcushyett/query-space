import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTables } from '../useTables'
import { useConnectionStore } from '@/stores/connectionStore'

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

describe('useTables', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset connection store
    useConnectionStore.setState({ connectionString: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should have empty tables array initially', () => {
      const { result } = renderHook(() => useTables())
      expect(result.current.tables).toEqual([])
    })

    it('should not be loading initially', () => {
      const { result } = renderHook(() => useTables())
      expect(result.current.isLoading).toBe(false)
    })

    it('should have no error initially', () => {
      const { result } = renderHook(() => useTables())
      expect(result.current.error).toBeNull()
    })
  })

  describe('fetchTables without connection', () => {
    it('should set error when no connection string', async () => {
      const { result } = renderHook(() => useTables())

      await act(async () => {
        await result.current.fetchTables()
      })

      expect(result.current.error).toBe('No database connection')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('fetchTables with connection', () => {
    beforeEach(() => {
      useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb' })
    })

    it('should fetch tables successfully', async () => {
      const mockTables = [
        { schema: 'public', name: 'users', type: 'table', rowCount: 100 },
        { schema: 'public', name: 'orders', type: 'table', rowCount: 50 },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tables: mockTables }),
      })

      const { result } = renderHook(() => useTables())

      await act(async () => {
        await result.current.fetchTables()
      })

      expect(result.current.tables).toEqual(mockTables)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should set loading state during fetch', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      const { result } = renderHook(() => useTables())

      act(() => {
        result.current.fetchTables()
      })

      // Should be loading during fetch
      expect(result.current.isLoading).toBe(true)
    })

    it('should handle fetch error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Database connection failed' }),
      })

      const { result } = renderHook(() => useTables())

      await act(async () => {
        await result.current.fetchTables()
      })

      expect(result.current.error).toBe('Database connection failed')
      expect(result.current.tables).toEqual([])
    })

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useTables())

      await act(async () => {
        await result.current.fetchTables()
      })

      expect(result.current.error).toBe('Network error')
    })

    it('should make correct API call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tables: [] }),
      })

      const { result } = renderHook(() => useTables())

      await act(async () => {
        await result.current.fetchTables()
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString: 'postgresql://localhost/testdb' }),
      })
    })
  })

  describe('refreshTables', () => {
    it('should call fetchTables', async () => {
      useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb' })

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ tables: [] }),
      })

      const { result } = renderHook(() => useTables())

      await act(async () => {
        await result.current.refreshTables()
      })

      expect(mockFetch).toHaveBeenCalled()
    })
  })
})
