import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Use vi.hoisted to ensure mocks are available before module imports
const {
  mockQueryFindUnique,
  mockQueryCreate,
  mockAgentSessionCreate,
  mockRunDurableAgent,
  mockRequireUser,
  mockGetClaudeApiKey,
  mockRequireDatabaseConnection,
} = vi.hoisted(() => ({
  mockQueryFindUnique: vi.fn(),
  mockQueryCreate: vi.fn(),
  mockAgentSessionCreate: vi.fn(),
  mockRunDurableAgent: vi.fn().mockResolvedValue({ success: true, sessionId: 'session-123' }),
  mockRequireUser: vi.fn().mockResolvedValue({ id: 'user-1', email: 'test@test.com' }),
  mockGetClaudeApiKey: vi.fn().mockResolvedValue('test-api-key'),
  mockRequireDatabaseConnection: vi.fn().mockResolvedValue('postgresql://localhost/test'),
}))

// Mock modules using hoisted functions
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    query: {
      findUnique: mockQueryFindUnique,
      create: mockQueryCreate,
    },
    agentSession: {
      create: mockAgentSessionCreate,
    },
  },
}))

vi.mock('@/lib/auth/session', () => ({
  requireUser: mockRequireUser,
}))

vi.mock('@/lib/auth/organization-settings', () => ({
  getClaudeApiKey: mockGetClaudeApiKey,
  requireDatabaseConnection: mockRequireDatabaseConnection,
}))

vi.mock('@/lib/agent/durableAgentWorkflow', () => ({
  runDurableAgent: mockRunDurableAgent,
}))

// Import after mocks
import { POST } from '../route'

