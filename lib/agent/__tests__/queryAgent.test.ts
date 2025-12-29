import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  streamQueryAgent,
  runQueryAgent,
  MAX_AGENT_STEPS,
  type AgentConfig,
  type AgentState,
  type AgentStreamEvent,
} from '../queryAgent'
import type { SchemaInfo } from '../tools'

// Mock the AI SDK
vi.mock('ai', () => {
  return {
    streamText: vi.fn(),
    stepCountIs: vi.fn((count: number) => ({ type: 'stepCount', count })),
    hasToolCall: vi.fn((toolName: string) => ({ type: 'hasToolCall', toolName })),
  }
})

// Mock Anthropic
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'mocked-model'),
}))

// Mock tools creation
vi.mock('../tools', () => ({
  createQueryAgentTools: vi.fn(() => ({
    get_table_schema: { execute: vi.fn() },
    get_json_keys: { execute: vi.fn() },
    execute_query: { execute: vi.fn() },
    validate_query: { execute: vi.fn() },
    update_query_ui: { execute: vi.fn() },
    generate_chart: { execute: vi.fn() },
    manage_todo: { execute: vi.fn() },
  })),
}))

// Mock sql formatter
vi.mock('@/lib/sql-formatter', () => ({
  formatSql: vi.fn((sql: string) => sql),
}))

import { streamText } from 'ai'
import { createQueryAgentTools } from '../tools'

const mockedStreamText = vi.mocked(streamText)
const mockedCreateTools = vi.mocked(createQueryAgentTools)

