import { describe, it, expect, beforeEach } from 'vitest'
import { useQueryStore, QueryResult } from '../queryStore'

describe('queryStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useQueryStore.setState({
      currentQuery: '',
      queryResults: null,
      queryHistory: [],
      isExecuting: false,
    })
  })

  describe('initial state', () => {
    it('should have empty current query initially', () => {
      const state = useQueryStore.getState()
      expect(state.currentQuery).toBe('')
    })

    it('should have null query results initially', () => {
      const state = useQueryStore.getState()
      expect(state.queryResults).toBeNull()
    })

    it('should have empty query history initially', () => {
      const state = useQueryStore.getState()
      expect(state.queryHistory).toEqual([])
    })

    it('should not be executing initially', () => {
      const state = useQueryStore.getState()
      expect(state.isExecuting).toBe(false)
    })
  })

  describe('setCurrentQuery', () => {
    it('should set current query', () => {
      useQueryStore.getState().setCurrentQuery('SELECT * FROM users')

      const state = useQueryStore.getState()
      expect(state.currentQuery).toBe('SELECT * FROM users')
    })

    it('should handle empty string', () => {
      useQueryStore.getState().setCurrentQuery('SELECT * FROM users')
      useQueryStore.getState().setCurrentQuery('')

      const state = useQueryStore.getState()
      expect(state.currentQuery).toBe('')
    })

    it('should handle multiline queries', () => {
      const multilineQuery = `
        SELECT
          id,
          name
        FROM users
        WHERE active = true
      `
      useQueryStore.getState().setCurrentQuery(multilineQuery)

      const state = useQueryStore.getState()
      expect(state.currentQuery).toBe(multilineQuery)
    })
  })

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
      }

      useQueryStore.getState().setQueryResults(results)

      const state = useQueryStore.getState()
      expect(state.queryResults).toEqual(results)
    })

    it('should handle empty results', () => {
      const results: QueryResult = {
        rows: [],
        fields: [{ name: 'id', dataTypeID: 23 }],
        rowCount: 0,
        executionTime: 10,
      }

      useQueryStore.getState().setQueryResults(results)

      const state = useQueryStore.getState()
      expect(state.queryResults?.rows).toEqual([])
      expect(state.queryResults?.rowCount).toBe(0)
    })

    it('should replace previous results', () => {
      const results1: QueryResult = {
        rows: [{ id: 1 }],
        fields: [{ name: 'id', dataTypeID: 23 }],
        rowCount: 1,
        executionTime: 10,
      }
      const results2: QueryResult = {
        rows: [{ id: 2 }],
        fields: [{ name: 'id', dataTypeID: 23 }],
        rowCount: 1,
        executionTime: 20,
      }

      useQueryStore.getState().setQueryResults(results1)
      useQueryStore.getState().setQueryResults(results2)

      const state = useQueryStore.getState()
      expect(state.queryResults?.rows[0].id).toBe(2)
    })
  })

  describe('addToHistory', () => {
    it('should add query to history', () => {
      useQueryStore.getState().addToHistory('SELECT * FROM users', 10, 42)

      const state = useQueryStore.getState()
      expect(state.queryHistory).toHaveLength(1)
      expect(state.queryHistory[0].sql).toBe('SELECT * FROM users')
      expect(state.queryHistory[0].rowCount).toBe(10)
      expect(state.queryHistory[0].executionTime).toBe(42)
    })

    it('should add new queries at the beginning', () => {
      useQueryStore.getState().addToHistory('SELECT 1', 1, 10)
      useQueryStore.getState().addToHistory('SELECT 2', 1, 10)
      useQueryStore.getState().addToHistory('SELECT 3', 1, 10)

      const state = useQueryStore.getState()
      expect(state.queryHistory[0].sql).toBe('SELECT 3')
      expect(state.queryHistory[1].sql).toBe('SELECT 2')
      expect(state.queryHistory[2].sql).toBe('SELECT 1')
    })

    it('should limit history to 50 items', () => {
      // Add 55 queries
      for (let i = 0; i < 55; i++) {
        useQueryStore.getState().addToHistory(`SELECT ${i}`, i, i)
      }

      const state = useQueryStore.getState()
      expect(state.queryHistory).toHaveLength(50)
      // Most recent should be the last one added
      expect(state.queryHistory[0].sql).toBe('SELECT 54')
      // Oldest should be removed (0-4 removed)
      expect(state.queryHistory[49].sql).toBe('SELECT 5')
    })

    it('should generate IDs based on timestamp', async () => {
      useQueryStore.getState().addToHistory('SELECT 1', 1, 10)
      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 5))
      useQueryStore.getState().addToHistory('SELECT 2', 1, 10)

      const state = useQueryStore.getState()
      // IDs should be different (timestamp-based)
      expect(state.queryHistory[0].id).not.toBe(state.queryHistory[1].id)
      // IDs should look like timestamps (numeric strings)
      expect(Number(state.queryHistory[0].id)).toBeGreaterThan(0)
    })

    it('should set timestamp', () => {
      const beforeTime = Date.now()
      useQueryStore.getState().addToHistory('SELECT 1', 1, 10)
      const afterTime = Date.now()

      const state = useQueryStore.getState()
      expect(state.queryHistory[0].timestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(state.queryHistory[0].timestamp).toBeLessThanOrEqual(afterTime)
    })

    it('should handle null rowCount and executionTime', () => {
      useQueryStore.getState().addToHistory('SELECT 1', null, null)

      const state = useQueryStore.getState()
      expect(state.queryHistory[0].rowCount).toBeNull()
      expect(state.queryHistory[0].executionTime).toBeNull()
    })
  })

  describe('clearHistory', () => {
    it('should clear all history', () => {
      useQueryStore.getState().addToHistory('SELECT 1', 1, 10)
      useQueryStore.getState().addToHistory('SELECT 2', 1, 10)
      useQueryStore.getState().clearHistory()

      const state = useQueryStore.getState()
      expect(state.queryHistory).toEqual([])
    })
  })

  describe('setIsExecuting', () => {
    it('should set executing to true', () => {
      useQueryStore.getState().setIsExecuting(true)

      const state = useQueryStore.getState()
      expect(state.isExecuting).toBe(true)
    })

    it('should set executing to false', () => {
      useQueryStore.getState().setIsExecuting(true)
      useQueryStore.getState().setIsExecuting(false)

      const state = useQueryStore.getState()
      expect(state.isExecuting).toBe(false)
    })
  })
})
