import { create } from 'zustand';
import type { ChartConfig, ChartType } from '@/lib/chart-utils';

export interface QueryResultInfo {
  rowCount: number;
  executionTime: number;
  error?: string;
  sampleResults?: Record<string, unknown>[];
}

export interface ChatChartData {
  config: ChartConfig;
  data: Record<string, unknown>[];
  xAxisKey: string;
  yAxisKeys: string[];
  title?: string;
  description?: string;
}

// Metadata for executed queries (from execute_query tool)
export interface QueryMetadata {
  sql: string;
  title: string;
  description: string;
  rowCount: number;
  executionTime: number;
  sampleResults?: Record<string, unknown>[];
}

// Agent todo list item
export interface AgentTodoItem {
  id: string;
  text: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  createdAt: number;
  completedAt?: number;
  addedDuringExecution?: boolean; // Items discovered during execution
}

export interface ToolCallInfo {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  timestamp: number;
  status: 'pending' | 'running' | 'success' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  // For assistant messages
  sql?: string;
  previousSql?: string;
  explanation?: string;
  error?: string;
  // For query results
  queryResult?: QueryResultInfo;
  isAutoFix?: boolean;
  // For clarification flow
  clarifyingQuestions?: string[];
  goalSummary?: string;
  needsClarification?: boolean;
  // For agent tool calls
  toolCalls?: ToolCallInfo[];
  // For confidence levels
  confidence?: 'high' | 'medium' | 'low';
  suggestions?: string[];
  // For inline charts
  chartData?: ChatChartData;
  // For expandable query display (from execute_query tool)
  queryMetadata?: QueryMetadata;
  // For end-of-flow summary
  summary?: string;
  // For todo list snapshots
  todos?: AgentTodoItem[];
  // For inline thinking/reasoning messages
  isThinking?: boolean;
  // For inline tool activity messages
  toolActivity?: {
    toolName: string;
    status: 'running' | 'success' | 'error';
    description: string;
    result?: string;
  };
}

export interface AgentProgress {
  currentStep: number;
  maxSteps: number;
  goal: string;
  isRunning: boolean;
  reachedStepLimit: boolean;
  canContinue: boolean;
  toolCalls: ToolCallInfo[];
  streamingText: string;
  todos: AgentTodoItem[];
  stopReason: 'goal_complete' | 'step_limit' | 'incomplete_todos' | 'error' | 'timeout' | null;
  hasIncompleteTodos: boolean;
}

interface AiChatStore {
  // Chat state
  messages: ChatMessage[];
  isOpen: boolean;
  isGenerating: boolean;
  currentSql: string | null;
  isAiGenerated: boolean;
  lastQueryError: string | null;

  // Agent state
  agentProgress: AgentProgress | null;

  // Actions
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  addUserMessage: (content: string) => string;
  addAssistantMessage: (message: Omit<ChatMessage, 'id' | 'role' | 'timestamp'>) => void;
  addSystemMessage: (content: string, queryResult?: QueryResultInfo) => void;
  addToolMessage: (toolCall: ToolCallInfo) => void;
  updateToolCall: (id: string, update: Partial<ToolCallInfo>) => void;
  updateLastAssistantMessage: (update: Partial<ChatMessage>) => void;
  addChartMessage: (chartData: ChatChartData, explanation?: string) => void;
  addQueryMessage: (queryMetadata: QueryMetadata) => void;
  addTodoMessage: (todos: AgentTodoItem[]) => void;
  addThinkingMessage: (content: string) => void;
  addToolActivityMessage: (toolName: string, status: 'running' | 'success' | 'error', description: string, result?: string) => void;
  setCurrentSql: (sql: string | null) => void;
  setIsGenerating: (generating: boolean) => void;
  setIsAiGenerated: (isAiGenerated: boolean) => void;
  setLastQueryError: (error: string | null) => void;
  clearChat: () => void;
  startNewConversation: () => void;

  // Agent actions
  startAgent: (goal: string, maxSteps: number) => void;
  updateAgentStep: (step: number) => void;
  appendStreamingText: (text: string) => void;
  addAgentToolCall: (toolCall: ToolCallInfo) => void;
  updateAgentToolCall: (id: string, update: Partial<ToolCallInfo>) => void;
  completeAgent: (reachedStepLimit: boolean, stopReason?: AgentProgress['stopReason'], hasIncompleteTodos?: boolean) => void;
  resetAgentProgress: () => void;

