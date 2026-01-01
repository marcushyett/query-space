import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryHistoryDrawer } from '../QueryHistoryDrawer';
import { useUiStore } from '@/stores/uiStore';
import { useQueryStore } from '@/stores/queryStore';
import { useAgentSessionStore } from '@/stores/agentSessionStore';
import { usePersistentAgent } from '@/hooks/usePersistentAgent';

// Mock the stores and hooks
vi.mock('@/stores/uiStore', () => ({
  useUiStore: vi.fn(),
}));

vi.mock('@/stores/queryStore', () => ({
  useQueryStore: vi.fn(),
}));

vi.mock('@/stores/agentSessionStore', () => ({
  useAgentSessionStore: vi.fn(),
}));

vi.mock('@/hooks/usePersistentAgent', () => ({
  usePersistentAgent: vi.fn(),
}));

describe('QueryHistoryDrawer', () => {
  const mockSetHistoryDrawerOpen = vi.fn();
  const mockSetCurrentQuery = vi.fn();
  const mockRemoveFromHistory = vi.fn();
  const mockClearHistory = vi.fn();
  const mockGetQueriesBySession = vi.fn().mockReturnValue([]);
  const mockResumeSession = vi.fn();
  const mockLoadConversationFromSession = vi.fn();

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
      getQueriesBySession: mockGetQueriesBySession,
    });

    (useAgentSessionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sessions: {},
    });

    (usePersistentAgent as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      resumeSession: mockResumeSession,
      loadConversationFromSession: mockLoadConversationFromSession,
    });
  });

  it('should render when open', () => {
    render(<QueryHistoryDrawer />);
    expect(screen.getByText('History')).toBeInTheDocument();
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

  it('should display history items with source indicators', () => {
    const mockHistory = [
      {
        id: '1',
        sql: 'SELECT * FROM users',
        timestamp: Date.now() - 60000,
        rowCount: 10,
        executionTime: 50,
        source: 'manual' as const,
        success: true,
      },
      {
        id: '2',
        sql: 'SELECT * FROM orders',
        timestamp: Date.now() - 120000,
        rowCount: 5,
        executionTime: 30,
        source: 'ai' as const,
        success: true,
      },
    ];

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: mockHistory,
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
      getQueriesBySession: mockGetQueriesBySession,
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
        source: 'manual' as const,
        success: true,
      },
    ];

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: mockHistory,
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
      getQueriesBySession: mockGetQueriesBySession,
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
        source: 'manual' as const,
        success: true,
      },
    ];

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: mockHistory,
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
      getQueriesBySession: mockGetQueriesBySession,
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
        source: 'manual' as const,
        success: true,
      },
    ];

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: mockHistory,
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
      getQueriesBySession: mockGetQueriesBySession,
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
        source: 'manual' as const,
        success: true,
      },
    ];

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: mockHistory,
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
      getQueriesBySession: mockGetQueriesBySession,
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
        source: 'manual' as const,
        success: true,
      },
    ];

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: mockHistory,
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
      getQueriesBySession: mockGetQueriesBySession,
    });

    render(<QueryHistoryDrawer />);
    // Should show relative time like "30s ago" or similar
    expect(screen.getByText(/ago/i)).toBeInTheDocument();
  });

  it('should show source filter buttons', () => {
    const mockHistory = [
      {
        id: '1',
        sql: 'SELECT * FROM users',
        timestamp: Date.now(),
        rowCount: 10,
        executionTime: 50,
        source: 'manual' as const,
        success: true,
      },
      {
        id: '2',
        sql: 'SELECT * FROM orders',
        timestamp: Date.now(),
        rowCount: 5,
        executionTime: 30,
        source: 'ai' as const,
        success: true,
      },
    ];

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: mockHistory,
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
      getQueriesBySession: mockGetQueriesBySession,
    });

    render(<QueryHistoryDrawer />);
    // Check for filter buttons by their text content including count
    expect(screen.getByRole('button', { name: /All \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manual \(1\)/i })).toBeInTheDocument();
    // AI button has an icon which affects the accessible name
    expect(screen.getByRole('button', { name: /AI \(1\)/i })).toBeInTheDocument();
  });

  it('should show success indicator for successful queries', () => {
    const mockHistory = [
      {
        id: '1',
        sql: 'SELECT * FROM users',
        timestamp: Date.now(),
        rowCount: 10,
        executionTime: 50,
        source: 'manual' as const,
        success: true,
      },
    ];

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: mockHistory,
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
      getQueriesBySession: mockGetQueriesBySession,
    });

    render(<QueryHistoryDrawer />);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('should show error indicator for failed queries', () => {
    const mockHistory = [
      {
        id: '1',
        sql: 'SELECT * FROM nonexistent',
        timestamp: Date.now(),
        rowCount: null,
        executionTime: null,
        source: 'manual' as const,
        success: false,
        error: 'Table not found',
      },
    ];

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      queryHistory: mockHistory,
      setCurrentQuery: mockSetCurrentQuery,
      removeFromHistory: mockRemoveFromHistory,
      clearHistory: mockClearHistory,
      getQueriesBySession: mockGetQueriesBySession,
    });

    render(<QueryHistoryDrawer />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('should have tabs for Queries and AI Sessions', () => {
    render(<QueryHistoryDrawer />);
    expect(screen.getByText('Queries')).toBeInTheDocument();
    expect(screen.getByText('AI Sessions')).toBeInTheDocument();
  });

  it('should show empty state for AI sessions when none exist', () => {
    render(<QueryHistoryDrawer />);
    // Click on AI Sessions tab
    fireEvent.click(screen.getByText('AI Sessions'));
    expect(screen.getByText('No AI sessions yet')).toBeInTheDocument();
  });

  it('should display AI sessions', () => {
    const mockSessions = {
      'session-1': {
        id: 'session-1',
        goal: 'Find all users',
        status: 'completed' as const,
        createdAt: Date.now() - 120000,
        updatedAt: Date.now() - 60000,
        currentStep: 5,
        maxSteps: 25,
        toolCalls: [],
        todos: [
          { id: 'todo-1', text: 'Get schema', status: 'completed' as const, createdAt: Date.now() },
        ],
        currentSql: 'SELECT * FROM users',
        previousSql: null,
        lastStreamingText: '',
        lastError: null,
        resumptionContext: '',
        chatHistory: [],
      },
    };

    (useAgentSessionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sessions: mockSessions,
    });

    render(<QueryHistoryDrawer />);
    // Click on AI Sessions tab
    fireEvent.click(screen.getByText('AI Sessions'));
    expect(screen.getByText('Find all users')).toBeInTheDocument();
  });
});
