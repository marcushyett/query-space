import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSchema } from '../useSchema'
import { useConnectionStore } from '@/stores/connectionStore'
import { useSchemaStore } from '@/stores/schemaStore'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset stores
    useConnectionStore.setState({ connectionString: null, organizationId: null })
    useSchemaStore.setState({
      tables: [],
      isLoading: false,
      error: null,
      lastFetched: null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should have empty tables array initially', () => {
      const { result } = renderHook(() => useSchema())
      expect(result.current.tables).toEqual([])
    })

    it('should not be loading initially', () => {
      const { result } = renderHook(() => useSchema())
      expect(result.current.isLoading).toBe(false)
    })

    it('should have no error initially', () => {
      const { result } = renderHook(() => useSchema())
      expect(result.current.error).toBeNull()
    })
  })

  describe('without connection', () => {
    it('should reset schema when no organization', () => {
      const { result } = renderHook(() => useSchema())

      expect(result.current.tables).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('with connection', () => {
    beforeEach(() => {
      useConnectionStore.setState({
        connectionString: 'configured-in-org-settings',
        organizationId: 'org-123'
      })
    })

    it('should fetch schema on organization change', async () => {
      const mockTables = [
        {
          schema: 'public',
          name: 'users',
          type: 'table',
          columns: [
            { name: 'id', type: 'integer', isPrimaryKey: true },
            { name: 'name', type: 'varchar', isPrimaryKey: false },
          ],
        },
        {
          schema: 'public',
          name: 'orders',
          type: 'table',
          columns: [
            { name: 'id', type: 'integer', isPrimaryKey: true },
            { name: 'user_id', type: 'integer', isPrimaryKey: false },
          ],
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tables: mockTables }),
      })

      const { result } = renderHook(() => useSchema())

      await waitFor(() => {
        expect(result.current.tables).toEqual(mockTables)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: 'org-123' }),
      })
    })

    it('should correctly parse API response with tables field (not schema field)', async () => {
      // This test specifically verifies we read data.tables, not data.schema
      const mockTables = [
        {
          schema: 'public',
          name: 'products',
          type: 'table',
          columns: [{ name: 'id', type: 'integer', isPrimaryKey: true }],
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tables: mockTables,
          // Simulate wrong field being present
          schema: undefined,
        }),
      })

      const { result } = renderHook(() => useSchema())

      await waitFor(() => {
        expect(result.current.tables).toHaveLength(1)
        expect(result.current.tables[0].name).toBe('products')
      })
    })

    it('should set loading state during fetch', async () => {
      // Create a promise that we can control
      let resolvePromise: (value: unknown) => void
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      mockFetch.mockImplementationOnce(() => fetchPromise)

      const { result } = renderHook(() => useSchema())

      // Should be loading
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true)
      })

      // Resolve the fetch
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => ({ tables: [] }),
        })
      })

      // Should not be loading anymore
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should handle API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Database connection failed' }),
      })

      const { result } = renderHook(() => useSchema())

      await waitFor(() => {
        expect(result.current.error).toBe('Database connection failed')
      })
      expect(result.current.tables).toEqual([])
    })

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useSchema())

      await waitFor(() => {
        expect(result.current.error).toBe('Network error')
      })
    })

    it('should cache schema for 5 minutes', async () => {
      const mockTables = [{ schema: 'public', name: 'users', type: 'table', columns: [] }]

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ tables: mockTables }),
      })

      // First render - should fetch
      const { result, rerender } = renderHook(() => useSchema())

      await waitFor(() => {
        expect(result.current.tables).toHaveLength(1)
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Rerender - should use cache
      rerender()

      // Still only 1 fetch call
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should force refresh when refreshSchema is called', async () => {
      const mockTables = [{ schema: 'public', name: 'users', type: 'table', columns: [] }]
      const updatedTables = [
        { schema: 'public', name: 'users', type: 'table', columns: [] },
        { schema: 'public', name: 'orders', type: 'table', columns: [] },
      ]

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ tables: mockTables }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ tables: updatedTables }),
        })

      const { result } = renderHook(() => useSchema())

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.tables).toHaveLength(1)
      })

      // Force refresh
      await act(async () => {
        await result.current.refreshSchema()
      })

      // Should have new data
      await waitFor(() => {
        expect(result.current.tables).toHaveLength(2)
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('tables with columns', () => {
    beforeEach(() => {
      useConnectionStore.setState({
        connectionString: 'configured-in-org-settings',
        organizationId: 'org-123'
      })
    })

    it('should correctly store table columns for autocomplete', async () => {
      const mockTables = [
        {
          schema: 'public',
          name: 'users',
          type: 'table',
          columns: [
            { name: 'id', type: 'integer', isPrimaryKey: true },
            { name: 'email', type: 'varchar', isPrimaryKey: false },
            { name: 'created_at', type: 'timestamp', isPrimaryKey: false },
          ],
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tables: mockTables }),
      })

      const { result } = renderHook(() => useSchema())

      await waitFor(() => {
        expect(result.current.tables).toHaveLength(1)
      })

      const usersTable = result.current.tables[0]
      expect(usersTable.columns).toHaveLength(3)
      expect(usersTable.columns[0].name).toBe('id')
      expect(usersTable.columns[0].isPrimaryKey).toBe(true)
      expect(usersTable.columns[1].name).toBe('email')
      expect(usersTable.columns[2].name).toBe('created_at')
    })

    it('should handle tables from multiple schemas', async () => {
      const mockTables = [
        { schema: 'public', name: 'users', type: 'table', columns: [] },
        { schema: 'auth', name: 'sessions', type: 'table', columns: [] },
        { schema: 'public', name: 'orders', type: 'table', columns: [] },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tables: mockTables }),
      })

      const { result } = renderHook(() => useSchema())

      await waitFor(() => {
        expect(result.current.tables).toHaveLength(3)
      })

      const publicTables = result.current.tables.filter(t => t.schema === 'public')
      const authTables = result.current.tables.filter(t => t.schema === 'auth')

      expect(publicTables).toHaveLength(2)
      expect(authTables).toHaveLength(1)
    })

    it('should handle views in addition to tables', async () => {
      const mockTables = [
        { schema: 'public', name: 'users', type: 'table', columns: [] },
        { schema: 'public', name: 'user_stats', type: 'view', columns: [] },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tables: mockTables }),
      })

      const { result } = renderHook(() => useSchema())

      await waitFor(() => {
        expect(result.current.tables).toHaveLength(2)
      })

      expect(result.current.tables.find(t => t.type === 'table')).toBeDefined()
      expect(result.current.tables.find(t => t.type === 'view')).toBeDefined()
    })
  })
})
