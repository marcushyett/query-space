import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryHistoryDrawer } from '../QueryHistoryDrawer';
import { useUiStore } from '@/stores/uiStore';
import { useQueryStore } from '@/stores/queryStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { usePersistentAgent } from '@/hooks/usePersistentAgent';
import type { HistoryItem } from '@/app/api/history/route';

// Mock the stores and hooks
vi.mock('@/stores/uiStore', () => ({
  useUiStore: vi.fn(),
}));

vi.mock('@/stores/queryStore', () => ({
  useQueryStore: vi.fn(),
}));

vi.mock('@/stores/connectionStore', () => ({
  useConnectionStore: vi.fn(),
}));

vi.mock('@/stores/agentSessionStore', () => ({
  getAgentSession: vi.fn(),
}));

vi.mock('@/hooks/usePersistentAgent', () => ({
  usePersistentAgent: vi.fn(),
}));

// Mock antd Grid hook for responsive behavior
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    Grid: {
      ...(actual as { Grid: object }).Grid,
      useBreakpoint: () => ({ md: true }),
    },
  };
});

describe('QueryHistoryDrawer', () => {
  const mockSetHistoryDrawerOpen = vi.fn();
  const mockSetCurrentQuery = vi.fn();
  const mockResumeSession = vi.fn();
  const mockLoadConversationFromSession = vi.fn();

  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch globally
    global.fetch = mockFetch;

    (useUiStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      historyDrawerOpen: true,
      setHistoryDrawerOpen: mockSetHistoryDrawerOpen,
      currentProjectId: 'project-1',
    });

    (useQueryStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      setCurrentQuery: mockSetCurrentQuery,
    });

    (useConnectionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      organizationId: 'org-1',
    });

    (usePersistentAgent as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      resumeSession: mockResumeSession,
      loadConversationFromSession: mockLoadConversationFromSession,
    });

    // Default empty response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [], counts: { queries: 0, executions: 0, sessions: 0 } }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render when open', async () => {
    render(<QueryHistoryDrawer />);
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('should not render content when closed', async () => {
    (useUiStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      historyDrawerOpen: false,
      setHistoryDrawerOpen: mockSetHistoryDrawerOpen,
      currentProjectId: 'project-1',
    });

    render(<QueryHistoryDrawer />);
    // The drawer component should not show visible content when closed
    await waitFor(() => {
      expect(screen.queryByText(/No history yet/)).not.toBeInTheDocument();
    });
  });

  it('should show empty state when no history', async () => {
    render(<QueryHistoryDrawer />);

    await waitFor(() => {
      expect(screen.getByText(/No history yet/)).toBeInTheDocument();
    });
  });

  it('should display history items with source indicators', async () => {
    const mockHistory: HistoryItem[] = [
      {
        type: 'execution',
        id: 'exec-1',
        sql: 'SELECT * FROM users',
        timestamp: Date.now() - 60000,
        rowCount: 10,
        executionTime: 50,
        source: 'manual',
        success: true,
      },
      {
        type: 'execution',
        id: 'exec-2',
        sql: 'SELECT * FROM orders',
        timestamp: Date.now() - 120000,
        rowCount: 5,
        executionTime: 30,
        source: 'ai',
        success: true,
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockHistory, counts: { queries: 0, executions: 2, sessions: 0 } }),
    });

    render(<QueryHistoryDrawer />);

    await waitFor(() => {
      expect(screen.getByText(/SELECT \* FROM users/)).toBeInTheDocument();
      expect(screen.getByText(/SELECT \* FROM orders/)).toBeInTheDocument();
    });
  });

  it('should truncate long queries', async () => {
    const longQuery = 'SELECT ' + 'column, '.repeat(50) + 'FROM table';
    const mockHistory: HistoryItem[] = [
      {
        type: 'execution',
        id: 'exec-1',
        sql: longQuery,
        timestamp: Date.now(),
        rowCount: 10,
        executionTime: 50,
        source: 'manual',
        success: true,
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockHistory, counts: { queries: 0, executions: 1, sessions: 0 } }),
    });

    render(<QueryHistoryDrawer />);

    await waitFor(() => {
      // The query should be truncated
      const queryElement = screen.getByText(/SELECT column/);
      expect(queryElement).toBeInTheDocument();
    });
  });

  it('should load query when clicking on history item', async () => {
    const mockHistory: HistoryItem[] = [
      {
        type: 'execution',
        id: 'exec-1',
        sql: 'SELECT * FROM users',
        timestamp: Date.now(),
        rowCount: 10,
        executionTime: 50,
        source: 'manual',
        success: true,
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockHistory, counts: { queries: 0, executions: 1, sessions: 0 } }),
    });

    render(<QueryHistoryDrawer />);

    await waitFor(() => {
      expect(screen.getByText(/SELECT \* FROM users/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/SELECT \* FROM users/));
    expect(mockSetCurrentQuery).toHaveBeenCalledWith('SELECT * FROM users');
  });

  it('should show row count and execution time', async () => {
    // The component groups executions by queryId - to see row count/execution time,
    // we need a query with executions that get grouped together
    const mockHistory: HistoryItem[] = [
      {
        type: 'query',
        id: 'query-1',
        queryId: 'query-1',
        queryName: 'User Query',
        sql: 'SELECT * FROM users',
        timestamp: Date.now(),
        projectId: 'project-1',
        projectName: 'Test Project',
      },
      {
        type: 'execution',
        id: 'exec-1',
        queryId: 'query-1',
        sql: 'SELECT * FROM users',
        timestamp: Date.now(),
        rowCount: 42,
        executionTime: 123,
        source: 'manual',
        success: true,
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockHistory, counts: { queries: 1, executions: 1, sessions: 0 } }),
    });

    render(<QueryHistoryDrawer />);

    // Wait for the query group to render
    await waitFor(() => {
      expect(screen.getByText('User Query')).toBeInTheDocument();
    });

    // The collapse panel shows execution counts - click to expand
    const queryPanel = screen.getByText('User Query').closest('.ant-collapse-header');
    if (queryPanel) {
      fireEvent.click(queryPanel);
    }

    // Now row count and execution time should be visible
    await waitFor(() => {
      expect(screen.getByText(/42 rows/)).toBeInTheDocument();
      expect(screen.getByText(/123ms/)).toBeInTheDocument();
    });
  });

  it('should have filter buttons', async () => {
    render(<QueryHistoryDrawer />);

    await waitFor(() => {
      // Check for filter buttons
      expect(screen.getByRole('button', { name: /All/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Queries/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /AI Sessions/i })).toBeInTheDocument();
    });
  });

  it('should format relative time correctly', async () => {
    const mockHistory: HistoryItem[] = [
      {
        type: 'execution',
        id: 'exec-1',
        sql: 'SELECT * FROM users',
        timestamp: Date.now() - 30000, // 30 seconds ago
        rowCount: 10,
        executionTime: 50,
        source: 'manual',
        success: true,
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockHistory, counts: { queries: 0, executions: 1, sessions: 0 } }),
    });

    render(<QueryHistoryDrawer />);

    await waitFor(() => {
      // Should show relative time like "30s ago" or similar
      expect(screen.getByText(/ago/i)).toBeInTheDocument();
    });
  });

  it('should have search input', async () => {
    render(<QueryHistoryDrawer />);

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/Search queries and sessions/i);
      expect(searchInput).toBeInTheDocument();
    });
  });

  it('should show success indicator for successful queries', async () => {
    const mockHistory: HistoryItem[] = [
      {
        type: 'execution',
        id: 'exec-1',
        sql: 'SELECT * FROM users',
        timestamp: Date.now(),
        rowCount: 10,
        executionTime: 50,
        source: 'manual',
        success: true,
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockHistory, counts: { queries: 0, executions: 1, sessions: 0 } }),
    });

    render(<QueryHistoryDrawer />);

    await waitFor(() => {
      expect(screen.getByText('OK')).toBeInTheDocument();
    });
  });

  it('should show error indicator for failed queries', async () => {
    const mockHistory: HistoryItem[] = [
      {
        type: 'execution',
        id: 'exec-1',
        sql: 'SELECT * FROM nonexistent',
        timestamp: Date.now(),
        source: 'manual',
        success: false,
        error: 'Table not found',
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockHistory, counts: { queries: 0, executions: 1, sessions: 0 } }),
    });

    render(<QueryHistoryDrawer />);

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  it('should show filter buttons including AI Sessions filter', async () => {
    render(<QueryHistoryDrawer />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Queries/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /AI Sessions/i })).toBeInTheDocument();
    });
  });

  it('should show empty state for AI sessions when none exist', async () => {
    render(<QueryHistoryDrawer />);

    await waitFor(() => {
      // Click on AI Sessions filter button
      const aiSessionsButton = screen.getByRole('button', { name: /AI Sessions/i });
      fireEvent.click(aiSessionsButton);
    });

    // With no sessions, empty state should still show
    await waitFor(() => {
      expect(screen.getByText(/No history yet/)).toBeInTheDocument();
    });
  });

  it('should display AI sessions', async () => {
    const mockHistory: HistoryItem[] = [
      {
        type: 'session',
        id: 'session-1',
        sessionId: 'session-1',
        goal: 'Find all users',
        status: 'completed',
        timestamp: Date.now() - 60000,
        queryCount: 3,
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockHistory, counts: { queries: 0, executions: 0, sessions: 1 } }),
    });

    render(<QueryHistoryDrawer />);

    await waitFor(() => {
      expect(screen.getByText('Find all users')).toBeInTheDocument();
    });
  });
});
