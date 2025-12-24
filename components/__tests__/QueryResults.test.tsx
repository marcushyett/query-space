import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryResults } from '../QueryResults'
import { useQueryStore } from '@/stores/queryStore'
import { ConfigProvider } from 'antd'

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    message: {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
  }
})

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <ConfigProvider>{component}</ConfigProvider>
  )
}

describe('QueryResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useQueryStore.setState({
      queryResults: null,
      isExecuting: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should show prompt to execute query when no results', () => {
      renderWithProviders(<QueryResults />)
      expect(screen.getByText(/Execute a query to see results/i)).toBeInTheDocument()
    })

    it('should show keyboard shortcut hint', () => {
      renderWithProviders(<QueryResults />)
      expect(screen.getByText(/Cmd\+Enter/)).toBeInTheDocument()
    })
  })

  describe('executing state', () => {
    beforeEach(() => {
      useQueryStore.setState({ isExecuting: true })
    })

    it('should show executing message', () => {
      renderWithProviders(<QueryResults />)
      expect(screen.getByText('Executing query...')).toBeInTheDocument()
    })
  })

  describe('empty results', () => {
    beforeEach(() => {
      useQueryStore.setState({
        queryResults: {
          rows: [],
          fields: [],
          rowCount: 0,
          executionTime: 42,
        },
      })
    })

    it('should show success message for empty results', () => {
      renderWithProviders(<QueryResults />)
      expect(screen.getByText('Query executed successfully')).toBeInTheDocument()
    })

    it('should show execution time for empty results', () => {
      renderWithProviders(<QueryResults />)
      expect(screen.getByText(/42ms/)).toBeInTheDocument()
    })
  })

  describe('with results', () => {
    const mockResults = {
      rows: [
        { id: 1, name: 'Alice', email: 'alice@test.com' },
        { id: 2, name: 'Bob', email: 'bob@test.com' },
      ],
      fields: [
        { name: 'id', dataTypeID: 23 },
        { name: 'name', dataTypeID: 1043 },
        { name: 'email', dataTypeID: 1043 },
      ],
      rowCount: 2,
      executionTime: 15,
    }

    beforeEach(() => {
      useQueryStore.setState({ queryResults: mockResults })
    })

    it('should display row count', () => {
      renderWithProviders(<QueryResults />)
      expect(screen.getByText('2 rows')).toBeInTheDocument()
    })

    it('should display execution time', () => {
      renderWithProviders(<QueryResults />)
      expect(screen.getByText('15ms')).toBeInTheDocument()
    })

    it('should display column headers', () => {
      renderWithProviders(<QueryResults />)
      // Column headers in antd table
      const columnHeaders = screen.getAllByRole('columnheader')
      const headerTexts = columnHeaders.map(h => h.textContent)
      expect(headerTexts).toContain('id')
      expect(headerTexts).toContain('name')
      expect(headerTexts).toContain('email')
    })

    it('should display row data', () => {
      renderWithProviders(<QueryResults />)
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('alice@test.com')).toBeInTheDocument()
    })
  })

  describe('with single row', () => {
    beforeEach(() => {
      useQueryStore.setState({
        queryResults: {
          rows: [{ id: 1 }],
          fields: [{ name: 'id', dataTypeID: 23 }],
          rowCount: 1,
          executionTime: 5,
        },
      })
    })

    it('should show singular "row" for single result', () => {
      renderWithProviders(<QueryResults />)
      expect(screen.getByText('1 row')).toBeInTheDocument()
    })
  })

  describe('with null values', () => {
    beforeEach(() => {
      useQueryStore.setState({
        queryResults: {
          rows: [{ id: 1, name: null }],
          fields: [
            { name: 'id', dataTypeID: 23 },
            { name: 'name', dataTypeID: 1043 },
          ],
          rowCount: 1,
          executionTime: 5,
        },
      })
    })

    it('should display NULL for null values', () => {
      renderWithProviders(<QueryResults />)
      expect(screen.getByText('NULL')).toBeInTheDocument()
    })
  })

  describe('with object values', () => {
    beforeEach(() => {
      useQueryStore.setState({
        queryResults: {
          rows: [{ id: 1, data: { foo: 'bar' } }],
          fields: [
            { name: 'id', dataTypeID: 23 },
            { name: 'data', dataTypeID: 3802 },
          ],
          rowCount: 1,
          executionTime: 5,
        },
      })
    })

    it('should stringify object values', () => {
      renderWithProviders(<QueryResults />)
      expect(screen.getByText('{"foo":"bar"}')).toBeInTheDocument()
    })
  })
})