describe('Agent Session Start API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default mocks
    mockRequireUser.mockResolvedValue({ id: 'user-1', email: 'test@test.com' })
    mockGetClaudeApiKey.mockResolvedValue('test-api-key')
    mockRequireDatabaseConnection.mockResolvedValue('postgresql://localhost/test')
    mockRunDurableAgent.mockResolvedValue({ success: true, sessionId: 'session-123' })
    // Reset environment
    delete process.env.ANTHROPIC_API_KEY
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createRequest = (body: Record<string, unknown>) => {
    return new NextRequest('http://localhost/api/agent-sessions/start', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  describe('queryId assignment', () => {
    it('should use provided queryId when given', async () => {
      const existingQueryId = 'existing-query-123'

      mockQueryFindUnique.mockResolvedValue({
        id: existingQueryId,
        projectId: 'project-1',
      })

      mockAgentSessionCreate.mockResolvedValue({
        id: 'session-1',
      })

      const request = createRequest({
        prompt: 'Test prompt',
        organizationId: 'org-1',
        projectId: 'project-1',
        queryId: existingQueryId,
        schema: [],
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.queryId).toBe(existingQueryId)

      // Verify session was created with the provided queryId
      expect(mockAgentSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            queryId: existingQueryId,
          }),
        })
      )

      // Verify no new query was created
      expect(mockQueryCreate).not.toHaveBeenCalled()
    })

    it('should auto-create query when projectId provided but no queryId', async () => {
      const autoCreatedQueryId = 'auto-created-query-456'

      mockQueryCreate.mockResolvedValue({
        id: autoCreatedQueryId,
      })

      mockAgentSessionCreate.mockResolvedValue({
        id: 'session-1',
      })

      const request = createRequest({
        prompt: 'Create a users query',
        organizationId: 'org-1',
        projectId: 'project-1',
        schema: [],
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.queryId).toBe(autoCreatedQueryId)

      // Verify query was auto-created with truncated prompt as name
      expect(mockQueryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'project-1',
            name: 'Create a users query',
          }),
        })
      )

      // Verify session was created with the auto-created queryId
      expect(mockAgentSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            queryId: autoCreatedQueryId,
          }),
        })
      )
    })

    it('should fail gracefully if provided queryId does not exist', async () => {
      mockQueryFindUnique.mockResolvedValue(null)

      const request = createRequest({
        prompt: 'Test prompt',
        organizationId: 'org-1',
        projectId: 'project-1',
        queryId: 'non-existent-query',
        schema: [],
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Query not found')

      // Verify no session was created
      expect(mockAgentSessionCreate).not.toHaveBeenCalled()
    })

    it('should create session without queryId if no projectId or queryId provided', async () => {
      mockAgentSessionCreate.mockResolvedValue({
        id: 'session-1',
      })

      const request = createRequest({
        prompt: 'Test prompt',
        organizationId: 'org-1',
        schema: [],
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.queryId).toBeNull()

      // Verify session was created with undefined queryId
      expect(mockAgentSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            queryId: undefined,
          }),
        })
      )
    })

    it('should truncate long prompts for query names', async () => {
      const longPrompt = 'A'.repeat(100)
      const autoCreatedQueryId = 'auto-created-query'

      mockQueryCreate.mockResolvedValue({
        id: autoCreatedQueryId,
      })

      mockAgentSessionCreate.mockResolvedValue({
        id: 'session-1',
      })

      const request = createRequest({
        prompt: longPrompt,
        organizationId: 'org-1',
        projectId: 'project-1',
        schema: [],
      })

      await POST(request)

      // Verify query name was truncated to 50 chars + ellipsis
      expect(mockQueryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'A'.repeat(50) + '...',
          }),
        })
      )
    })
  })

  describe('session initialization', () => {
    it('should create session with PENDING status', async () => {
      mockAgentSessionCreate.mockResolvedValue({
        id: 'session-1',
      })

      const request = createRequest({
        prompt: 'Test prompt',
        organizationId: 'org-1',
        schema: [],
      })

      await POST(request)

      expect(mockAgentSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      )
    })

    it('should include initial user message in chatHistory', async () => {
      mockAgentSessionCreate.mockResolvedValue({
        id: 'session-1',
      })

      const testPrompt = 'Create a query for users'
      const request = createRequest({
        prompt: testPrompt,
        organizationId: 'org-1',
        schema: [],
      })

      await POST(request)

      expect(mockAgentSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            chatHistory: expect.arrayContaining([
              expect.objectContaining({
                role: 'user',
                content: testPrompt,
              }),
            ]),
          }),
        })
      )
    })

    it('should store goal from prompt', async () => {
      mockAgentSessionCreate.mockResolvedValue({
        id: 'session-1',
      })

      const testPrompt = 'Create a query for users'
      const request = createRequest({
        prompt: testPrompt,
        organizationId: 'org-1',
        schema: [],
      })

      await POST(request)

      expect(mockAgentSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            goal: testPrompt,
          }),
        })
      )
    })
  })

  describe('durable agent workflow', () => {
    it('should start durable agent workflow with session details', async () => {
      mockAgentSessionCreate.mockResolvedValue({
        id: 'session-123',
      })

      const request = createRequest({
        prompt: 'Test prompt',
        organizationId: 'org-1',
        schema: [{ name: 'users', columns: [] }],
        previousSql: 'SELECT 1',
        previousContext: 'Some context',
        model: 'claude-sonnet',
      })

      await POST(request)

      expect(mockRunDurableAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
          organizationId: 'org-1',
          prompt: 'Test prompt',
          connectionString: 'postgresql://localhost/test',
          schema: [{ name: 'users', columns: [] }],
          previousSql: 'SELECT 1',
          previousContext: 'Some context',
          model: 'claude-sonnet',
        })
      )
    })
  })

  describe('validation', () => {
    it('should require prompt', async () => {
      const request = createRequest({
        organizationId: 'org-1',
        schema: [],
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: prompt')
    })

    it('should require non-empty prompt', async () => {
      const request = createRequest({
        prompt: '   ',
        organizationId: 'org-1',
        schema: [],
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: prompt')
    })

    it('should require organizationId', async () => {
      const request = createRequest({
        prompt: 'Test prompt',
        schema: [],
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Missing required field: organizationId')
    })
  })

  describe('API key and database connection', () => {
    it('should fail if no Claude API key configured', async () => {
      mockGetClaudeApiKey.mockResolvedValueOnce(null)

      const request = createRequest({
        prompt: 'Test prompt',
        organizationId: 'org-1',
        schema: [],
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Claude API key is not configured')
    })

    it('should fail if database connection not configured', async () => {
      mockRequireDatabaseConnection.mockRejectedValueOnce(
        new Error('Database connection not configured')
      )

      const request = createRequest({
        prompt: 'Test prompt',
        organizationId: 'org-1',
        schema: [],
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Database connection not configured')
    })
  })
})
