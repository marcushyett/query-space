import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Use vi.hoisted to ensure mocks are available before module imports
const {
  mockQueryFindMany,
  mockQueryCount,
  mockQueryExecutionFindMany,
  mockQueryExecutionCount,
  mockAgentSessionFindMany,
  mockAgentSessionCount,
  mockAgentSessionUpdateMany,
  mockGetCurrentUser,
  mockCheckOrganizationAccess,
  mockIsAgentRunning,
} = vi.hoisted(() => ({
  mockQueryFindMany: vi.fn(),
  mockQueryCount: vi.fn(),
  mockQueryExecutionFindMany: vi.fn(),
  mockQueryExecutionCount: vi.fn(),
  mockAgentSessionFindMany: vi.fn(),
  mockAgentSessionCount: vi.fn(),
  mockAgentSessionUpdateMany: vi.fn(),
  mockGetCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com' }),
  mockCheckOrganizationAccess: vi.fn().mockResolvedValue(true),
  mockIsAgentRunning: vi.fn().mockReturnValue(false),
}))

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    query: {
      findMany: mockQueryFindMany,
      count: mockQueryCount,
    },
    queryExecution: {
      findMany: mockQueryExecutionFindMany,
      count: mockQueryExecutionCount,
    },
    agentSession: {
      findMany: mockAgentSessionFindMany,
      count: mockAgentSessionCount,
      updateMany: mockAgentSessionUpdateMany,
    },
  },
}))

vi.mock('@/lib/agent/backgroundRunner', () => ({
  isAgentRunning: mockIsAgentRunning,
}))

vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: mockGetCurrentUser,
  checkOrganizationAccess: mockCheckOrganizationAccess,
}))

// Import after mocks
import { GET } from '../route'

