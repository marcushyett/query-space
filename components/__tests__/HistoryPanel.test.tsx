import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import type { HistoryItem } from '@/app/api/history/route'

// Use vi.hoisted for proper mock hoisting
const {
  mockOrganizationId,
  mockSetCurrentQuery,
  mockLoadConversationFromSession,
  mockResumeSession,
  mockReconnectToSession,
  mockSetAiChatOpen,
  mockMessage,
} = vi.hoisted(() => ({
  mockOrganizationId: 'org-1',
  mockSetCurrentQuery: vi.fn(),
  mockLoadConversationFromSession: vi.fn(),
  mockResumeSession: vi.fn(),
  mockReconnectToSession: vi.fn(),
  mockSetAiChatOpen: vi.fn(),
  mockMessage: { success: vi.fn(), error: vi.fn() },
}))

// Mock Ant Design App hook
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual as object,
    App: {
      ...(actual as { App: object }).App,
      useApp: () => ({ message: mockMessage }),
    },
    Grid: {
      useBreakpoint: () => ({ md: true }),
    },
  }
})

// Mock stores
vi.mock('@/stores/connectionStore', () => ({
  useConnectionStore: () => ({ organizationId: mockOrganizationId }),
}))

vi.mock('@/stores/queryStore', () => ({
  useQueryStore: () => ({ setCurrentQuery: mockSetCurrentQuery }),
}))

vi.mock('@/stores/aiChatStore', () => ({
  useAiChatStore: () => ({ setOpen: mockSetAiChatOpen }),
}))