  // Agent todo actions
  setAgentTodos: (todos: AgentTodoItem[]) => void;
  updateAgentTodo: (id: string, update: Partial<AgentTodoItem>) => void;
  addAgentTodo: (todo: Omit<AgentTodoItem, 'id' | 'createdAt'>) => void;
}

export const useAiChatStore = create<AiChatStore>((set, get) => ({
  messages: [],
  isOpen: false,
  isGenerating: false,
  currentSql: null,
  isAiGenerated: false,
  lastQueryError: null,
  agentProgress: null,

  setOpen: (open: boolean) => {
    set({ isOpen: open });
  },

  toggleOpen: () => {
    set((state) => ({ isOpen: !state.isOpen }));
  },

  addUserMessage: (content: string) => {
    const id = `user-${Date.now()}`;
    const message: ChatMessage = {
      id,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages, message],
    }));
    return id;
  },

  addAssistantMessage: (message) => {
    const assistantMessage: ChatMessage = {
      ...message,
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages, assistantMessage],
      currentSql: message.sql || state.currentSql,
      isAiGenerated: !!message.sql,
    }));
  },

  addSystemMessage: (content: string, queryResult?: QueryResultInfo) => {
    const systemMessage: ChatMessage = {
      id: `system-${Date.now()}`,
      role: 'system',
      content,
      timestamp: Date.now(),
      queryResult,
    };
    set((state) => ({
      messages: [...state.messages, systemMessage],
    }));
  },

  addToolMessage: (toolCall: ToolCallInfo) => {
    const toolMessage: ChatMessage = {
      id: `tool-${Date.now()}-${toolCall.id}`,
      role: 'tool',
      content: `Tool: ${toolCall.toolName}`,
      timestamp: Date.now(),
      toolCalls: [toolCall],
    };
    set((state) => ({
      messages: [...state.messages, toolMessage],
    }));
  },

  updateToolCall: (id: string, update: Partial<ToolCallInfo>) => {
    set((state) => {
      const messages = state.messages.map(msg => {
        if (msg.role === 'tool' && msg.toolCalls) {
          const updatedCalls = msg.toolCalls.map(tc =>
            tc.id === id ? { ...tc, ...update } : tc
          );
          return { ...msg, toolCalls: updatedCalls };
        }
        return msg;
      });
      return { messages };
    });
  },

  updateLastAssistantMessage: (update) => {
    set((state) => {
      const messages = [...state.messages];
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
          messages[i] = { ...messages[i], ...update };
          break;
        }
      }
      return {
        messages,
        currentSql: update.sql || state.currentSql,
      };
    });
  },

  addChartMessage: (chartData: ChatChartData, explanation?: string) => {
    const chartMessage: ChatMessage = {
      id: `chart-${Date.now()}`,
      role: 'assistant',
      content: explanation || 'Here\'s a visualization of the query results:',
      timestamp: Date.now(),
      chartData,
    };
    set((state) => ({
      messages: [...state.messages, chartMessage],
    }));
  },

  addQueryMessage: (queryMetadata: QueryMetadata) => {
    const queryMessage: ChatMessage = {
      id: `query-${Date.now()}`,
      role: 'system',
      content: queryMetadata.title,
      timestamp: Date.now(),
      queryMetadata,
      queryResult: {
        rowCount: queryMetadata.rowCount,
        executionTime: queryMetadata.executionTime,
        sampleResults: queryMetadata.sampleResults,
      },
    };
    set((state) => ({
      messages: [...state.messages, queryMessage],
    }));
  },

  addTodoMessage: (todos: AgentTodoItem[]) => {
    // Always add a new snapshot of the todo list to show progress inline
    const todoMessage: ChatMessage = {
      id: `todo-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      role: 'system',
      content: '',
      timestamp: Date.now(),
      todos: todos.map(t => ({ ...t })),
    };
    set((state) => ({
      messages: [...state.messages, todoMessage],
    }));
  },

  addThinkingMessage: (content: string) => {
    if (!content.trim()) return;
    const thinkingMessage: ChatMessage = {
      id: `thinking-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      role: 'assistant',
      content: content.trim(),
      timestamp: Date.now(),
      isThinking: true,
    };
    set((state) => ({
      messages: [...state.messages, thinkingMessage],
    }));
  },

  addToolActivityMessage: (toolName: string, status: 'running' | 'success' | 'error', description: string, result?: string) => {
    const activityMessage: ChatMessage = {
      id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      role: 'system',
      content: description,
      timestamp: Date.now(),
      toolActivity: {
        toolName,
        status,
        description,
        result,
      },
    };
    set((state) => ({
      messages: [...state.messages, activityMessage],
    }));
  },

  setCurrentSql: (sql: string | null) => {
    set({ currentSql: sql });
  },

  setIsGenerating: (generating: boolean) => {
    set({ isGenerating: generating });
  },

  setIsAiGenerated: (isAiGenerated: boolean) => {
    set({ isAiGenerated });
  },

  setLastQueryError: (error: string | null) => {
    set({ lastQueryError: error });
  },

  clearChat: () => {
    set({
      messages: [],
      currentSql: null,
      isAiGenerated: false,
      lastQueryError: null,
      agentProgress: null,
    });
  },

  startNewConversation: () => {
    set({
      messages: [],
      currentSql: null,
      isGenerating: false,
      isAiGenerated: false,
      lastQueryError: null,
      agentProgress: null,
    });
  },

  // Agent actions
  startAgent: (goal: string, maxSteps: number) => {
    set({
      agentProgress: {
        currentStep: 0,
        maxSteps,
        goal,
        isRunning: true,
        reachedStepLimit: false,
        canContinue: false,
        toolCalls: [],
        streamingText: '',
        todos: [],
        stopReason: null,
        hasIncompleteTodos: false,
      },
      isGenerating: true,
    });
  },

  updateAgentStep: (step: number) => {
    set((state) => ({
      agentProgress: state.agentProgress
        ? { ...state.agentProgress, currentStep: step, streamingText: '' }
        : null,
    }));
  },

  appendStreamingText: (text: string) => {
    set((state) => ({
      agentProgress: state.agentProgress
        ? { ...state.agentProgress, streamingText: state.agentProgress.streamingText + text }
        : null,
    }));
  },

  addAgentToolCall: (toolCall: ToolCallInfo) => {
    set((state) => ({
      agentProgress: state.agentProgress
        ? {
            ...state.agentProgress,
            toolCalls: [...state.agentProgress.toolCalls, toolCall],
          }
        : null,
    }));
  },

  updateAgentToolCall: (id: string, update: Partial<ToolCallInfo>) => {
    set((state) => ({
      agentProgress: state.agentProgress
        ? {
            ...state.agentProgress,
            toolCalls: state.agentProgress.toolCalls.map(tc =>
              tc.id === id ? { ...tc, ...update } : tc
            ),
          }
        : null,
    }));
  },

  completeAgent: (reachedStepLimit: boolean, stopReason?: AgentProgress['stopReason'], hasIncompleteTodos?: boolean) => {
    set((state) => {
      // Determine if agent can continue: step limit reached OR has incomplete todos
      const canContinue = reachedStepLimit || (hasIncompleteTodos ?? false);

      return {
        agentProgress: state.agentProgress
          ? {
              ...state.agentProgress,
              isRunning: false,
              reachedStepLimit,
              canContinue,
              stopReason: stopReason ?? (reachedStepLimit ? 'step_limit' : null),
              hasIncompleteTodos: hasIncompleteTodos ?? false,
            }
          : null,
        isGenerating: false,
      };
    });
  },

  resetAgentProgress: () => {
    set({ agentProgress: null });
  },

  // Agent todo actions
  setAgentTodos: (todos: AgentTodoItem[]) => {
    set((state) => ({
      agentProgress: state.agentProgress
        ? { ...state.agentProgress, todos }
        : null,
    }));
  },

  updateAgentTodo: (id: string, update: Partial<AgentTodoItem>) => {
    set((state) => ({
      agentProgress: state.agentProgress
        ? {
            ...state.agentProgress,
            todos: state.agentProgress.todos.map((todo) =>
              todo.id === id
                ? {
                    ...todo,
                    ...update,
                    completedAt: update.status === 'completed' ? Date.now() : todo.completedAt,
                  }
                : todo
            ),
          }
        : null,
    }));
  },

  addAgentTodo: (todo: Omit<AgentTodoItem, 'id' | 'createdAt'>) => {
    const newTodo: AgentTodoItem = {
      ...todo,
      id: `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      addedDuringExecution: true,
    };
    set((state) => ({
      agentProgress: state.agentProgress
        ? {
            ...state.agentProgress,
            todos: [...state.agentProgress.todos, newTodo],
          }
        : null,
    }));
  },
}));