describe('History API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mocks to defaults
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'test@test.com' })
    mockCheckOrganizationAccess.mockResolvedValue(true)
    // Default empty responses
    mockQueryFindMany.mockResolvedValue([])
    mockQueryExecutionFindMany.mockResolvedValue([])
    mockAgentSessionFindMany.mockResolvedValue([])
    mockQueryCount.mockResolvedValue(0)
    mockQueryExecutionCount.mockResolvedValue(0)
    mockAgentSessionCount.mockResolvedValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createRequest = (params: Record<string, string>) => {
    const url = new URL('http://localhost/api/history')
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
    return new NextRequest(url)
  }

  describe('authentication and authorization', () => {
    it('should require organizationId', async () => {
      const request = createRequest({})
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid query parameters')
    })

    it('should check organization access', async () => {
      mockCheckOrganizationAccess.mockResolvedValueOnce(false)

      const request = createRequest({ organizationId: 'org-1' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Organization access denied')
    })
  })

  describe('session status mapping', () => {
    it('should include pending status in session results', async () => {
      const now = new Date()
      mockQueryFindMany.mockResolvedValue([
        {
          id: 'query-1',
          name: 'Test Query',
          sql: 'SELECT 1',
          updatedAt: now,
          project: { id: 'project-1', title: 'Test Project' },
          executions: [],
          agentSessions: [
            {
              id: 'session-1',
              goal: 'Test goal',
              status: 'PENDING',
              queryName: null,
              updatedAt: now,
              _count: { queryExecutions: 0 },
            },
          ],
        },
      ])

      const request = createRequest({ organizationId: 'org-1' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const sessions = data.items.filter((i: { type: string }) => i.type === 'session')
      expect(sessions).toHaveLength(1)
      expect(sessions[0].status).toBe('pending')
    })

    it('should map all session statuses correctly', async () => {
      const now = new Date()
      mockQueryFindMany.mockResolvedValue([
        {
          id: 'query-1',
          name: 'Test Query',
          sql: 'SELECT 1',
          updatedAt: now,
          project: { id: 'project-1', title: 'Test Project' },
          executions: [],
          agentSessions: [
            { id: 's-1', goal: 'Goal 1', status: 'PENDING', queryName: null, updatedAt: now, _count: { queryExecutions: 0 } },
            { id: 's-2', goal: 'Goal 2', status: 'RUNNING', queryName: null, updatedAt: now, _count: { queryExecutions: 0 } },
            { id: 's-3', goal: 'Goal 3', status: 'PAUSED', queryName: null, updatedAt: now, _count: { queryExecutions: 0 } },
            { id: 's-4', goal: 'Goal 4', status: 'COMPLETED', queryName: null, updatedAt: now, _count: { queryExecutions: 0 } },
            { id: 's-5', goal: 'Goal 5', status: 'FAILED', queryName: null, updatedAt: now, _count: { queryExecutions: 0 } },
          ],
        },
      ])

      const request = createRequest({ organizationId: 'org-1' })
      const response = await GET(request)
      const data = await response.json()

      const sessions = data.items.filter((i: { type: string }) => i.type === 'session')
      const statuses = sessions.map((s: { status: string }) => s.status).sort()
      expect(statuses).toEqual(['completed', 'failed', 'paused', 'pending', 'running'])
    })
  })

  describe('query-linked sessions', () => {
    it('should return sessions linked to queries', async () => {
      const now = new Date()
      mockQueryFindMany.mockResolvedValue([
        {
          id: 'query-1',
          name: 'My Query',
          sql: 'SELECT * FROM users',
          updatedAt: now,
          project: { id: 'project-1', title: 'Test Project' },
          executions: [],
          agentSessions: [
            {
              id: 'session-1',
              goal: 'Create user query',
              status: 'COMPLETED',
              queryName: 'My Query',
              updatedAt: now,
              _count: { queryExecutions: 2 },
            },
          ],
        },
      ])

      const request = createRequest({ organizationId: 'org-1' })
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const sessions = data.items.filter((i: { type: string }) => i.type === 'session')
      expect(sessions).toHaveLength(1)
      expect(sessions[0]).toMatchObject({
        type: 'session',
        sessionId: 'session-1',
        queryId: 'query-1',
        goal: 'Create user query',
        status: 'completed',
        queryCount: 2,
        projectId: 'project-1',
        projectName: 'Test Project',
      })
    })

    it('should include executions linked to queries', async () => {
      const now = new Date()
      mockQueryFindMany.mockResolvedValue([
        {
          id: 'query-1',
          name: 'Test Query',
          sql: 'SELECT 1',
          updatedAt: now,
          project: { id: 'project-1', title: 'Test Project' },
          executions: [
            {
              id: 'exec-1',
              sql: 'SELECT 1',
              queryName: 'Test Query',
              source: 'AI',
              success: true,
              error: null,
              rowCount: 1,
              executionTime: 50,
              createdAt: now,
            },
          ],
          agentSessions: [],
        },
      ])

      const request = createRequest({ organizationId: 'org-1' })
      const response = await GET(request)
      const data = await response.json()

      const executions = data.items.filter((i: { type: string }) => i.type === 'execution')
      expect(executions).toHaveLength(1)
      expect(executions[0]).toMatchObject({
        type: 'execution',
        queryId: 'query-1',
        source: 'ai',
        success: true,
        rowCount: 1,
        executionTime: 50,
      })
    })
  })

  describe('standalone sessions', () => {
    it('should return standalone sessions (queryId is null)', async () => {
      const now = new Date()
      mockAgentSessionFindMany.mockResolvedValue([
        {
          id: 'session-standalone',
          goal: 'Standalone session',
          status: 'RUNNING',
          updatedAt: now,
          _count: { queryExecutions: 0 },
        },
      ])

      const request = createRequest({ organizationId: 'org-1' })
      const response = await GET(request)
      const data = await response.json()

      const sessions = data.items.filter((i: { type: string }) => i.type === 'session')
      expect(sessions.some((s: { sessionId: string }) => s.sessionId === 'session-standalone')).toBe(true)
    })
  })

  describe('filtering', () => {
    it('should filter by projectId', async () => {
      const request = createRequest({ organizationId: 'org-1', projectId: 'project-1' })
      await GET(request)

      // Check that query.findMany was called with project filter
      expect(mockQueryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            project: expect.objectContaining({
              id: 'project-1',
            }),
          }),
        })
      )
    })

    it('should filter standalone sessions by projectId', async () => {
      const request = createRequest({ organizationId: 'org-1', projectId: 'project-1' })
      await GET(request)

      expect(mockAgentSessionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-1',
          }),
        })
      )
    })

    it('should search by goal for sessions', async () => {
      const request = createRequest({ organizationId: 'org-1', search: 'user query' })
      await GET(request)

      expect(mockAgentSessionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            goal: expect.objectContaining({
              contains: 'user query',
              mode: 'insensitive',
            }),
          }),
        })
      )
    })
  })

  describe('sorting', () => {
    it('should sort items by timestamp descending', async () => {
      const now = Date.now()
      mockQueryFindMany.mockResolvedValue([
        {
          id: 'query-1',
          name: 'Query 1',
          sql: 'SELECT 1',
          updatedAt: new Date(now - 2000),
          project: { id: 'project-1', title: 'Test Project' },
          executions: [],
          agentSessions: [
            { id: 's-1', goal: 'Old session', status: 'COMPLETED', queryName: null, updatedAt: new Date(now - 2000), _count: { queryExecutions: 0 } },
          ],
        },
        {
          id: 'query-2',
          name: 'Query 2',
          sql: 'SELECT 2',
          updatedAt: new Date(now),
          project: { id: 'project-1', title: 'Test Project' },
          executions: [],
          agentSessions: [
            { id: 's-2', goal: 'New session', status: 'RUNNING', queryName: null, updatedAt: new Date(now), _count: { queryExecutions: 0 } },
          ],
        },
      ])

      const request = createRequest({ organizationId: 'org-1' })
      const response = await GET(request)
      const data = await response.json()

      const sessions = data.items.filter((i: { type: string }) => i.type === 'session')
      expect(sessions[0].goal).toBe('New session')
      expect(sessions[1].goal).toBe('Old session')
    })
  })

  describe('counts', () => {
    it('should return correct counts', async () => {
      mockQueryCount.mockResolvedValue(5)
      mockQueryExecutionCount.mockResolvedValue(10)
      mockAgentSessionCount.mockResolvedValue(3)

      const request = createRequest({ organizationId: 'org-1' })
      const response = await GET(request)
      const data = await response.json()

      expect(data.counts).toEqual({
        queries: 5,
        executions: 10,
        sessions: 3,
      })
    })
  })
})
