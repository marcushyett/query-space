import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuery } from '../useQuery';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore } from '@/stores/queryStore';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock message functions
const mockMessage = {
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
};

// Mock antd App.useApp
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    App: {
      ...((actual as Record<string, unknown>).App as Record<string, unknown>),
      useApp: () => ({ message: mockMessage }),
    },
  };
});

// Helper to create mock fetch responses
function createFetchMock(responses: Array<{ ok: boolean; json: () => Promise<unknown> }>) {
  let callIndex = 0;
  return vi.fn().mockImplementation(() => {
    const response = responses[callIndex] || responses[responses.length - 1];
    callIndex++;
    return Promise.resolve(response);
  });
}

describe('useQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConnectionStore.setState({ connectionString: null, organizationId: null });
    useQueryStore.setState({
      queryResults: null,
      isExecuting: false,
      isLoadingHistory: false,
      queryHistory: [],
      lastError: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('executeQuery', () => {
    describe('without connection', () => {
      it('should show error when no connection string', async () => {
        const { result } = renderHook(() => useQuery());

        await act(async () => {
          await result.current.executeQuery('SELECT 1');
        });

        expect(mockMessage.error).toHaveBeenCalledWith('No database connection. Please connect to a database first.');
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    describe('with empty query', () => {
      beforeEach(() => {
        useConnectionStore.setState({ connectionString: 'configured-in-org-settings', organizationId: 'org-123' });
      });

      it('should show warning for empty query', async () => {
        const { result } = renderHook(() => useQuery());

        await act(async () => {
          await result.current.executeQuery('');
        });

        expect(mockMessage.warning).toHaveBeenCalledWith('Please enter a SQL query');
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('should show warning for whitespace-only query', async () => {
        const { result } = renderHook(() => useQuery());

        await act(async () => {
          await result.current.executeQuery('   ');
        });

        expect(mockMessage.warning).toHaveBeenCalledWith('Please enter a SQL query');
      });
    });

    describe('with valid connection and query', () => {
      beforeEach(() => {
        useConnectionStore.setState({ connectionString: 'configured-in-org-settings', organizationId: 'org-123' });
      });

      it('should make correct API call', async () => {
        global.fetch = createFetchMock([
          // Query execution response
          {
            ok: true,
            json: async () => ({
              rows: [],
              fields: [],
              rowCount: 0,
              executionTime: 10,
            }),
          },
          // Save execution response
          {
            ok: true,
            json: async () => ({
              execution: {
                id: 'exec-1',
                sql: 'SELECT 1',
                source: 'manual',
                success: true,
                rowCount: 0,
                executionTime: 10,
                createdAt: Date.now(),
              },
            }),
          },
        ]);

        const { result } = renderHook(() => useQuery());

        await act(async () => {
          await result.current.executeQuery('SELECT 1');
        });

        expect(global.fetch).toHaveBeenCalledWith('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: 'org-123',
            sql: 'SELECT 1',
          }),
        });
      });

      it('should set isExecuting during query', async () => {
        global.fetch = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves

        const { result } = renderHook(() => useQuery());

        act(() => {
          result.current.executeQuery('SELECT 1');
        });

        expect(useQueryStore.getState().isExecuting).toBe(true);
      });

      it('should update query results on success', async () => {
        const mockResponse = {
          rows: [{ id: 1 }],
          fields: [{ name: 'id', dataTypeID: 23 }],
          rowCount: 1,
          executionTime: 15,
        };

        global.fetch = createFetchMock([
          { ok: true, json: async () => mockResponse },
          {
            ok: true,
            json: async () => ({
              execution: {
                id: 'exec-1',
                sql: 'SELECT 1',
                source: 'manual',
                success: true,
                rowCount: 1,
                executionTime: 15,
                createdAt: Date.now(),
              },
            }),
          },
        ]);

        const { result } = renderHook(() => useQuery());

        await act(async () => {
          await result.current.executeQuery('SELECT 1');
        });

        expect(useQueryStore.getState().queryResults).toEqual(mockResponse);
      });

      it('should add query to history on success', async () => {
        global.fetch = createFetchMock([
          {
            ok: true,
            json: async () => ({
              rows: [],
              fields: [],
              rowCount: 0,
              executionTime: 10,
            }),
          },
          {
            ok: true,
            json: async () => ({
              execution: {
                id: 'exec-1',
                sql: 'SELECT * FROM users',
                source: 'manual',
                success: true,
                rowCount: 0,
                executionTime: 10,
                createdAt: Date.now(),
              },
            }),
          },
        ]);

        const { result } = renderHook(() => useQuery());

        await act(async () => {
          await result.current.executeQuery('SELECT * FROM users');
        });

        const history = useQueryStore.getState().queryHistory;
        expect(history).toHaveLength(1);
        expect(history[0].sql).toBe('SELECT * FROM users');
      });

      it('should show success message', async () => {
        global.fetch = createFetchMock([
          {
            ok: true,
            json: async () => ({
              rows: [],
              fields: [],
              rowCount: 0,
              executionTime: 25,
            }),
          },
          {
            ok: true,
            json: async () => ({
              execution: {
                id: 'exec-1',
                sql: 'SELECT 1',
                source: 'manual',
                success: true,
                rowCount: 0,
                executionTime: 25,
                createdAt: Date.now(),
              },
            }),
          },
        ]);

        const { result } = renderHook(() => useQuery());

        await act(async () => {
          await result.current.executeQuery('SELECT 1');
        });

        expect(mockMessage.success).toHaveBeenCalledWith('Query executed successfully (25ms)');
      });

      it('should show warning if present in response', async () => {
        global.fetch = createFetchMock([
          {
            ok: true,
            json: async () => ({
              rows: [],
              fields: [],
              rowCount: 0,
              executionTime: 10,
              warning: 'This query may be slow',
            }),
          },
          {
            ok: true,
            json: async () => ({
              execution: {
                id: 'exec-1',
                sql: 'SELECT 1',
                source: 'manual',
                success: true,
                rowCount: 0,
                executionTime: 10,
                createdAt: Date.now(),
              },
            }),
          },
        ]);

        const { result } = renderHook(() => useQuery());

        await act(async () => {
          await result.current.executeQuery('SELECT 1');
        });

        expect(mockMessage.warning).toHaveBeenCalledWith('This query may be slow');
      });

      it('should reset isExecuting after success', async () => {
        global.fetch = createFetchMock([
          {
            ok: true,
            json: async () => ({
              rows: [],
              fields: [],
              rowCount: 0,
              executionTime: 10,
            }),
          },
          {
            ok: true,
            json: async () => ({
              execution: {
                id: 'exec-1',
                sql: 'SELECT 1',
                source: 'manual',
                success: true,
                rowCount: 0,
                executionTime: 10,
                createdAt: Date.now(),
              },
            }),
          },
        ]);

        const { result } = renderHook(() => useQuery());

        await act(async () => {
          await result.current.executeQuery('SELECT 1');
        });

        expect(useQueryStore.getState().isExecuting).toBe(false);
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        useConnectionStore.setState({ connectionString: 'configured-in-org-settings', organizationId: 'org-123' });
      });

      it('should handle API error response', async () => {
        global.fetch = createFetchMock([
          { ok: false, json: async () => ({ error: 'Syntax error in SQL' }) },
          // Save failed execution response
          {
            ok: true,
            json: async () => ({
              execution: {
                id: 'exec-1',
                sql: 'SELCT 1',
                source: 'manual',
                success: false,
                error: 'Syntax error in SQL',
                createdAt: Date.now(),
              },
            }),
          },
        ]);

        const { result } = renderHook(() => useQuery());

        await act(async () => {
          await result.current.executeQuery('SELCT 1');
        });

        expect(mockMessage.error).toHaveBeenCalledWith('Syntax error in SQL');
        expect(result.current.error).toBe('Syntax error in SQL');
      });

      it('should handle network error', async () => {
        global.fetch = vi.fn()
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              execution: {
                id: 'exec-1',
                sql: 'SELECT 1',
                source: 'manual',
                success: false,
                error: 'Network error',
                createdAt: Date.now(),
              },
            }),
          });

        const { result } = renderHook(() => useQuery());

        await act(async () => {
          await result.current.executeQuery('SELECT 1');
        });

        expect(mockMessage.error).toHaveBeenCalledWith('Network error');
        expect(result.current.error).toBe('Network error');
      });

      it('should reset isExecuting after error', async () => {
        global.fetch = vi.fn()
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              execution: {
                id: 'exec-1',
                sql: 'SELECT 1',
                source: 'manual',
                success: false,
                error: 'Network error',
                createdAt: Date.now(),
              },
            }),
          });

        const { result } = renderHook(() => useQuery());

        await act(async () => {
          await result.current.executeQuery('SELECT 1');
        });

        expect(useQueryStore.getState().isExecuting).toBe(false);
      });

      it('should provide fallback error message', async () => {
        global.fetch = createFetchMock([
          { ok: false, json: async () => ({}) }, // No error message
          {
            ok: true,
            json: async () => ({
              execution: {
                id: 'exec-1',
                sql: 'SELECT 1',
                source: 'manual',
                success: false,
                error: 'Query execution failed',
                createdAt: Date.now(),
              },
            }),
          },
        ]);

        const { result } = renderHook(() => useQuery());

        await act(async () => {
          await result.current.executeQuery('SELECT 1');
        });

        expect(mockMessage.error).toHaveBeenCalledWith('Query execution failed');
      });
    });
  });
});
