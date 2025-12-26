import { create } from 'zustand';

export interface QueryResultInfo {
  rowCount: number;
  executionTime: number;
  error?: string;
  sampleResults?: Record<string, unknown>[];
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
  completeAgent: (reachedStepLimit: boolean) => void;
  resetAgentProgress: () => void;
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

  completeAgent: (reachedStepLimit: boolean) => {
    set((state) => ({
      agentProgress: state.agentProgress
        ? {
            ...state.agentProgress,
            isRunning: false,
            reachedStepLimit,
            canContinue: reachedStepLimit,
          }
        : null,
      isGenerating: false,
    }));
  },

  resetAgentProgress: () => {
    set({ agentProgress: null });
  },
}));
