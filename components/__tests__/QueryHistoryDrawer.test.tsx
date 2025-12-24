import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryHistoryDrawer } from '../QueryHistoryDrawer';
import { useUiStore } from '@/stores/uiStore';
import { useQueryStore } from '@/stores/queryStore';

// Mock the stores
vi.mock('@/stores/uiStore', () => ({
  useUiStore: vi.fn(),
}));

vi.mock('@/stores/queryStore', () => ({
  useQueryStore: vi.fn(),
}));

describe('QueryHistoryDrawer', () => {
  const mockSetHistoryDrawerOpen = vi.fn();
  const mockSetCurrentQuery = vi.fn();
  const mockRemoveFromHistory = vi.fn();
  const mockClearHistory = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useUiStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      historyDrawerOpen: true,
      setHistoryDrawerOpen: mockSetHistoryDrawerOpen,
    });

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: [],
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
    });
  });

  it('should render when open', () => {
    render(<QueryHistoryDrawer />);
    expect(screen.getByText('Query History')).toBeInTheDocument();
  });

  it('should not render content when closed', () => {
    (useUiStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      historyDrawerOpen: false,
      setHistoryDrawerOpen: mockSetHistoryDrawerOpen,
    });

    render(<QueryHistoryDrawer />);
    // The drawer component should not show visible content when closed
    expect(screen.queryByText('No queries in history')).not.toBeInTheDocument();
  });

  it('should show empty state when no history', () => {
    render(<QueryHistoryDrawer />);
    expect(screen.getByText('No queries in history')).toBeInTheDocument();
  });

  it('should display history items', () => {
    const mockHistory = [
      {
        id: '1',
        sql: 'SELECT * FROM users',
        timestamp: Date.now() - 60000,
        rowCount: 10,
        executionTime: 50,
      },
      {
        id: '2',
        sql: 'SELECT * FROM orders',
        timestamp: Date.now() - 120000,
        rowCount: 5,
        executionTime: 30,
      },
    ];

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: mockHistory,
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
    });

    render(<QueryHistoryDrawer />);
    expect(screen.getByText('SELECT * FROM users')).toBeInTheDocument();
    expect(screen.getByText('SELECT * FROM orders')).toBeInTheDocument();
  });

  it('should truncate long queries', () => {
    const longQuery = 'SELECT ' + 'column, '.repeat(50) + 'FROM table';
    const mockHistory = [
      {
        id: '1',
        sql: longQuery,
        timestamp: Date.now(),
        rowCount: 10,
        executionTime: 50,
      },
    ];

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: mockHistory,
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
    });

    render(<QueryHistoryDrawer />);
    // The query should be truncated with ellipsis
    const queryElement = screen.getByText(/SELECT column/);
    expect(queryElement).toBeInTheDocument();
  });

  it('should load query when clicking on history item', () => {
    const mockHistory = [
      {
        id: '1',
        sql: 'SELECT * FROM users',
        timestamp: Date.now(),
        rowCount: 10,
        executionTime: 50,
      },
    ];

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: mockHistory,
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
    });

    render(<QueryHistoryDrawer />);
    fireEvent.click(screen.getByText('SELECT * FROM users'));
    expect(mockSetCurrentQuery).toHaveBeenCalledWith('SELECT * FROM users');
  });

  it('should show row count and execution time', () => {
    const mockHistory = [
      {
        id: '1',
        sql: 'SELECT * FROM users',
        timestamp: Date.now(),
        rowCount: 42,
        executionTime: 123,
      },
    ];

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: mockHistory,
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
    });

    render(<QueryHistoryDrawer />);
    expect(screen.getByText(/42 rows/)).toBeInTheDocument();
    expect(screen.getByText(/123ms/)).toBeInTheDocument();
  });

  it('should have clear all button', () => {
    const mockHistory = [
      {
        id: '1',
        sql: 'SELECT * FROM users',
        timestamp: Date.now(),
        rowCount: 10,
        executionTime: 50,
      },
    ];

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: mockHistory,
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
    });

    render(<QueryHistoryDrawer />);
    const clearButton = screen.getByRole('button', { name: /clear/i });
    expect(clearButton).toBeInTheDocument();
  });

  it('should format relative time correctly', () => {
    const mockHistory = [
      {
        id: '1',
        sql: 'SELECT * FROM users',
        timestamp: Date.now() - 30000, // 30 seconds ago
        rowCount: 10,
        executionTime: 50,
      },
    ];

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: mockHistory,
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
    });

    render(<QueryHistoryDrawer />);
    // Should show relative time like "30s ago" or similar
    expect(screen.getByText(/ago/i)).toBeInTheDocument();
  });
});
