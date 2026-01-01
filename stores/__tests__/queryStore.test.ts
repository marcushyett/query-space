import { describe, it, expect, beforeEach } from 'vitest';
import { useQueryStore, QueryResult, SavedQuery } from '../queryStore';

describe('queryStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useQueryStore.setState({
      currentQuery: '',
      queryName: '',
      queryResults: null,
      queryHistory: [],
      isLoadingHistory: false,
      isExecuting: false,
      lastError: null,
    });
  });

  describe('initial state', () => {
    it('should have empty current query initially', () => {
      const state = useQueryStore.getState();
      expect(state.currentQuery).toBe('');
    });

    it('should have null query results initially', () => {
      const state = useQueryStore.getState();
      expect(state.queryResults).toBeNull();
    });

    it('should have empty query history initially', () => {
      const state = useQueryStore.getState();
      expect(state.queryHistory).toEqual([]);
    });

    it('should not be executing initially', () => {
      const state = useQueryStore.getState();
      expect(state.isExecuting).toBe(false);
    });

    it('should not be loading history initially', () => {
      const state = useQueryStore.getState();
      expect(state.isLoadingHistory).toBe(false);
    });
  });

  describe('setCurrentQuery', () => {
    it('should set current query', () => {
      useQueryStore.getState().setCurrentQuery('SELECT * FROM users');

      const state = useQueryStore.getState();
      expect(state.currentQuery).toBe('SELECT * FROM users');
    });

    it('should handle empty string', () => {
      useQueryStore.getState().setCurrentQuery('SELECT * FROM users');
      useQueryStore.getState().setCurrentQuery('');

      const state = useQueryStore.getState();
      expect(state.currentQuery).toBe('');
    });

    it('should handle multiline queries', () => {
      const multilineQuery = `
        SELECT
          id,
          name
        FROM users
        WHERE active = true
      `;
      useQueryStore.getState().setCurrentQuery(multilineQuery);

      const state = useQueryStore.getState();
      expect(state.currentQuery).toBe(multilineQuery);
    });
  });

  describe('setQueryResults', () => {
    it('should set query results', () => {
      const results: QueryResult = {
        rows: [{ id: 1, name: 'John' }],
        fields: [
          { name: 'id', dataTypeID: 23 },
          { name: 'name', dataTypeID: 25 },
        ],
        rowCount: 1,
        executionTime: 42,
      };

      useQueryStore.getState().setQueryResults(results);

      const state = useQueryStore.getState();
      expect(state.queryResults).toEqual(results);
    });

    it('should handle empty results', () => {
      const results: QueryResult = {
        rows: [],
        fields: [{ name: 'id', dataTypeID: 23 }],
        rowCount: 0,
        executionTime: 10,
      };

      useQueryStore.getState().setQueryResults(results);

      const state = useQueryStore.getState();
      expect(state.queryResults?.rows).toEqual([]);
      expect(state.queryResults?.rowCount).toBe(0);
    });

    it('should replace previous results', () => {
      const results1: QueryResult = {
        rows: [{ id: 1 }],
        fields: [{ name: 'id', dataTypeID: 23 }],
        rowCount: 1,
        executionTime: 10,
      };
      const results2: QueryResult = {
        rows: [{ id: 2 }],
        fields: [{ name: 'id', dataTypeID: 23 }],
        rowCount: 1,
        executionTime: 20,
      };

      useQueryStore.getState().setQueryResults(results1);
      useQueryStore.getState().setQueryResults(results2);

      const state = useQueryStore.getState();
      expect(state.queryResults?.rows[0].id).toBe(2);
    });
  });

  describe('setQueryHistory', () => {
    it('should set query history from API', () => {
      const queries: SavedQuery[] = [
        {
          id: '1',
          sql: 'SELECT * FROM users',
          timestamp: Date.now(),
          rowCount: 10,
          executionTime: 50,
          source: 'manual',
          success: true,
        },
        {
          id: '2',
          sql: 'SELECT * FROM orders',
          timestamp: Date.now(),
          rowCount: 5,
          executionTime: 30,
          source: 'ai',
          success: true,
        },
      ];

      useQueryStore.getState().setQueryHistory(queries);

      const state = useQueryStore.getState();
      expect(state.queryHistory).toHaveLength(2);
      expect(state.queryHistory[0].id).toBe('1');
      expect(state.queryHistory[1].id).toBe('2');
    });
  });

  describe('addToHistory', () => {
    it('should add query to history', () => {
      const query: SavedQuery = {
        id: 'query-123',
        sql: 'SELECT * FROM users',
        timestamp: Date.now(),
        rowCount: 10,
        executionTime: 42,
        source: 'manual',
        success: true,
      };

      useQueryStore.getState().addToHistory(query);

      const state = useQueryStore.getState();
      expect(state.queryHistory).toHaveLength(1);
      expect(state.queryHistory[0].sql).toBe('SELECT * FROM users');
      expect(state.queryHistory[0].source).toBe('manual');
      expect(state.queryHistory[0].success).toBe(true);
    });

    it('should add new queries at the beginning', () => {
      const query1: SavedQuery = {
        id: 'query-1',
        sql: 'SELECT 1',
        timestamp: Date.now() - 1000,
        rowCount: 1,
        executionTime: 10,
        source: 'manual',
        success: true,
      };
      const query2: SavedQuery = {
        id: 'query-2',
        sql: 'SELECT 2',
        timestamp: Date.now(),
        rowCount: 1,
        executionTime: 10,
        source: 'ai',
        success: true,
      };

      useQueryStore.getState().addToHistory(query1);
      useQueryStore.getState().addToHistory(query2);

      const state = useQueryStore.getState();
      expect(state.queryHistory[0].sql).toBe('SELECT 2');
      expect(state.queryHistory[1].sql).toBe('SELECT 1');
    });

    it('should track failed queries', () => {
      const query: SavedQuery = {
        id: 'query-fail',
        sql: 'SELECT * FROM nonexistent',
        timestamp: Date.now(),
        rowCount: null,
        executionTime: null,
        source: 'manual',
        success: false,
        error: 'Table not found',
      };

      useQueryStore.getState().addToHistory(query);

      const state = useQueryStore.getState();
      expect(state.queryHistory[0].success).toBe(false);
      expect(state.queryHistory[0].error).toBe('Table not found');
    });
  });

  describe('getQueriesBySession', () => {
    it('should filter queries by session ID', () => {
      const queries: SavedQuery[] = [
        {
          id: '1',
          sql: 'SELECT 1',
          timestamp: Date.now(),
          rowCount: 1,
          executionTime: 10,
          source: 'ai',
          aiSessionId: 'session-1',
          success: true,
        },
        {
          id: '2',
          sql: 'SELECT 2',
          timestamp: Date.now(),
          rowCount: 1,
          executionTime: 10,
          source: 'ai',
          aiSessionId: 'session-2',
          success: true,
        },
        {
          id: '3',
          sql: 'SELECT 3',
          timestamp: Date.now(),
          rowCount: 1,
          executionTime: 10,
          source: 'ai',
          aiSessionId: 'session-1',
          success: true,
        },
      ];

      useQueryStore.getState().setQueryHistory(queries);
      const result = useQueryStore.getState().getQueriesBySession('session-1');

      expect(result).toHaveLength(2);
      expect(result.every(q => q.aiSessionId === 'session-1')).toBe(true);
    });
  });

  describe('getQueriesBySource', () => {
    it('should filter queries by source', () => {
      const queries: SavedQuery[] = [
        {
          id: '1',
          sql: 'SELECT 1',
          timestamp: Date.now(),
          rowCount: 1,
          executionTime: 10,
          source: 'manual',
          success: true,
        },
        {
          id: '2',
          sql: 'SELECT 2',
          timestamp: Date.now(),
          rowCount: 1,
          executionTime: 10,
          source: 'ai',
          success: true,
        },
        {
          id: '3',
          sql: 'SELECT 3',
          timestamp: Date.now(),
          rowCount: 1,
          executionTime: 10,
          source: 'manual',
          success: true,
        },
      ];

      useQueryStore.getState().setQueryHistory(queries);

      const manualQueries = useQueryStore.getState().getQueriesBySource('manual');
      expect(manualQueries).toHaveLength(2);
      expect(manualQueries.every(q => q.source === 'manual')).toBe(true);

      const aiQueries = useQueryStore.getState().getQueriesBySource('ai');
      expect(aiQueries).toHaveLength(1);
      expect(aiQueries[0].source).toBe('ai');
    });
  });

  describe('getSuccessfulQueries', () => {
    it('should filter only successful queries', () => {
      const queries: SavedQuery[] = [
        {
          id: '1',
          sql: 'SELECT 1',
          timestamp: Date.now(),
          rowCount: 1,
          executionTime: 10,
          source: 'manual',
          success: true,
        },
        {
          id: '2',
          sql: 'SELECT 2',
          timestamp: Date.now(),
          rowCount: null,
          executionTime: null,
          source: 'manual',
          success: false,
          error: 'Failed',
        },
        {
          id: '3',
          sql: 'SELECT 3',
          timestamp: Date.now(),
          rowCount: 1,
          executionTime: 10,
          source: 'manual',
          success: true,
        },
      ];

      useQueryStore.getState().setQueryHistory(queries);
      const successful = useQueryStore.getState().getSuccessfulQueries();

      expect(successful).toHaveLength(2);
      expect(successful.every(q => q.success === true)).toBe(true);
    });
  });

  describe('getQueriesByProject', () => {
    it('should filter queries by project ID', () => {
      const queries: SavedQuery[] = [
        {
          id: '1',
          sql: 'SELECT 1',
          timestamp: Date.now(),
          rowCount: 1,
          executionTime: 10,
          source: 'manual',
          success: true,
          projectId: 'project-1',
        },
        {
          id: '2',
          sql: 'SELECT 2',
          timestamp: Date.now(),
          rowCount: 1,
          executionTime: 10,
          source: 'manual',
          success: true,
          projectId: 'project-2',
        },
        {
          id: '3',
          sql: 'SELECT 3',
          timestamp: Date.now(),
          rowCount: 1,
          executionTime: 10,
          source: 'manual',
          success: true,
          projectId: 'project-1',
        },
      ];

      useQueryStore.getState().setQueryHistory(queries);
      const result = useQueryStore.getState().getQueriesByProject('project-1');

      expect(result).toHaveLength(2);
      expect(result.every(q => q.projectId === 'project-1')).toBe(true);
    });
  });

  describe('removeFromHistory', () => {
    it('should remove specific query from history', () => {
      const queries: SavedQuery[] = [
        {
          id: '1',
          sql: 'SELECT 1',
          timestamp: Date.now(),
          rowCount: 1,
          executionTime: 10,
          source: 'manual',
          success: true,
        },
        {
          id: '2',
          sql: 'SELECT 2',
          timestamp: Date.now(),
          rowCount: 1,
          executionTime: 10,
          source: 'manual',
          success: true,
        },
      ];

      useQueryStore.getState().setQueryHistory(queries);
      useQueryStore.getState().removeFromHistory('1');

      const state = useQueryStore.getState();
      expect(state.queryHistory).toHaveLength(1);
      expect(state.queryHistory[0].sql).toBe('SELECT 2');
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      const queries: SavedQuery[] = [
        {
          id: '1',
          sql: 'SELECT 1',
          timestamp: Date.now(),
          rowCount: 1,
          executionTime: 10,
          source: 'manual',
          success: true,
        },
        {
          id: '2',
          sql: 'SELECT 2',
          timestamp: Date.now(),
          rowCount: 1,
          executionTime: 10,
          source: 'manual',
          success: true,
        },
      ];

      useQueryStore.getState().setQueryHistory(queries);
      useQueryStore.getState().clearHistory();

      const state = useQueryStore.getState();
      expect(state.queryHistory).toEqual([]);
    });
  });

  describe('setIsExecuting', () => {
    it('should set executing to true', () => {
      useQueryStore.getState().setIsExecuting(true);

      const state = useQueryStore.getState();
      expect(state.isExecuting).toBe(true);
    });

    it('should set executing to false', () => {
      useQueryStore.getState().setIsExecuting(true);
      useQueryStore.getState().setIsExecuting(false);

      const state = useQueryStore.getState();
      expect(state.isExecuting).toBe(false);
    });
  });

  describe('setIsLoadingHistory', () => {
    it('should set loading history to true', () => {
      useQueryStore.getState().setIsLoadingHistory(true);

      const state = useQueryStore.getState();
      expect(state.isLoadingHistory).toBe(true);
    });

    it('should set loading history to false', () => {
      useQueryStore.getState().setIsLoadingHistory(true);
      useQueryStore.getState().setIsLoadingHistory(false);

      const state = useQueryStore.getState();
      expect(state.isLoadingHistory).toBe(false);
    });
  });
});
