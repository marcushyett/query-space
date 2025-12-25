import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTableInfo } from '../useTableInfo'
import { useConnectionStore } from '@/stores/connectionStore'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock message functions
const mockMessage = {
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
}

// Mock antd App.useApp
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    App: {
      ...((actual as Record<string, unknown>).App as Record<string, unknown>),
      useApp: () => ({ message: mockMessage }),
    },
  }
})

describe('useTableInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset connection store
    useConnectionStore.setState({ connectionString: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should have null tableInfo initially', () => {
      const { result } = renderHook(() => useTableInfo())
      expect(result.current.tableInfo).toBeNull()
    })

    it('should not be loading initially', () => {
      const { result } = renderHook(() => useTableInfo())
      expect(result.current.isLoading).toBe(false)
    })

    it('should have no error initially', () => {
      const { result } = renderHook(() => useTableInfo())
      expect(result.current.error).toBeNull()
    })
  })

  describe('fetchTableInfo without connection', () => {
    it('should set error when no connection string', async () => {
      const { result } = renderHook(() => useTableInfo())

      await act(async () => {
        await result.current.fetchTableInfo('public', 'users')
      })

      expect(result.current.error).toBe('No database connection')
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('fetchTableInfo with connection', () => {
    beforeEach(() => {
      useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb' })
    })

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
        { name: 'users_email_idx', columns: ['email'], isUnique: true, isPrimary: false },
      ],
      sampleData: [
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' },
      ],
      rowCount: 100,
    }

    it('should fetch table info successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTableInfoResponse,
      })

      const { result } = renderHook(() => useTableInfo())

      await act(async () => {
        await result.current.fetchTableInfo('public', 'users')
      })

      expect(result.current.tableInfo).toEqual(mockTableInfoResponse)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should set loading state during fetch', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      const { result } = renderHook(() => useTableInfo())

      act(() => {
        result.current.fetchTableInfo('public', 'users')
      })

      expect(result.current.isLoading).toBe(true)
    })

    it('should handle fetch error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Table not found' }),
      })

      const { result } = renderHook(() => useTableInfo())

      await act(async () => {
        await result.current.fetchTableInfo('public', 'nonexistent')
      })

      expect(result.current.error).toBe('Table not found')
      expect(result.current.tableInfo).toBeNull()
    })

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useTableInfo())

      await act(async () => {
        await result.current.fetchTableInfo('public', 'users')
      })

      expect(result.current.error).toBe('Network error')
    })

    it('should make correct API call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTableInfoResponse,
      })

      const { result } = renderHook(() => useTableInfo())

      await act(async () => {
        await result.current.fetchTableInfo('public', 'users')
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/table-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString: 'postgresql://localhost/testdb',
          schema: 'public',
          table: 'users',
        }),
      })
    })
  })

  describe('clearTableInfo', () => {
    it('should clear table info and error', async () => {
      useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb' })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          schema: 'public',
          name: 'users',
          columns: [],
          indexes: [],
          sampleData: [],
          rowCount: 0,
        }),
      })

      const { result } = renderHook(() => useTableInfo())

      // First fetch some data
      await act(async () => {
        await result.current.fetchTableInfo('public', 'users')
      })

      expect(result.current.tableInfo).not.toBeNull()

      // Then clear it
      act(() => {
        result.current.clearTableInfo()
      })

      expect(result.current.tableInfo).toBeNull()
      expect(result.current.error).toBeNull()
    })
  })

  describe('columns structure', () => {
    it('should have correct column structure', async () => {
      useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb' })

      const mockResponse = {
        schema: 'public',
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'integer',
            nullable: false,
            defaultValue: "nextval('users_id_seq')",
            isPrimaryKey: true,
            isForeignKey: false,
            references: null,
          },
          {
            name: 'org_id',
            type: 'integer',
            nullable: false,
            defaultValue: null,
            isPrimaryKey: false,
            isForeignKey: true,
            references: 'public.organizations(id)',
          },
        ],
        indexes: [],
        sampleData: [],
        rowCount: 50,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const { result } = renderHook(() => useTableInfo())

      await act(async () => {
        await result.current.fetchTableInfo('public', 'users')
      })

      const columns = result.current.tableInfo?.columns
      expect(columns).toHaveLength(2)

      // Check primary key column
      const pkColumn = columns?.find((c) => c.isPrimaryKey)
      expect(pkColumn?.name).toBe('id')
      expect(pkColumn?.defaultValue).toContain('nextval')

      // Check foreign key column
      const fkColumn = columns?.find((c) => c.isForeignKey)
      expect(fkColumn?.name).toBe('org_id')
      expect(fkColumn?.references).toBe('public.organizations(id)')
    })
  })
})