describe('Query Agent', () => {
  const mockSchema: SchemaInfo[] = [
    {
      name: 'users',
      schema: 'public',
      type: 'table',
      columns: [
        { name: 'id', type: 'integer', isPrimaryKey: true },
        { name: 'name', type: 'varchar', isPrimaryKey: false },
      ],
    },
  ]

  const mockConfig: AgentConfig = {
    connectionString: 'postgresql://test:test@localhost:5432/testdb',
    schema: mockSchema,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('MAX_AGENT_STEPS constant', () => {
    it('should be 25', () => {
      expect(MAX_AGENT_STEPS).toBe(25)
    })
  })

  describe('streamQueryAgent', () => {
    it('should create tools with the provided context', async () => {
      // Create a mock async generator for the stream
      async function* mockStream() {
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test query', mockConfig)) {
        events.push(event)
      }

      expect(mockedCreateTools).toHaveBeenCalledWith({
        connectionString: mockConfig.connectionString,
        schema: mockConfig.schema,
      })
    })

    it('should yield step events for each agent step', async () => {
      async function* mockStream() {
        yield { type: 'start-step' as const }
        yield { type: 'start-step' as const }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test query', mockConfig)) {
        events.push(event)
      }

      const stepEvents = events.filter(e => e.type === 'step')
      expect(stepEvents).toHaveLength(2)
      expect(stepEvents[0]).toEqual({ type: 'step', step: 1, maxSteps: MAX_AGENT_STEPS })
      expect(stepEvents[1]).toEqual({ type: 'step', step: 2, maxSteps: MAX_AGENT_STEPS })
    })

    it('should yield text delta events', async () => {
      async function* mockStream() {
        yield { type: 'text-delta' as const, text: 'Hello' }
        yield { type: 'text-delta' as const, text: ' World' }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test query', mockConfig)) {
        events.push(event)
      }

      const textEvents = events.filter(e => e.type === 'text')
      expect(textEvents).toHaveLength(2)
      expect(textEvents[0]).toEqual({ type: 'text', text: 'Hello' })
      expect(textEvents[1]).toEqual({ type: 'text', text: ' World' })
    })

    it('should yield tool call start events', async () => {
      async function* mockStream() {
        yield {
          type: 'tool-call' as const,
          toolCallId: 'tc-1',
          toolName: 'get_table_schema',
          input: { includeViews: true },
        }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test query', mockConfig)) {
        events.push(event)
      }

      const toolCallEvents = events.filter(e => e.type === 'tool_call_start')
      expect(toolCallEvents).toHaveLength(1)
      expect(toolCallEvents[0]).toEqual({
        type: 'tool_call_start',
        toolName: 'get_table_schema',
        args: { includeViews: true },
      })
    })

    it('should yield tool result events', async () => {
      async function* mockStream() {
        yield {
          type: 'tool-call' as const,
          toolCallId: 'tc-1',
          toolName: 'get_table_schema',
          input: {},
        }
        yield {
          type: 'tool-result' as const,
          toolCallId: 'tc-1',
          output: { tableCount: 5 },
        }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test query', mockConfig)) {
        events.push(event)
      }

      const toolResultEvents = events.filter(e => e.type === 'tool_call_result')
      expect(toolResultEvents).toHaveLength(1)
      expect(toolResultEvents[0]).toMatchObject({
        type: 'tool_call_result',
        toolCall: expect.objectContaining({
          id: 'tc-1',
          toolName: 'get_table_schema',
          result: { tableCount: 5 },
        }),
      })
    })

    it('should handle update_query_ui tool call for completion', async () => {
      async function* mockStream() {
        yield {
          type: 'tool-call' as const,
          toolCallId: 'tc-1',
          toolName: 'update_query_ui',
          input: { sql: 'SELECT * FROM users', explanation: 'Test' },
        }
        yield {
          type: 'tool-result' as const,
          toolCallId: 'tc-1',
          output: { action: 'updateUI' },
        }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test query', mockConfig)) {
        events.push(event)
      }

      const completeEvent = events.find(e => e.type === 'complete') as { type: 'complete'; state: AgentState }
      expect(completeEvent).toBeDefined()
      expect(completeEvent.state.hasCompletedGoal).toBe(true)
      expect(completeEvent.state.currentSql).toBe('SELECT * FROM users')
    })

    it('should track errors from execute_query', async () => {
      async function* mockStream() {
        yield {
          type: 'tool-call' as const,
          toolCallId: 'tc-1',
          toolName: 'execute_query',
          input: { sql: 'SELECT * FROM users' },
        }
        yield {
          type: 'tool-result' as const,
          toolCallId: 'tc-1',
          output: { success: false, error: 'Column not found' },
        }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test query', mockConfig)) {
        events.push(event)
      }

      const completeEvent = events.find(e => e.type === 'complete') as { type: 'complete'; state: AgentState }
      expect(completeEvent.state.lastError).toBe('Column not found')
    })

    it('should clear error on successful execute_query', async () => {
      async function* mockStream() {
        yield {
          type: 'tool-call' as const,
          toolCallId: 'tc-1',
          toolName: 'execute_query',
          input: { sql: 'SELECT * FROM users' },
        }
        yield {
          type: 'tool-result' as const,
          toolCallId: 'tc-1',
          output: { success: true, rows: [] },
        }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test query', mockConfig)) {
        events.push(event)
      }

      const completeEvent = events.find(e => e.type === 'complete') as { type: 'complete'; state: AgentState }
      expect(completeEvent.state.lastError).toBeNull()
    })

    it('should yield error events on stream errors', async () => {
      async function* mockStream() {
        yield {
          type: 'error' as const,
          error: new Error('Stream error'),
        }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test query', mockConfig)) {
        events.push(event)
      }

      const errorEvent = events.find(e => e.type === 'error')
      expect(errorEvent).toEqual({ type: 'error', error: 'Stream error' })
    })

    it('should detect step limit reached without completion', async () => {
      // Simulate reaching step limit
      async function* mockStream() {
        for (let i = 0; i < MAX_AGENT_STEPS; i++) {
          yield { type: 'start-step' as const }
        }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test query', mockConfig)) {
        events.push(event)
      }

      const completeEvent = events.find(e => e.type === 'complete') as { type: 'complete'; state: AgentState }
      expect(completeEvent.state.reachedStepLimit).toBe(true)
    })

    it('should include previous SQL context for follow-ups', async () => {
      async function* mockStream() {
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const configWithPreviousSql = {
        ...mockConfig,
        previousSql: 'SELECT * FROM users',
      }

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('add filter', configWithPreviousSql)) {
        events.push(event)
      }

      // Check that streamText was called with the previous SQL in the message
      expect(mockedStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('SELECT * FROM users'),
            }),
          ]),
        })
      )
    })

    it('should handle abort signal', async () => {
      const abortController = new AbortController()

      async function* mockStream() {
        yield { type: 'start-step' as const }
        // Simulate abort
        abortController.abort()
        yield { type: 'text-delta' as const, text: 'should not appear' }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test', mockConfig, abortController.signal)) {
        events.push(event)
        if (abortController.signal.aborted) break
      }

      // Should only have the first step event
      const textEvents = events.filter(e => e.type === 'text')
      expect(textEvents).toHaveLength(0)
    })

    it('should handle exceptions gracefully', async () => {
      mockedStreamText.mockImplementation(() => {
        throw new Error('Connection failed')
      })

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test query', mockConfig)) {
        events.push(event)
      }

      const errorEvent = events.find(e => e.type === 'error')
      expect(errorEvent).toEqual({ type: 'error', error: 'Connection failed' })

      const completeEvent = events.find(e => e.type === 'complete') as { type: 'complete'; state: AgentState }
      expect(completeEvent.state.lastError).toBe('Connection failed')
    })

    it('should yield complete event at the end', async () => {
      async function* mockStream() {
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test query', mockConfig)) {
        events.push(event)
      }

      const lastEvent = events[events.length - 1]
      expect(lastEvent.type).toBe('complete')
    })

    it('should properly initialize agent state', async () => {
      async function* mockStream() {
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test goal', mockConfig)) {
        events.push(event)
      }

      const completeEvent = events.find(e => e.type === 'complete') as { type: 'complete'; state: AgentState }
      expect(completeEvent.state.goal).toBe('test goal')
      expect(completeEvent.state.maxSteps).toBe(MAX_AGENT_STEPS)
      expect(completeEvent.state.toolCalls).toEqual([])
    })

    it('should preserve previous SQL in state', async () => {
      async function* mockStream() {
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const configWithPreviousSql = {
        ...mockConfig,
        previousSql: 'SELECT id FROM users',
      }

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('modify', configWithPreviousSql)) {
        events.push(event)
      }

      const completeEvent = events.find(e => e.type === 'complete') as { type: 'complete'; state: AgentState }
      expect(completeEvent.state.previousSql).toBe('SELECT id FROM users')
    })

    it('should include previous context for continuation', async () => {
      async function* mockStream() {
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const configWithContext = {
        ...mockConfig,
        previousContext: 'Previously explored users table',
      }

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('continue', configWithContext)) {
        events.push(event)
      }

      // Verify the context was passed to streamText
      expect(mockedStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Previously explored users table'),
        })
      )
    })
  })

  describe('runQueryAgent', () => {
    it('should collect all events and return final state', async () => {
      async function* mockStream() {
        yield { type: 'start-step' as const }
        yield { type: 'text-delta' as const, text: 'Hello' }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const state = await runQueryAgent('test', mockConfig)

      expect(state).toBeDefined()
      expect(state.goal).toBe('test')
      expect(state.currentStep).toBe(1)
    })

    it('should call onToolCall callback for tool results', async () => {
      async function* mockStream() {
        yield {
          type: 'tool-call' as const,
          toolCallId: 'tc-1',
          toolName: 'get_table_schema',
          input: {},
        }
        yield {
          type: 'tool-result' as const,
          toolCallId: 'tc-1',
          output: { tableCount: 3 },
        }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const onToolCall = vi.fn()
      await runQueryAgent('test', mockConfig, onToolCall)

      expect(onToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tc-1',
          toolName: 'get_table_schema',
          result: { tableCount: 3 },
        })
      )
    })

    it('should call onStateUpdate callback for step changes', async () => {
      async function* mockStream() {
        yield { type: 'start-step' as const }
        yield { type: 'start-step' as const }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const onStateUpdate = vi.fn()
      await runQueryAgent('test', mockConfig, undefined, onStateUpdate)

      expect(onStateUpdate).toHaveBeenCalledWith({ currentStep: 1 })
      expect(onStateUpdate).toHaveBeenCalledWith({ currentStep: 2 })
    })

    it('should respect abort signal', async () => {
      const abortController = new AbortController()
      abortController.abort()

      async function* mockStream() {
        yield { type: 'start-step' as const }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const state = await runQueryAgent('test', mockConfig, undefined, undefined, abortController.signal)

      expect(state).toBeDefined()
    })
  })

  describe('Agent state tracking', () => {
    it('should track tool calls in state', async () => {
      async function* mockStream() {
        yield {
          type: 'tool-call' as const,
          toolCallId: 'tc-1',
          toolName: 'get_table_schema',
          input: {},
        }
        yield {
          type: 'tool-result' as const,
          toolCallId: 'tc-1',
          output: { tableCount: 5 },
        }
        yield {
          type: 'tool-call' as const,
          toolCallId: 'tc-2',
          toolName: 'execute_query',
          input: { sql: 'SELECT * FROM users' },
        }
        yield {
          type: 'tool-result' as const,
          toolCallId: 'tc-2',
          output: { success: true, rows: [] },
        }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test', mockConfig)) {
        events.push(event)
      }

      const completeEvent = events.find(e => e.type === 'complete') as { type: 'complete'; state: AgentState }
      expect(completeEvent.state.toolCalls).toHaveLength(2)
      expect(completeEvent.state.toolCalls[0].toolName).toBe('get_table_schema')
      expect(completeEvent.state.toolCalls[1].toolName).toBe('execute_query')
    })

    it('should handle null input in tool calls', async () => {
      async function* mockStream() {
        yield {
          type: 'tool-call' as const,
          toolCallId: 'tc-1',
          toolName: 'get_table_schema',
          input: null,
        }
        yield {
          type: 'tool-result' as const,
          toolCallId: 'tc-1',
          output: { tableCount: 5 },
        }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test', mockConfig)) {
        events.push(event)
      }

      const toolStartEvent = events.find(e => e.type === 'tool_call_start')
      expect(toolStartEvent).toMatchObject({
        type: 'tool_call_start',
        args: {},
      })
    })

    it('should handle string errors in stream error events', async () => {
      async function* mockStream() {
        yield {
          type: 'error' as const,
          error: 'String error message',
        }
        yield { type: 'finish' as const }
      }

      mockedStreamText.mockReturnValue({
        fullStream: mockStream(),
      } as unknown as ReturnType<typeof streamText>)

      const events: AgentStreamEvent[] = []
      for await (const event of streamQueryAgent('test', mockConfig)) {
        events.push(event)
      }

      const errorEvent = events.find(e => e.type === 'error')
      expect(errorEvent).toEqual({ type: 'error', error: 'String error message' })
    })
  })
})
