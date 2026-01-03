import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createQueryAgentTools, type SchemaInfo, type ToolContext } from '../tools'

// Type definitions for tool results
type JsonKeysResult = { table: string; column: string; nestedPath: string | null; keys: string[] | null; keyCount: number; sampleValues: Record<string, unknown[]> | null; hint: string; error: string | null; suggestion: string | null }
type ExecuteQueryResult = { success: boolean; error?: string; suggestion?: string; rowCount: number | null; executionTime?: number; columns: string[] | null; rows: Record<string, unknown>[] | null; hasMoreRows: boolean | null; warning: string | null; emptyColumns: string[] | null; title: string; description: string; dataQuality?: unknown }
type ValidateQueryResult = { isValid: boolean; message?: string; error?: string; suggestion?: string }
type UpdateQueryUIResult = { action: string; sql: string; explanation: string; summary: string; message: string; changes: string[]; confidence: string; suggestions: string[] }
type GenerateChartResult = { success: boolean; error?: string; chartConfig?: { type: string; xAxis: string; yAxes: string[]; stacked?: boolean }; chartData?: Record<string, unknown>[]; title?: string }
type ManageTodoResult = { success: boolean; action: string; items?: Array<{ text: string; status: string; addedDuringExecution?: boolean }>; item_id?: string; item?: { text: string; status: string; addedDuringExecution?: boolean }; message?: string; error?: string }

// Helper to create options
const opts = { abortSignal: undefined as unknown as AbortSignal, toolCallId: 'test', messages: [] }

// Mock pg Client
const mockQuery = vi.fn()
const mockConnect = vi.fn()
const mockEnd = vi.fn()

vi.mock('pg', () => {
  return {
    Client: vi.fn().mockImplementation(function() {
      return {
        connect: mockConnect,
        query: mockQuery,
        end: mockEnd,
      }
    }),
  }
})

