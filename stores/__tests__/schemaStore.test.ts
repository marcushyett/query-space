import { describe, it, expect, beforeEach } from 'vitest'
import { useSchemaStore } from '../schemaStore'

describe('schemaStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useSchemaStore.setState({
      tables: [],
      isLoading: false,
      error: null,
      lastFetched: null
    })
  })

  describe('initial state', () => {
    it('should have empty tables array', () => {
      const state = useSchemaStore.getState()
      expect(state.tables).toEqual([])
    })

    it('should not be loading', () => {
      const state = useSchemaStore.getState()
      expect(state.isLoading).toBe(false)
    })

    it('should have no error', () => {
      const state = useSchemaStore.getState()
      expect(state.error).toBeNull()
    })

    it('should have null lastFetched', () => {
      const state = useSchemaStore.getState()
      expect(state.lastFetched).toBeNull()
    })
  })

  describe('setTables', () => {
    it('should set tables correctly', () => {
      const mockTables = [
        {
          schema: 'public',
          name: 'users',
          type: 'table' as const,
          columns: [
            { name: 'id', type: 'integer', isPrimaryKey: true },
            { name: 'name', type: 'varchar', isPrimaryKey: false },
          ],
        },
      ]

      useSchemaStore.getState().setTables(mockTables)

      const state = useSchemaStore.getState()
      expect(state.tables).toEqual(mockTables)
      expect(state.tables).toHaveLength(1)
      expect(state.tables[0].name).toBe('users')
      expect(state.tables[0].columns).toHaveLength(2)
    })

    it('should update lastFetched timestamp', () => {
      const before = Date.now()

      useSchemaStore.getState().setTables([])

      const state = useSchemaStore.getState()
      expect(state.lastFetched).toBeGreaterThanOrEqual(before)
      expect(state.lastFetched).toBeLessThanOrEqual(Date.now())
    })

    it('should clear error when tables are set', () => {
      // First set an error
      useSchemaStore.getState().setError('Some error')
      expect(useSchemaStore.getState().error).toBe('Some error')

      // Setting tables should clear the error
      useSchemaStore.getState().setTables([])
      expect(useSchemaStore.getState().error).toBeNull()
    })

    it('should handle tables with all column types', () => {
      const mockTables = [
        {
          schema: 'public',
          name: 'complex_table',
          type: 'table' as const,
          columns: [
            { name: 'id', type: 'uuid', isPrimaryKey: true },
            { name: 'name', type: 'varchar(255)', isPrimaryKey: false },
            { name: 'created_at', type: 'timestamp with time zone', isPrimaryKey: false },
            { name: 'data', type: 'jsonb', isPrimaryKey: false },
            { name: 'amount', type: 'numeric(10,2)', isPrimaryKey: false },
          ],
        },
      ]

      useSchemaStore.getState().setTables(mockTables)

      const state = useSchemaStore.getState()
      expect(state.tables[0].columns).toHaveLength(5)
      expect(state.tables[0].columns.map(c => c.type)).toEqual([
        'uuid',
        'varchar(255)',
        'timestamp with time zone',
        'jsonb',
        'numeric(10,2)',
      ])
    })

    it('should preserve primary key information', () => {
      const mockTables = [
        {
          schema: 'public',
          name: 'composite_pk',
          type: 'table' as const,
          columns: [
            { name: 'user_id', type: 'integer', isPrimaryKey: true },
            { name: 'role_id', type: 'integer', isPrimaryKey: true },
            { name: 'assigned_at', type: 'timestamp', isPrimaryKey: false },
          ],
        },
      ]

      useSchemaStore.getState().setTables(mockTables)

      const state = useSchemaStore.getState()
      const pkColumns = state.tables[0].columns.filter(c => c.isPrimaryKey)
      expect(pkColumns).toHaveLength(2)
      expect(pkColumns.map(c => c.name)).toEqual(['user_id', 'role_id'])
    })
  })

  describe('setLoading', () => {
    it('should set loading state to true', () => {
      useSchemaStore.getState().setLoading(true)
      expect(useSchemaStore.getState().isLoading).toBe(true)
    })

    it('should set loading state to false', () => {
      useSchemaStore.getState().setLoading(true)
      useSchemaStore.getState().setLoading(false)
      expect(useSchemaStore.getState().isLoading).toBe(false)
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      useSchemaStore.getState().setError('Connection failed')
      expect(useSchemaStore.getState().error).toBe('Connection failed')
    })

    it('should clear error when set to null', () => {
      useSchemaStore.getState().setError('Some error')
      useSchemaStore.getState().setError(null)
      expect(useSchemaStore.getState().error).toBeNull()
    })
  })

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      // Set some data
      useSchemaStore.getState().setTables([
        {
          schema: 'public',
          name: 'users',
          type: 'table' as const,
          columns: [{ name: 'id', type: 'integer', isPrimaryKey: true }],
        },
      ])
      useSchemaStore.getState().setLoading(true)
      useSchemaStore.getState().setError('Some error')

      // Reset
      useSchemaStore.getState().reset()

      const state = useSchemaStore.getState()
      expect(state.tables).toEqual([])
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.lastFetched).toBeNull()
    })
  })

  describe('tables availability for autocomplete', () => {
    it('should make tables immediately available for autocomplete after setTables', () => {
      const mockTables = [
        {
          schema: 'public',
          name: 'products',
          type: 'table' as const,
          columns: [
            { name: 'id', type: 'integer', isPrimaryKey: true },
            { name: 'name', type: 'varchar', isPrimaryKey: false },
            { name: 'price', type: 'decimal', isPrimaryKey: false },
          ],
        },
        {
          schema: 'public',
          name: 'categories',
          type: 'table' as const,
          columns: [
            { name: 'id', type: 'integer', isPrimaryKey: true },
            { name: 'name', type: 'varchar', isPrimaryKey: false },
          ],
        },
      ]

      useSchemaStore.getState().setTables(mockTables)

      // Tables should be immediately accessible
      const state = useSchemaStore.getState()

      // Find a specific table
      const productsTable = state.tables.find(t => t.name === 'products')
      expect(productsTable).toBeDefined()
      expect(productsTable?.columns).toHaveLength(3)

      // All columns should be accessible for column autocomplete
      const allColumns = state.tables.flatMap(t => t.columns)
      expect(allColumns.map(c => c.name)).toEqual(
        expect.arrayContaining(['id', 'name', 'price'])
      )
    })
  })
})
