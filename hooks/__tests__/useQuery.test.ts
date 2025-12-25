import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useQuery } from '../useQuery'
import { useConnectionStore } from '@/stores/connectionStore'
import { useQueryStore } from '@/stores/queryStore'

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

describe('useQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useConnectionStore.setState({ connectionString: null })
    useQueryStore.setState({
      queryResults: null,
      isExecuting: false,
      queryHistory: [],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('executeQuery', () => {
    describe('without connection', () => {
      it('should show error when no connection string', async () => {
        const { result } = renderHook(() => useQuery())

        await act(async () => {
          await result.current.executeQuery('SELECT 1')
        })

        expect(mockMessage.error).toHaveBeenCalledWith('No database connection. Please connect to a database first.')
        expect(mockFetch).not.toHaveBeenCalled()
      })
    })

    describe('with empty query', () => {
      beforeEach(() => {
        useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb' })
      })

      it('should show warning for empty query', async () => {
        const { result } = renderHook(() => useQuery())

        await act(async () => {
          await result.current.executeQuery('')
        })

        expect(mockMessage.warning).toHaveBeenCalledWith('Please enter a SQL query')
        expect(mockFetch).not.toHaveBeenCalled()
      })

      it('should show warning for whitespace-only query', async () => {
        const { result } = renderHook(() => useQuery())

        await act(async () => {
          await result.current.executeQuery('   ')
        })

        expect(mockMessage.warning).toHaveBeenCalledWith('Please enter a SQL query')
      })
    })

    describe('with valid connection and query', () => {
      beforeEach(() => {
        useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb' })
      })

      it('should make correct API call', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            rows: [],
            fields: [],
            rowCount: 0,
            executionTime: 10,
          }),
        })

        const { result } = renderHook(() => useQuery())

        await act(async () => {
          await result.current.executeQuery('SELECT 1')
        })

        expect(mockFetch).toHaveBeenCalledWith('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionString: 'postgresql://localhost/testdb',
            sql: 'SELECT 1',
          }),
        })
      })

      it('should set isExecuting during query', async () => {
        mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

        const { result } = renderHook(() => useQuery())

        act(() => {
          result.current.executeQuery('SELECT 1')
        })

        expect(useQueryStore.getState().isExecuting).toBe(true)
      })

      it('should update query results on success', async () => {
        const mockResponse = {
          rows: [{ id: 1 }],
          fields: [{ name: 'id', dataTypeID: 23 }],
          rowCount: 1,
          executionTime: 15,
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        })

        const { result } = renderHook(() => useQuery())

        await act(async () => {
          await result.current.executeQuery('SELECT 1')
        })

        expect(useQueryStore.getState().queryResults).toEqual(mockResponse)
      })

      it('should add query to history on success', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            rows: [],
            fields: [],
            rowCount: 0,
            executionTime: 10,
          }),
        })

        const { result } = renderHook(() => useQuery())

        await act(async () => {
          await result.current.executeQuery('SELECT * FROM users')
        })

        const history = useQueryStore.getState().queryHistory
        expect(history).toHaveLength(1)
        expect(history[0].sql).toBe('SELECT * FROM users')
      })

      it('should show success message', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            rows: [],
            fields: [],
            rowCount: 0,
            executionTime: 25,
          }),
        })

        const { result } = renderHook(() => useQuery())

        await act(async () => {
          await result.current.executeQuery('SELECT 1')
        })

        expect(mockMessage.success).toHaveBeenCalledWith('Query executed successfully (25ms)')
      })

      it('should show warning if present in response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            rows: [],
            fields: [],
            rowCount: 0,
            executionTime: 10,
            warning: 'This query may be slow',
          }),
        })

        const { result } = renderHook(() => useQuery())

        await act(async () => {
          await result.current.executeQuery('SELECT 1')
        })

        expect(mockMessage.warning).toHaveBeenCalledWith('This query may be slow')
      })

      it('should reset isExecuting after success', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            rows: [],
            fields: [],
            rowCount: 0,
            executionTime: 10,
          }),
        })

        const { result } = renderHook(() => useQuery())

        await act(async () => {
          await result.current.executeQuery('SELECT 1')
        })

        expect(useQueryStore.getState().isExecuting).toBe(false)
      })
    })

    describe('error handling', () => {
      beforeEach(() => {
        useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb' })
      })

      it('should handle API error response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Syntax error in SQL' }),
        })

        const { result } = renderHook(() => useQuery())

        await act(async () => {
          await result.current.executeQuery('SELCT 1')
        })

        expect(mockMessage.error).toHaveBeenCalledWith('Syntax error in SQL')
        expect(result.current.error).toBe('Syntax error in SQL')
      })

      it('should handle network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        const { result } = renderHook(() => useQuery())

        await act(async () => {
          await result.current.executeQuery('SELECT 1')
        })

        expect(mockMessage.error).toHaveBeenCalledWith('Network error')
        expect(result.current.error).toBe('Network error')
      })

      it('should reset isExecuting after error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        const { result } = renderHook(() => useQuery())

        await act(async () => {
          await result.current.executeQuery('SELECT 1')
        })

        expect(useQueryStore.getState().isExecuting).toBe(false)
      })

      it('should provide fallback error message', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: async () => ({}), // No error message
        })

        const { result } = renderHook(() => useQuery())

        await act(async () => {
          await result.current.executeQuery('SELECT 1')
        })

        expect(mockMessage.error).toHaveBeenCalledWith('Query execution failed')
      })
    })
  })
})