vi.mock('@/hooks/usePersistentAgent', () => ({
  usePersistentAgent: () => ({
    loadConversationFromSession: mockLoadConversationFromSession,
    resumeSession: mockResumeSession,
    reconnectToSession: mockReconnectToSession,
  }),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

import { HistoryPanel } from '../HistoryPanel'

describe('HistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [], counts: { queries: 0, executions: 0, sessions: 0 } }),
    })
  })

  describe('session status filtering', () => {
    const createHistoryItems = (statuses: string[]): HistoryItem[] => {
      return statuses.map((status, idx) => ({
        type: 'session' as const,
        id: `session-${idx}`,
        sessionId: `session-${idx}`,
        timestamp: Date.now() - idx * 1000,
        goal: `Session ${status}`,
        status: status as 'pending' | 'running' | 'paused' | 'completed' | 'failed',
        queryCount: 0,
      }))
    }

    it('should show pending sessions in active sessions list', async () => {
      const items = createHistoryItems(['pending'])
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items, counts: { queries: 0, executions: 0, sessions: 1 } }),
      })

      render(<HistoryPanel open={true} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument()
        expect(screen.getByText(/Session pending/)).toBeInTheDocument()
      })
    })

    it('should show running sessions in active sessions list', async () => {
      const items = createHistoryItems(['running'])
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items, counts: { queries: 0, executions: 0, sessions: 1 } }),
      })

      render(<HistoryPanel open={true} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument()
        expect(screen.getByText(/Session running/)).toBeInTheDocument()
      })
    })

    it('should show paused sessions in active sessions list', async () => {
      const items = createHistoryItems(['paused'])
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items, counts: { queries: 0, executions: 0, sessions: 1 } }),
      })

      render(<HistoryPanel open={true} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument()
        expect(screen.getByText(/Session paused/)).toBeInTheDocument()
      })
    })

    it('should show all active sessions (pending, running, paused) together', async () => {
      const items = createHistoryItems(['pending', 'running', 'paused'])
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items, counts: { queries: 0, executions: 0, sessions: 3 } }),
      })

      render(<HistoryPanel open={true} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument()
        expect(screen.getByText(/Session pending/)).toBeInTheDocument()
        expect(screen.getByText(/Session running/)).toBeInTheDocument()
        expect(screen.getByText(/Session paused/)).toBeInTheDocument()
      })
    })

    it('should show completed and failed sessions in recent activity', async () => {
      const items = createHistoryItems(['completed', 'failed'])
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items, counts: { queries: 0, executions: 0, sessions: 2 } }),
      })

      render(<HistoryPanel open={true} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Recent Activity')).toBeInTheDocument()
        expect(screen.getByText(/Session completed/)).toBeInTheDocument()
        expect(screen.getByText(/Session failed/)).toBeInTheDocument()
      })
    })

    it('should separate active and completed sessions correctly', async () => {
      const items = createHistoryItems(['running', 'completed', 'pending', 'failed', 'paused'])
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items, counts: { queries: 0, executions: 0, sessions: 5 } }),
      })

      render(<HistoryPanel open={true} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Active Sessions')).toBeInTheDocument()
        expect(screen.getByText('Recent Activity')).toBeInTheDocument()
      })
    })
  })

  describe('API integration', () => {
    it('should fetch history with organizationId when opened', async () => {
      render(<HistoryPanel open={true} onClose={() => {}} />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('organizationId=org-1')
        )
      })
    })

    it('should include projectId in fetch when provided', async () => {
      render(<HistoryPanel open={true} onClose={() => {}} projectId="project-123" />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('projectId=project-123')
        )
      })
    })

    it('should include queryId in fetch when provided', async () => {
      render(<HistoryPanel open={true} onClose={() => {}} queryId="query-456" />)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('queryId=query-456')
        )
      })
    })

    it('should show error message when API fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Access denied' }),
      })

      render(<HistoryPanel open={true} onClose={() => {}} />)

      await waitFor(() => {
        expect(mockMessage.error).toHaveBeenCalledWith(
          expect.stringContaining('Access denied')
        )
      })
    })
  })

  describe('session display', () => {
    it('should display session goal in the list', async () => {
      const items: HistoryItem[] = [{
        type: 'session',
        id: 'session-1',
        sessionId: 'session-1',
        timestamp: Date.now(),
        goal: 'Create a user analytics query',
        status: 'completed',
        queryCount: 3,
        queryId: 'query-1',
        projectId: 'project-1',
        projectName: 'My Project',
      }]

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items, counts: { queries: 0, executions: 0, sessions: 1 } }),
      })

      render(<HistoryPanel open={true} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(/Create a user analytics query/)).toBeInTheDocument()
      })
    })

    it('should display query count for sessions', async () => {
      const items: HistoryItem[] = [{
        type: 'session',
        id: 'session-1',
        sessionId: 'session-1',
        timestamp: Date.now(),
        goal: 'Test session',
        status: 'completed',
        queryCount: 5,
      }]

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items, counts: { queries: 0, executions: 0, sessions: 1 } }),
      })

      render(<HistoryPanel open={true} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText(/5 queries/)).toBeInTheDocument()
      })
    })

    it('should display project name for sessions', async () => {
      const items: HistoryItem[] = [{
        type: 'session',
        id: 'session-1',
        sessionId: 'session-1',
        timestamp: Date.now(),
        goal: 'Test session',
        status: 'completed',
        queryCount: 0,
        projectName: 'Test Project',
      }]

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items, counts: { queries: 0, executions: 0, sessions: 1 } }),
      })

      render(<HistoryPanel open={true} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument()
      })
    })
  })

  describe('execution display', () => {
    it('should display execution in recent activity', async () => {
      const items: HistoryItem[] = [{
        type: 'execution',
        id: 'exec-1',
        timestamp: Date.now(),
        sql: 'SELECT * FROM users',
        source: 'ai',
        success: true,
        rowCount: 10,
        executionTime: 50,
        queryId: 'query-1',
        projectName: 'My Project',
      }]

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items, counts: { queries: 0, executions: 1, sessions: 0 } }),
      })

      render(<HistoryPanel open={true} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('Recent Activity')).toBeInTheDocument()
        expect(screen.getByText(/SELECT \* FROM users/)).toBeInTheDocument()
        expect(screen.getByText(/10 rows/)).toBeInTheDocument()
        expect(screen.getByText(/50ms/)).toBeInTheDocument()
      })
    })
  })

  describe('empty state', () => {
    it('should show empty state when no items', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [], counts: { queries: 0, executions: 0, sessions: 0 } }),
      })

      render(<HistoryPanel open={true} onClose={() => {}} />)

      await waitFor(() => {
        expect(screen.getByText('No history yet. Run queries or start AI sessions.')).toBeInTheDocument()
      })
    })

    it('should show search empty state when search has no results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [], counts: { queries: 0, executions: 0, sessions: 0 } }),
      })

      render(<HistoryPanel open={true} onClose={() => {}} />)

      // Wait for initial load
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      // Type in search
      const searchInput = screen.getByPlaceholderText('Search history...')
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } })
      fireEvent.keyDown(searchInput, { key: 'Enter' })

      await waitFor(() => {
        expect(screen.getByText('No matching items')).toBeInTheDocument()
      })
    })
  })
})