describe('Agent Tools', () => {
  const mockSchema: SchemaInfo[] = [
    {
      name: 'users',
      schema: 'public',
      type: 'table',
      columns: [
        { name: 'id', type: 'integer', isPrimaryKey: true },
        { name: 'name', type: 'varchar', isPrimaryKey: false },
        { name: 'email', type: 'varchar', isPrimaryKey: false },
        { name: 'metadata', type: 'jsonb', isPrimaryKey: false },
      ],
    },
    {
      name: 'orders',
      schema: 'public',
      type: 'table',
      columns: [
        { name: 'id', type: 'integer', isPrimaryKey: true },
        { name: 'user_id', type: 'integer', isPrimaryKey: false },
        { name: 'total', type: 'numeric', isPrimaryKey: false },
        { name: 'created_at', type: 'timestamp', isPrimaryKey: false },
      ],
    },
    {
      name: 'active_users',
      schema: 'public',
      type: 'view',
      columns: [
        { name: 'id', type: 'integer', isPrimaryKey: false },
        { name: 'name', type: 'varchar', isPrimaryKey: false },
      ],
    },
    {
      name: 'audit_log',
      schema: 'audit',
      type: 'table',
      columns: [
        { name: 'id', type: 'integer', isPrimaryKey: true },
        { name: 'action', type: 'varchar', isPrimaryKey: false },
      ],
    },
  ]

  const mockContext: ToolContext = {
    connectionString: 'postgresql://test:test@localhost:5432/testdb',
    schema: mockSchema,
  }

  let tools: ReturnType<typeof createQueryAgentTools>

  beforeEach(() => {
    vi.clearAllMocks()
    mockConnect.mockResolvedValue(undefined)
    mockEnd.mockResolvedValue(undefined)
    tools = createQueryAgentTools(mockContext)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('get_table_schema', () => {
    it('should return all tables and views by default', async () => {
      const result = await tools.get_table_schema.execute!({ includeViews: true }, { abortSignal: undefined as unknown as AbortSignal, toolCallId: 'test', messages: [] }) as { tableCount: number; tables: Array<{ name: string; type: string; columns: Array<{ name: string; type: string; isPrimaryKey: boolean }> }>; error: null; hint: string }

      expect(result.tableCount).toBe(4)
      expect(result.tables).toHaveLength(4)
      expect(result.error).toBeNull()
    })

    it('should exclude views when includeViews is false', async () => {
      const result = await tools.get_table_schema.execute!({ includeViews: false }, { abortSignal: undefined as unknown as AbortSignal, toolCallId: 'test', messages: [] }) as { tableCount: number; tables: Array<{ name: string; type: string; columns: Array<{ name: string; type: string; isPrimaryKey: boolean }> }>; error: null; hint: string }

      expect(result.tableCount).toBe(3)
      expect(result.tables).toHaveLength(3)
      expect(result.tables.every((t: { type: string }) => t.type !== 'view')).toBe(true)
    })

    it('should format table names correctly with schema prefix', async () => {
      const result = await tools.get_table_schema.execute!({}, { abortSignal: undefined as unknown as AbortSignal, toolCallId: 'test', messages: [] }) as { tableCount: number; tables: Array<{ name: string; type: string; columns: Array<{ name: string; type: string; isPrimaryKey: boolean }> }>; error: null; hint: string }

      const publicTable = result.tables.find((t: { name: string }) => t.name === '"users"')
      expect(publicTable).toBeDefined()
      expect(publicTable?.type).toBe('table')

      const schemaTable = result.tables.find((t: { name: string }) => t.name === '"audit"."audit_log"')
      expect(schemaTable).toBeDefined()
    })

    it('should include column information', async () => {
      const result = await tools.get_table_schema.execute!({}, { abortSignal: undefined as unknown as AbortSignal, toolCallId: 'test', messages: [] }) as { tableCount: number; tables: Array<{ name: string; type: string; columns: Array<{ name: string; type: string; isPrimaryKey: boolean }> }>; error: null; hint: string }

      const usersTable = result.tables.find((t: { name: string }) => t.name === '"users"')
      expect(usersTable?.columns).toHaveLength(4)

      const idColumn = usersTable?.columns.find((c: { name: string }) => c.name === 'id')
      expect(idColumn?.type).toBe('integer')
      expect(idColumn?.isPrimaryKey).toBe(true)
    })

    it('should include hint about JSON keys', async () => {
      const result = await tools.get_table_schema.execute!({}, { abortSignal: undefined as unknown as AbortSignal, toolCallId: 'test', messages: [] }) as { tableCount: number; tables: Array<{ name: string; type: string; columns: Array<{ name: string; type: string; isPrimaryKey: boolean }> }>; error: null; hint: string }

      expect(result.hint).toContain('get_json_keys')
    })
  })

  describe('get_json_keys', () => {
    it('should fetch JSON keys from a column', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'name' }, { key: 'age' }, { key: 'email' }],
      })

      const result = await tools.get_json_keys.execute!(
        { table: 'users', column: 'metadata' },
        opts
      ) as JsonKeysResult

      expect(result.keys).toEqual(['name', 'age', 'email'])
      expect(result.keyCount).toBe(3)
      expect(result.error).toBeNull()
      expect(mockEnd).toHaveBeenCalled()
    })

    it('should filter to only objects to avoid array errors', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'name' }],
      })

      await tools.get_json_keys.execute!(
        { table: 'users', column: 'metadata' },
        opts
      )

      // Verify the SQL includes jsonb_typeof filter to handle arrays gracefully
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(`jsonb_typeof("metadata"::jsonb) = 'object'`)
      )
    })

    it('should fetch JSON keys with nested path', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ key: 'street' }, { key: 'city' }],
      })

      const result = await tools.get_json_keys.execute!(
        { table: 'users', column: 'metadata', nestedPath: 'address' },
        opts
      ) as JsonKeysResult

      expect(result.nestedPath).toBe('address')
      expect(result.keys).toEqual(['street', 'city'])
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining(`"metadata"->'address'`)
      )
    })

    it('should fetch sample values when requested', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ key: 'name' }, { key: 'age' }] })
        .mockResolvedValueOnce({ rows: [{ value: 'John' }, { value: 'Jane' }] })
        .mockResolvedValueOnce({ rows: [{ value: '25' }, { value: '30' }] })

      const result = await tools.get_json_keys.execute!(
        { table: 'users', column: 'metadata', sampleValues: true },
        opts
      ) as JsonKeysResult

      expect(result.sampleValues).toEqual({
        name: ['John', 'Jane'],
        age: ['25', '30'],
      })
    })

    it('should handle empty JSON column', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const result = await tools.get_json_keys.execute!(
        { table: 'users', column: 'metadata' },
        opts
      ) as JsonKeysResult

      expect(result.keys).toEqual([])
      expect(result.keyCount).toBe(0)
      expect(result.hint).toContain('No keys found')
    })

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Column not found'))

      const result = await tools.get_json_keys.execute!(
        { table: 'users', column: 'nonexistent' },
        opts
      ) as JsonKeysResult

      expect(result.error).toBe('Column not found')
      expect(result.keys).toBeNull()
      expect(result.suggestion).toContain('Check that the table and column names are correct')
    })
  })

  describe('execute_query', () => {
    it('should execute a valid SELECT query', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }],
        fields: [{ name: 'id', dataTypeID: 23 }, { name: 'name', dataTypeID: 25 }],
        rowCount: 2,
      })

      const result = await tools.execute_query.execute!(
        { sql: 'SELECT * FROM users', title: 'All Users', description: 'Fetches all users' },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(true)
      expect(result.rowCount).toBe(2)
      expect(result.columns).toEqual(['id', 'name'])
      expect(result.rows).toEqual([{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }])
      expect(result.title).toBe('All Users')
    })

    it('should reject DELETE queries', async () => {
      const result = await tools.execute_query.execute!(
        { sql: 'DELETE FROM users WHERE id = 1', title: 'Delete User', description: 'Deletes a user' },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only SELECT queries are allowed')
      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('should reject DROP queries', async () => {
      const result = await tools.execute_query.execute!(
        { sql: 'DROP TABLE users', title: 'Drop Table', description: 'Drops users table' },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only SELECT queries are allowed')
    })

    it('should reject INSERT queries', async () => {
      const result = await tools.execute_query.execute!(
        { sql: "INSERT INTO users (name) VALUES ('test')", title: 'Insert', description: 'Inserts user' },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only SELECT queries are allowed')
    })

    it('should reject UPDATE queries', async () => {
      const result = await tools.execute_query.execute!(
        { sql: "UPDATE users SET name = 'test' WHERE id = 1", title: 'Update', description: 'Updates user' },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only SELECT queries are allowed')
    })

    it('should reject TRUNCATE queries', async () => {
      const result = await tools.execute_query.execute!(
        { sql: 'TRUNCATE TABLE users', title: 'Truncate', description: 'Truncates table' },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only SELECT queries are allowed')
    })

    it('should reject ALTER queries', async () => {
      const result = await tools.execute_query.execute!(
        { sql: 'ALTER TABLE users ADD COLUMN age INT', title: 'Alter', description: 'Alters table' },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only SELECT queries are allowed')
    })

    it('should reject CREATE queries', async () => {
      const result = await tools.execute_query.execute!(
        { sql: 'CREATE TABLE test (id INT)', title: 'Create', description: 'Creates table' },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only SELECT queries are allowed')
    })

    it('should reject GRANT queries', async () => {
      const result = await tools.execute_query.execute!(
        { sql: 'GRANT SELECT ON users TO test_user', title: 'Grant', description: 'Grants access' },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only SELECT queries are allowed')
    })

    it('should reject queries not starting with SELECT, WITH, or EXPLAIN', async () => {
      const result = await tools.execute_query.execute!(
        { sql: 'SHOW TABLES', title: 'Show', description: 'Shows tables' },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('Query must start with SELECT, WITH, or EXPLAIN')
    })

    it('should add LIMIT if not present', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        fields: [],
        rowCount: 0,
      })

      await tools.execute_query.execute!(
        { sql: 'SELECT * FROM users', title: 'Test', description: 'Test query' },
        opts
      )

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 100')
      )
    })

    it('should respect custom limit', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        fields: [],
        rowCount: 0,
      })

      await tools.execute_query.execute!(
        { sql: 'SELECT * FROM users', title: 'Test', description: 'Test', limit: 50 },
        opts
      )

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 50')
      )
    })

    it('should cap limit at 1000', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        fields: [],
        rowCount: 0,
      })

      await tools.execute_query.execute!(
        { sql: 'SELECT * FROM users', title: 'Test', description: 'Test', limit: 5000 },
        opts
      )

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 1000')
      )
    })

    it('should preserve existing LIMIT', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        fields: [],
        rowCount: 0,
      })

      await tools.execute_query.execute!(
        { sql: 'SELECT * FROM users LIMIT 10', title: 'Test', description: 'Test' },
        opts
      )

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users LIMIT 10')
    })

    it('should remove trailing semicolon', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        fields: [],
        rowCount: 0,
      })

      await tools.execute_query.execute!(
        { sql: 'SELECT * FROM users;', title: 'Test', description: 'Test' },
        opts
      )

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users LIMIT 100')
    })

    it('should allow WITH (CTE) queries', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ total: 100 }],
        fields: [{ name: 'total', dataTypeID: 20 }],
        rowCount: 1,
      })

      const result = await tools.execute_query.execute!(
        {
          sql: 'WITH active AS (SELECT * FROM users WHERE active = true) SELECT COUNT(*) as total FROM active',
          title: 'Active Count',
          description: 'Counts active users'
        },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(true)
    })

    it('should allow EXPLAIN queries', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ 'QUERY PLAN': 'Seq Scan on users' }],
        fields: [{ name: 'QUERY PLAN', dataTypeID: 25 }],
        rowCount: 1,
      })

      const result = await tools.execute_query.execute!(
        {
          sql: 'EXPLAIN SELECT * FROM users',
          title: 'Query Plan',
          description: 'Shows query plan'
        },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(true)
    })

    it('should detect empty columns', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, name: null },
          { id: 2, name: null },
        ],
        fields: [
          { name: 'id', dataTypeID: 23 },
          { name: 'name', dataTypeID: 25 },
        ],
        rowCount: 2,
      })

      const result = await tools.execute_query.execute!(
        { sql: 'SELECT id, name FROM users', title: 'Test', description: 'Test' },
        opts
      ) as ExecuteQueryResult

      expect(result.warning).toContain('name')
      expect(result.emptyColumns).toContain('name')
    })

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('column "nonexistent" does not exist'))

      const result = await tools.execute_query.execute!(
        { sql: 'SELECT nonexistent FROM users', title: 'Test', description: 'Test' },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('column')
      expect(result.suggestion).toContain('Check column names')
    })

    it('should handle syntax errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('syntax error at or near'))

      const result = await tools.execute_query.execute!(
        { sql: 'SELECTT * FROM users', title: 'Test', description: 'Test' },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(false)
      expect(result.suggestion).toContain('syntax error')
    })

    it('should return sample of first 5 rows', async () => {
      const manyRows = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }))
      mockQuery.mockResolvedValueOnce({
        rows: manyRows,
        fields: [{ name: 'id', dataTypeID: 23 }],
        rowCount: 10,
      })

      const result = await tools.execute_query.execute!(
        { sql: 'SELECT id FROM users', title: 'Test', description: 'Test' },
        opts
      ) as ExecuteQueryResult

      expect(result.rows).toHaveLength(5)
      expect(result.hasMoreRows).toBe(true)
    })

    it('should reject queries starting with comments', async () => {
      // Queries must literally start with SELECT/WITH/EXPLAIN
      const result = await tools.execute_query.execute!(
        {
          sql: '-- This is a comment about DELETE\nSELECT * FROM users',
          title: 'Test',
          description: 'Test'
        },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('Query must start with SELECT')
    })
  })

  describe('validate_query', () => {
    it('should validate a correct SELECT query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const result = await tools.validate_query.execute!(
        { sql: 'SELECT * FROM users' },
        opts
      ) as unknown as ValidateQueryResult

      expect(result.isValid).toBe(true)
      expect(result.message).toBe('Query is syntactically valid PostgreSQL')
      expect(mockQuery).toHaveBeenCalledWith('EXPLAIN SELECT * FROM users')
    })

    it('should validate WITH queries', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const result = await tools.validate_query.execute!(
        { sql: 'WITH cte AS (SELECT * FROM users) SELECT * FROM cte' },
        opts
      ) as unknown as ValidateQueryResult

      expect(result.isValid).toBe(true)
    })

    it('should reject non-SELECT queries', async () => {
      const result = await tools.validate_query.execute!(
        { sql: 'DROP TABLE users' },
        opts
      ) as unknown as ValidateQueryResult

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('must start with SELECT or WITH')
    })

    it('should reject mutation queries', async () => {
      const result = await tools.validate_query.execute!(
        { sql: 'DELETE FROM users' },
        opts
      ) as unknown as ValidateQueryResult

      expect(result.isValid).toBe(false)
      // DELETE doesn't start with SELECT or WITH, so it's rejected at the first check
      expect(result.error).toContain('must start with SELECT or WITH')
    })

    it('should handle column errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('column "bad" does not exist'))

      const result = await tools.validate_query.execute!(
        { sql: 'SELECT bad FROM users' },
        opts
      ) as unknown as ValidateQueryResult

      expect(result.isValid).toBe(false)
      expect(result.suggestion).toContain('column')
    })

    it('should handle relation errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('relation "bad_table" does not exist'))

      const result = await tools.validate_query.execute!(
        { sql: 'SELECT * FROM bad_table' },
        opts
      ) as unknown as ValidateQueryResult

      expect(result.isValid).toBe(false)
      expect(result.suggestion).toContain('table')
    })

    it('should handle syntax errors from database', async () => {
      mockQuery.mockRejectedValueOnce(new Error('syntax error at or near'))

      // Note: SELEC doesn't start with SELECT so it fails the first check
      // Let's use a valid-looking query that has a syntax error
      const result = await tools.validate_query.execute!(
        { sql: 'SELECT ** FROM users' },
        opts
      ) as unknown as ValidateQueryResult

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('syntax error')
    })

    it('should remove trailing semicolon before EXPLAIN', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      await tools.validate_query.execute!(
        { sql: 'SELECT * FROM users;' },
        opts
      )

      expect(mockQuery).toHaveBeenCalledWith('EXPLAIN SELECT * FROM users')
    })
  })

  describe('update_query_ui', () => {
    it('should return update action with SQL and explanation', async () => {
      const result = await tools.update_query_ui.execute!(
        {
          sql: 'SELECT * FROM users',
          explanation: 'This query returns all users',
          summary: 'Found 100 users in the database',
          assumptions: [],
        },
        opts
      ) as unknown as UpdateQueryUIResult

      expect(result.action).toBe('updateUI')
      expect(result.sql).toBe('SELECT * FROM users')
      expect(result.explanation).toBe('This query returns all users')
      expect(result.summary).toBe('Found 100 users in the database')
      expect(result.message).toBe('Query has been updated in the editor for user review.')
    })

    it('should include changes when provided', async () => {
      const result = await tools.update_query_ui.execute!(
        {
          sql: 'SELECT * FROM users WHERE active = true',
          explanation: 'Added filter for active users',
          summary: 'Now only showing active users',
          assumptions: [],
          changes: ['Added WHERE clause', 'Filtered by active status'],
        },
        opts
      ) as unknown as UpdateQueryUIResult

      expect(result.changes).toEqual(['Added WHERE clause', 'Filtered by active status'])
    })

    it('should include confidence level', async () => {
      const result = await tools.update_query_ui.execute!(
        {
          sql: 'SELECT * FROM users',
          explanation: 'Query',
          summary: 'Summary',
          assumptions: [],
          confidence: 'medium',
        },
        opts
      ) as unknown as UpdateQueryUIResult

      expect(result.confidence).toBe('medium')
    })

    it('should include suggestions', async () => {
      const result = await tools.update_query_ui.execute!(
        {
          sql: 'SELECT * FROM users',
          explanation: 'Query',
          summary: 'Summary',
          assumptions: [],
          suggestions: ['Add ORDER BY', 'Consider adding indexes'],
        },
        opts
      ) as unknown as UpdateQueryUIResult

      expect(result.suggestions).toEqual(['Add ORDER BY', 'Consider adding indexes'])
    })

    it('should use defaults for optional fields', async () => {
      const result = await tools.update_query_ui.execute!(
        {
          sql: 'SELECT * FROM users',
          explanation: 'Query',
          summary: 'Summary',
          assumptions: [],
        },
        opts
      ) as unknown as UpdateQueryUIResult

      expect(result.confidence).toBe('high')
      expect(result.changes).toEqual([])
      expect(result.suggestions).toEqual([])
    })
  })

  describe('generate_chart', () => {
    it('should generate a column chart for category + numeric data with many rows', async () => {
      // More than 10 rows triggers column chart instead of pie
      const data = Array.from({ length: 15 }, (_, i) => ({
        category: `Category ${i}`,
        value: (i + 1) * 10,
      }))

      const result = await tools.generate_chart.execute!(
        {
          data,
          columns: [
            { name: 'category', type: 'text' },
            { name: 'value', type: 'numeric' },
          ],
          title: 'Values by Category',
          description: 'Shows values for each category',
        },
        opts
      ) as unknown as GenerateChartResult

      expect(result.success).toBe(true)
      expect(result.chartConfig?.type).toBe('column')
      expect(result.chartConfig?.xAxis).toBe('category')
      expect(result.chartConfig?.yAxes).toEqual(['value'])
      expect(result.chartData).toHaveLength(15)
      expect(result.title).toBe('Values by Category')
    })

    it('should generate a donut chart for category + numeric data with few rows', async () => {
      // 10 or fewer rows with single text + single numeric triggers donut chart (enhanced pie)
      const data = [
        { category: 'A', value: 10 },
        { category: 'B', value: 20 },
        { category: 'C', value: 30 },
      ]

      const result = await tools.generate_chart.execute!(
        {
          data,
          columns: [
            { name: 'category', type: 'text' },
            { name: 'value', type: 'numeric' },
          ],
          title: 'Distribution',
          description: 'Shows distribution',
        },
        opts
      ) as unknown as GenerateChartResult

      expect(result.success).toBe(true)
      expect(result.chartConfig?.type).toBe('donut')
      expect(result.chartData).toHaveLength(3)
    })

    it('should generate a line chart for date + numeric data', async () => {
      const data = [
        { date: '2024-01-01', count: 10 },
        { date: '2024-01-02', count: 15 },
        { date: '2024-01-03', count: 20 },
      ]

      const result = await tools.generate_chart.execute!(
        {
          data,
          columns: [
            { name: 'date', type: 'date' },
            { name: 'count', type: 'numeric' },
          ],
          title: 'Count Over Time',
          description: 'Shows count trend',
        },
        opts
      ) as unknown as GenerateChartResult

      expect(result.success).toBe(true)
      expect(result.chartConfig?.type).toBe('line')
      expect(result.chartConfig?.xAxis).toBe('date')
    })

    it('should generate a column chart for multiple numeric columns', async () => {
      const data = Array.from({ length: 12 }, (_, i) => ({
        category: `Category ${i}`,
        value1: (i + 1) * 10,
        value2: (i + 1) * 5,
      }))

      const result = await tools.generate_chart.execute!(
        {
          data,
          columns: [
            { name: 'category', type: 'text' },
            { name: 'value1', type: 'numeric' },
            { name: 'value2', type: 'numeric' },
          ],
          title: 'Comparison',
          description: 'Compares values',
        },
        opts
      ) as unknown as GenerateChartResult

      expect(result.success).toBe(true)
      expect(result.chartConfig?.type).toBe('column')
      expect(result.chartConfig?.yAxes).toEqual(['value1', 'value2'])
    })

    it('should allow chart type override', async () => {
      const data = [
        { category: 'A', value: 10 },
        { category: 'B', value: 20 },
      ]

      const result = await tools.generate_chart.execute!(
        {
          data,
          columns: [
            { name: 'category', type: 'text' },
            { name: 'value', type: 'numeric' },
          ],
          title: 'Test',
          description: 'Test',
          chartType: 'area',
        },
        opts
      ) as unknown as GenerateChartResult

      expect(result.chartConfig?.type).toBe('area')
    })

    it('should allow axis overrides', async () => {
      const data = [
        { a: 1, b: 2, c: 3 },
        { a: 4, b: 5, c: 6 },
      ]

      const result = await tools.generate_chart.execute!(
        {
          data,
          columns: [
            { name: 'a', type: 'numeric' },
            { name: 'b', type: 'numeric' },
            { name: 'c', type: 'numeric' },
          ],
          title: 'Test',
          description: 'Test',
          xAxis: 'a',
          yAxes: ['b', 'c'],
        },
        opts
      ) as unknown as GenerateChartResult

      expect(result.chartConfig?.xAxis).toBe('a')
      expect(result.chartConfig?.yAxes).toEqual(['b', 'c'])
    })

    it('should handle empty data', async () => {
      const result = await tools.generate_chart.execute!(
        {
          data: [],
          columns: [{ name: 'x', type: 'text' }],
          title: 'Empty',
          description: 'Empty chart',
        },
        opts
      ) as unknown as GenerateChartResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('No data provided')
    })

    it('should handle text-only data gracefully', async () => {
      // With no numeric columns, chart generation still succeeds but with empty yAxes
      // The visualization layer will handle the display appropriately
      const data = [
        { text1: 'a', text2: 'b' },
      ]

      const result = await tools.generate_chart.execute!(
        {
          data,
          columns: [
            { name: 'text1', type: 'text' },
            { name: 'text2', type: 'text' },
          ],
          title: 'Test',
          description: 'Test',
        },
        opts
      ) as unknown as GenerateChartResult

      // Now succeeds with lenient handling - yAxes may be empty
      expect(result.success).toBe(true)
      expect(result.chartConfig?.xAxis).toBe('text1')
      expect(result.chartConfig?.yAxes).toEqual([])
    })

    it('should support stacked charts', async () => {
      const data = [
        { category: 'A', value1: 10, value2: 5 },
      ]

      const result = await tools.generate_chart.execute!(
        {
          data,
          columns: [
            { name: 'category', type: 'text' },
            { name: 'value1', type: 'numeric' },
            { name: 'value2', type: 'numeric' },
          ],
          title: 'Test',
          description: 'Test',
          stacked: true,
        },
        opts
      ) as unknown as GenerateChartResult

      expect(result.chartConfig?.stacked).toBe(true)
    })

    it('should convert string numbers to actual numbers', async () => {
      const data = [
        { category: 'A', value: '10.5' },
        { category: 'B', value: '20.3' },
      ]

      const result = await tools.generate_chart.execute!(
        {
          data,
          columns: [
            { name: 'category', type: 'text' },
            { name: 'value', type: 'numeric' },
          ],
          title: 'Test',
          description: 'Test',
        },
        opts
      ) as unknown as GenerateChartResult

      expect(result.success).toBe(true)
      expect(result.chartData?.[0].value).toBe(10.5)
      expect(result.chartData?.[1].value).toBe(20.3)
    })
  })

  describe('manage_todo', () => {
    it('should create a todo list', async () => {
      const result = await tools.manage_todo.execute!(
        {
          action: 'create',
          items: ['Get schema', 'Build query', 'Test query'],
        },
        opts
      ) as ManageTodoResult

      expect(result.success).toBe(true)
      expect(result.action).toBe('create')
      expect(result.items).toHaveLength(3)
      expect(result.items?.[0].text).toBe('Get schema')
      expect(result.items?.[0].status).toBe('in_progress')
      expect(result.items?.[1].status).toBe('pending')
      expect(result.items?.[2].status).toBe('pending')
      expect(result.message).toContain('3 items')
    })

    it('should fail create without items', async () => {
      const result = await tools.manage_todo.execute!(
        {
          action: 'create',
          items: [],
        },
        opts
      ) as ManageTodoResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('Must provide items')
    })

    it('should set current item', async () => {
      const result = await tools.manage_todo.execute!(
        {
          action: 'set_current',
          item_id: 'todo-123',
        },
        opts
      ) as ManageTodoResult

      expect(result.success).toBe(true)
      expect(result.action).toBe('set_current')
      expect(result.item_id).toBe('todo-123')
    })

    it('should fail set_current without item_id', async () => {
      const result = await tools.manage_todo.execute!(
        {
          action: 'set_current',
        },
        opts
      ) as ManageTodoResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('Must provide item_id')
    })

    it('should complete an item', async () => {
      const result = await tools.manage_todo.execute!(
        {
          action: 'complete',
          item_id: 'todo-456',
        },
        opts
      ) as ManageTodoResult

      expect(result.success).toBe(true)
      expect(result.action).toBe('complete')
      expect(result.item_id).toBe('todo-456')
      expect(result.message).toContain('completed')
    })

    it('should fail complete without item_id', async () => {
      const result = await tools.manage_todo.execute!(
        {
          action: 'complete',
        },
        opts
      ) as ManageTodoResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('Must provide item_id')
    })

    it('should skip an item', async () => {
      const result = await tools.manage_todo.execute!(
        {
          action: 'skip',
          item_id: 'todo-789',
        },
        opts
      ) as ManageTodoResult

      expect(result.success).toBe(true)
      expect(result.action).toBe('skip')
      expect(result.item_id).toBe('todo-789')
      expect(result.message).toContain('Skipped')
    })

    it('should fail skip without item_id', async () => {
      const result = await tools.manage_todo.execute!(
        {
          action: 'skip',
        },
        opts
      ) as ManageTodoResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('Must provide item_id')
    })

    it('should add a new item', async () => {
      const result = await tools.manage_todo.execute!(
        {
          action: 'add',
          item_text: 'New task discovered',
        },
        opts
      ) as ManageTodoResult

      expect(result.success).toBe(true)
      expect(result.action).toBe('add')
      expect(result.item?.text).toBe('New task discovered')
      expect(result.item?.status).toBe('pending')
      expect(result.item?.addedDuringExecution).toBe(true)
      expect(result.message).toContain('Added new todo')
    })

    it('should fail add without item_text', async () => {
      const result = await tools.manage_todo.execute!(
        {
          action: 'add',
        },
        opts
      ) as ManageTodoResult

      expect(result.success).toBe(false)
      expect(result.error).toContain('Must provide item_text')
    })
  })

  describe('Dangerous SQL patterns', () => {
    const dangerousQueries = [
      { sql: 'DELETE FROM users', pattern: 'DELETE FROM' },
      { sql: 'DROP TABLE users', pattern: 'DROP TABLE' },
      { sql: 'DROP DATABASE test', pattern: 'DROP DATABASE' },
      { sql: 'DROP SCHEMA public', pattern: 'DROP SCHEMA' },
      { sql: 'DROP INDEX idx_users', pattern: 'DROP INDEX' },
      { sql: 'DROP VIEW active_users', pattern: 'DROP VIEW' },
      { sql: 'DROP FUNCTION my_func', pattern: 'DROP FUNCTION' },
      { sql: 'DROP TRIGGER my_trigger', pattern: 'DROP TRIGGER' },
      { sql: 'TRUNCATE users', pattern: 'TRUNCATE' },
      { sql: 'TRUNCATE TABLE users', pattern: 'TRUNCATE TABLE' },
      { sql: 'ALTER TABLE users ADD COLUMN age INT', pattern: 'ALTER TABLE' },
      { sql: 'ALTER DATABASE test SET timezone', pattern: 'ALTER DATABASE' },
      { sql: 'ALTER SCHEMA public RENAME TO old', pattern: 'ALTER SCHEMA' },
      { sql: 'CREATE TABLE test (id INT)', pattern: 'CREATE TABLE' },
      { sql: 'CREATE DATABASE newdb', pattern: 'CREATE DATABASE' },
      { sql: 'CREATE SCHEMA newschema', pattern: 'CREATE SCHEMA' },
      { sql: 'CREATE INDEX idx ON users(id)', pattern: 'CREATE INDEX' },
      { sql: "INSERT INTO users (name) VALUES ('test')", pattern: 'INSERT INTO' },
      { sql: "UPDATE users SET name = 'test'", pattern: 'UPDATE SET' },
      { sql: 'GRANT SELECT ON users TO test_user', pattern: 'GRANT' },
      { sql: 'REVOKE ALL PRIVILEGES ON users', pattern: 'REVOKE' },
      { sql: "EXECUTE('SELECT 1')", pattern: 'EXECUTE' },
      { sql: 'EXEC(sql_string)', pattern: 'EXEC' },
      { sql: 'CALL my_procedure()', pattern: 'CALL' },
    ]

    for (const { sql, pattern } of dangerousQueries) {
      it(`should reject ${pattern}`, async () => {
        const result = await tools.execute_query.execute!(
          { sql, title: 'Test', description: 'Test' },
          opts
        ) as ExecuteQueryResult

        expect(result.success).toBe(false)
        expect(result.error).toContain('Only SELECT queries are allowed')
      })
    }

    it('should allow SELECT statements with dangerous words as column names', async () => {
      // The isMutationQuery checks for dangerous patterns like DELETE FROM, DROP TABLE etc.
      // A column named 'delete_count' should NOT trigger the block since it's not 'DELETE FROM'
      mockQuery.mockResolvedValueOnce({
        rows: [],
        fields: [],
        rowCount: 0,
      })

      const result = await tools.execute_query.execute!(
        {
          sql: 'SELECT delete_count, drop_flag FROM audit_log',
          title: 'Test',
          description: 'Test'
        },
        opts
      ) as ExecuteQueryResult

      expect(result.success).toBe(true)
    })

    it('should block queries that contain dangerous patterns even within comments for safety', async () => {
      // Block comment contains DROP - query must start with SELECT anyway
      const result = await tools.execute_query.execute!(
        {
          sql: '/* DROP TABLE users */ SELECT * FROM users',
          title: 'Test',
          description: 'Test'
        },
        opts
      ) as ExecuteQueryResult

      // Query doesn't start with SELECT so it's rejected
      expect(result.success).toBe(false)
      expect(result.error).toContain('Query must start with SELECT')
    })

    it('should strip comments when checking for dangerous mutation patterns', async () => {
      // Test that isMutationQuery strips comments correctly
      mockQuery.mockResolvedValueOnce({
        rows: [],
        fields: [],
        rowCount: 0,
      })

      // A SELECT query that mentions DELETE in comments should pass the mutation check
      // Note: it still must START with SELECT
      const result = await tools.execute_query.execute!(
        {
          sql: "SELECT * FROM users -- DELETE FROM logs",
          title: 'Test',
          description: 'Test'
        },
        opts
      ) as ExecuteQueryResult

      // This passes because the query starts with SELECT and the comment is stripped
      // before checking for dangerous patterns
      expect(result.success).toBe(true)
    })
  })
})
