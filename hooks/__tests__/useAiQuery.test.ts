import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAiQuery } from '../useAiQuery'
import { useConnectionStore } from '@/stores/connectionStore'
import { useSchemaStore } from '@/stores/schemaStore'

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

describe('useAiQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useConnectionStore.setState({ connectionString: null, organizationId: null })
    useSchemaStore.setState({
      tables: [],
      isLoading: false,
      error: null,
      lastFetched: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateQuery', () => {
    describe('validation', () => {
      it('should return error when no connection string', async () => {
        const { result } = renderHook(() => useAiQuery())

        await act(async () => {
          await result.current.generateQuery('show all users')
        })

        expect(mockMessage.error).toHaveBeenCalledWith('No database connection. Please connect to a database first.')
        expect(mockFetch).not.toHaveBeenCalled()
      })

      it('should return error when no organization selected', async () => {
        useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb', organizationId: null })

        const { result } = renderHook(() => useAiQuery())

        await act(async () => {
          await result.current.generateQuery('show all users')
        })

        expect(mockMessage.error).toHaveBeenCalledWith('No organization selected')
        expect(mockFetch).not.toHaveBeenCalled()
      })

      it('should return error for empty prompt', async () => {
        useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb', organizationId: 'org-123' })

        const { result } = renderHook(() => useAiQuery())

        await act(async () => {
          await result.current.generateQuery('')
        })

        expect(mockMessage.warning).toHaveBeenCalledWith('Please enter a prompt describing your query')
        expect(mockFetch).not.toHaveBeenCalled()
      })

      it('should return error for whitespace-only prompt', async () => {
        useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb', organizationId: 'org-123' })

        const { result } = renderHook(() => useAiQuery())

        await act(async () => {
          await result.current.generateQuery('   ')
        })

        expect(mockMessage.warning).toHaveBeenCalledWith('Please enter a prompt describing your query')
      })
    })

    describe('with valid inputs', () => {
      beforeEach(() => {
        useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb', organizationId: 'org-123' })
        useSchemaStore.setState({
          tables: [
            {
              schema: 'public',
              name: 'users',
              type: 'table',
              columns: [
                { name: 'id', type: 'integer', isPrimaryKey: true },
                { name: 'email', type: 'text', isPrimaryKey: false },
              ],
            },
          ],
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        })
      })

      it('should make correct API call', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sql: 'SELECT * FROM users' }),
        })

        const { result } = renderHook(() => useAiQuery())

        await act(async () => {
          await result.current.generateQuery('show all users')
        })

        expect(mockFetch).toHaveBeenCalledWith('/api/ai-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"prompt":"show all users"'),
        })
      })

      it('should include organizationId in request', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sql: 'SELECT * FROM users' }),
        })

        const { result } = renderHook(() => useAiQuery())

        await act(async () => {
          await result.current.generateQuery('show all users')
        })

        const callBody = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body)
        expect(callBody.organizationId).toBe('org-123')
      })

      it('should include schema in request', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sql: 'SELECT * FROM users' }),
        })

        const { result } = renderHook(() => useAiQuery())

        await act(async () => {
          await result.current.generateQuery('show all users')
        })

        const callBody = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body)
        expect(callBody.schema).toHaveLength(1)
        expect(callBody.schema[0].name).toBe('users')
      })

      it('should set isGenerating during generation', async () => {
        mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

        const { result } = renderHook(() => useAiQuery())

        act(() => {
          result.current.generateQuery('show all users')
        })

        expect(result.current.isGenerating).toBe(true)
      })

      it('should return generated SQL on success', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sql: 'SELECT * FROM users WHERE active = true' }),
        })

        const { result } = renderHook(() => useAiQuery())

        let generatedSql: string | null = null
        await act(async () => {
          generatedSql = await result.current.generateQuery('show active users')
        })

        expect(generatedSql).toBe('SELECT * FROM users WHERE active = true')
      })

      it('should show success message', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sql: 'SELECT * FROM users' }),
        })

        const { result } = renderHook(() => useAiQuery())

        await act(async () => {
          await result.current.generateQuery('show all users')
        })

        expect(mockMessage.success).toHaveBeenCalledWith('Query generated successfully')
      })

      it('should reset isGenerating after success', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sql: 'SELECT * FROM users' }),
        })

        const { result } = renderHook(() => useAiQuery())

        await act(async () => {
          await result.current.generateQuery('show all users')
        })

        expect(result.current.isGenerating).toBe(false)
      })
    })

    describe('error handling', () => {
      beforeEach(() => {
        useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb', organizationId: 'org-123' })
        useSchemaStore.setState({
          tables: [{ schema: 'public', name: 'users', type: 'table', columns: [] }],
          isLoading: false,
          error: null,
          lastFetched: Date.now(),
        })
      })

      it('should handle API error response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Invalid API key' }),
        })

        const { result } = renderHook(() => useAiQuery())

        await act(async () => {
          await result.current.generateQuery('show all users')
        })

        expect(mockMessage.error).toHaveBeenCalledWith('Invalid API key')
        expect(result.current.error).toBe('Invalid API key')
      })

      it('should handle network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        const { result } = renderHook(() => useAiQuery())

        await act(async () => {
          await result.current.generateQuery('show all users')
        })

        expect(mockMessage.error).toHaveBeenCalledWith('Network error')
        expect(result.current.error).toBe('Network error')
      })

      it('should reset isGenerating after error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'))

        const { result } = renderHook(() => useAiQuery())

        await act(async () => {
          await result.current.generateQuery('show all users')
        })

        expect(result.current.isGenerating).toBe(false)
      })

      it('should provide fallback error message', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          json: async () => ({}), // No error message
        })

        const { result } = renderHook(() => useAiQuery())

        await act(async () => {
          await result.current.generateQuery('show all users')
        })

        expect(mockMessage.error).toHaveBeenCalledWith('Failed to generate query')
      })
    })
  })

  describe('clearError', () => {
    it('should clear error state', async () => {
      useConnectionStore.setState({ connectionString: 'postgresql://localhost/testdb', organizationId: 'org-123' })
      useSchemaStore.setState({
        tables: [{ schema: 'public', name: 'users', type: 'table', columns: [] }],
        isLoading: false,
        error: null,
        lastFetched: Date.now(),
      })

      mockFetch.mockRejectedValueOnce(new Error('Some error'))

      const { result } = renderHook(() => useAiQuery())

      await act(async () => {
        await result.current.generateQuery('show all users')
      })

      expect(result.current.error).toBe('Some error')

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})
