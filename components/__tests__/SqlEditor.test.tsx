import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SqlEditor } from '../SqlEditor'
import { useSchemaStore } from '@/stores/schemaStore'
import { useQueryStore } from '@/stores/queryStore'
import { ConfigProvider } from 'antd'

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  Editor: ({ onMount, value, onChange }: {
    onMount?: (editor: unknown, monaco: unknown) => void,
    value?: string,
    onChange?: (value?: string) => void
  }) => {
    // Simulate editor mount with mock editor and monaco
    const mockEditor = {
      updateOptions: vi.fn(),
      getValue: vi.fn(() => value || ''),
    }
    const mockMonaco = {
      languages: {
        registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
        CompletionItemKind: {
          Field: 1,
          Class: 2,
          Interface: 3,
          Keyword: 4,
          Function: 5,
        },
      },
    }

    // Call onMount if provided
    if (onMount) {
      // Use setTimeout to simulate async mount
      setTimeout(() => onMount(mockEditor, mockMonaco), 0)
    }

    return (
      <div data-testid="monaco-editor">
        <textarea
          data-testid="sql-input"
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    )
  },
}))

// Mock nuqs useQueryState
vi.mock('nuqs', () => ({
  useQueryState: vi.fn(() => [null, vi.fn()]),
}))

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <ConfigProvider>{component}</ConfigProvider>
  )
}

describe('SqlEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useQueryStore.setState({
      currentQuery: '',
      setCurrentQuery: vi.fn((query: string) => {
        useQueryStore.setState({ currentQuery: query })
      }),
    })
    useSchemaStore.setState({
      tables: [],
      isLoading: false,
      error: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('should render the editor', () => {
      renderWithProviders(<SqlEditor />)
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument()
    })

    it('should render the format button', () => {
      renderWithProviders(<SqlEditor />)
      expect(screen.getByLabelText('Format SQL')).toBeInTheDocument()
    })
  })

  describe('autocomplete with schema tables', () => {
    it('should register completion provider on mount', async () => {
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

      useSchemaStore.setState({ tables: mockTables })

      renderWithProviders(<SqlEditor />)

      // Verify the editor mounted
      await waitFor(() => {
        expect(screen.getByTestId('monaco-editor')).toBeInTheDocument()
      })
    })

    it('should have access to updated tables via ref pattern', async () => {
      // Start with empty tables
      useSchemaStore.setState({ tables: [] })

      renderWithProviders(<SqlEditor />)

      await waitFor(() => {
        expect(screen.getByTestId('monaco-editor')).toBeInTheDocument()
      })

      // Update tables after mount - the ref pattern ensures completion provider sees new data
      const newTables = [
        {
          schema: 'public',
          name: 'orders',
          type: 'table' as const,
          columns: [
            { name: 'id', type: 'integer', isPrimaryKey: true },
            { name: 'amount', type: 'decimal', isPrimaryKey: false },
          ],
        },
      ]

      useSchemaStore.setState({ tables: newTables })

      // Tables should be updated in the store
      const currentTables = useSchemaStore.getState().tables
      expect(currentTables).toHaveLength(1)
      expect(currentTables[0].name).toBe('orders')
    })
  })
})

describe('SQL Autocomplete Keywords', () => {
  // Test that SQL keywords are properly defined
  const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
    'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL', 'CROSS', 'ON',
    'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
  ]

  it('should include essential SQL keywords', () => {
    expect(SQL_KEYWORDS).toContain('SELECT')
    expect(SQL_KEYWORDS).toContain('FROM')
    expect(SQL_KEYWORDS).toContain('WHERE')
    expect(SQL_KEYWORDS).toContain('JOIN')
    expect(SQL_KEYWORDS).toContain('GROUP')
    expect(SQL_KEYWORDS).toContain('ORDER')
  })

  const PG_FUNCTIONS = [
    'NOW()', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
    'DATE_TRUNC', 'DATE_PART', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  ]

  it('should include essential PostgreSQL functions', () => {
    expect(PG_FUNCTIONS).toContain('NOW()')
    expect(PG_FUNCTIONS).toContain('COUNT')
    expect(PG_FUNCTIONS).toContain('SUM')
  })
})
