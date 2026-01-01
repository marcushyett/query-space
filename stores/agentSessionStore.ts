import { create } from 'zustand';
import type { AgentTodoItem, ToolCallInfo } from './aiChatStore';

// Lightweight chat message for persistence
export interface PersistedChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  sql?: string;
  explanation?: string;
  summary?: string;
}

export interface AgentSession {
  id: string;
  goal: string;
  createdAt: number;
  updatedAt: number;
  status: 'running' | 'paused' | 'completed' | 'failed';

  // Agent state
  currentStep: number;
  maxSteps: number;

  // Tool calls made
  toolCalls: ToolCallInfo[];

  // Todo list
  todos: AgentTodoItem[];

  // Current SQL being worked on
  currentSql: string | null;
  previousSql: string | null;

  // Last streaming text
  lastStreamingText: string;

  // Error state
  lastError: string | null;

  // Context for resumption - what the agent was doing
  resumptionContext: string;

  // Chat messages for context (user/assistant/system messages)
  chatHistory: PersistedChatMessage[];

  // Final query name if set
  queryName?: string;

  // Link to project and auto-created query
  projectId?: string;
  queryId?: string;

  // Query count (from API)
  queryCount?: number;
}

interface AgentSessionStore {
  // Current active session
  currentSessionId: string | null;

  // All sessions (keyed by ID) - loaded from API
  sessions: Record<string, AgentSession>;

  // Loading state
  isLoadingSessions: boolean;
  setIsLoadingSessions: (loading: boolean) => void;

  // Actions
  createSession: (goal: string, previousSql?: string) => string;
  updateSession: (sessionId: string, update: Partial<AgentSession>) => void;
  setCurrentSession: (sessionId: string | null) => void;
  getSession: (sessionId: string) => AgentSession | undefined;
  getCurrentSession: () => AgentSession | undefined;
  setSessions: (sessions: AgentSession[]) => void;

  // Resumable sessions
  getResumableSessions: () => AgentSession[];

  // Mark session as paused (disconnect scenario)
  pauseSession: (sessionId: string, context: string) => void;

  // Mark session as completed
  completeSession: (sessionId: string, success: boolean) => void;

  // Delete old sessions (cleanup)
  cleanupOldSessions: (maxAgeMs?: number) => void;

  // Clear all sessions
  clearAllSessions: () => void;

  // Add chat message to session
  addChatMessage: (sessionId: string, message: PersistedChatMessage) => void;

  // Get completed sessions that can be resumed for follow-up
  getCompletedSessions: () => AgentSession[];
}

// Generate a unique session ID (temporary until server assigns one)
function generateSessionId(): string {
  return `temp-session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Build resumption context from tool calls and todos
function buildResumptionContext(session: AgentSession): string {
  const parts: string[] = [];

  // Add goal
  parts.push(`Goal: ${session.goal}`);

  // Add todo progress with IDs for resumption
  if (session.todos.length > 0) {
    const completed = session.todos.filter(t => t.status === 'completed').length;
    const inProgress = session.todos.find(t => t.status === 'in_progress');

    parts.push(`\nTodo Progress: ${completed}/${session.todos.length} completed`);

    if (inProgress) {
      parts.push(`Currently working on (id="${inProgress.id}"): ${inProgress.text}`);
    }

    const pending = session.todos.filter(t => t.status === 'pending');
    if (pending.length > 0) {
      parts.push(`Remaining tasks:\n${pending.map(t => `- id="${t.id}": ${t.text}`).join('\n')}`);
    }
  }

  // Add summary of tool calls
  if (session.toolCalls.length > 0) {
    const summaryParts: string[] = [];

    for (const tc of session.toolCalls) {
      if (tc.toolName === 'get_table_schema') {
        const result = tc.result as { tables?: { name: string }[]; tableCount?: number };
        if (result?.tableCount) {
          summaryParts.push(`- Retrieved schema: ${result.tableCount} tables`);
        }
      } else if (tc.toolName === 'get_json_keys') {
        const result = tc.result as { keys?: string[]; table?: string; column?: string };
        if (result?.keys) {
          summaryParts.push(`- Explored JSON keys in ${result.table}.${result.column}`);
        }
      } else if (tc.toolName === 'execute_query') {
        const result = tc.result as { success: boolean; error?: string; rowCount?: number };
        const args = tc.args as { sql?: string; title?: string };
        if (result.success) {
          summaryParts.push(`- Query succeeded: ${args.title || 'Untitled'} (${result.rowCount} rows)`);
        } else {
          summaryParts.push(`- Query FAILED: ${result.error}`);
        }
      } else if (tc.toolName === 'validate_query') {
        const result = tc.result as { isValid: boolean; error?: string };
        if (!result.isValid) {
          summaryParts.push(`- Validation failed: ${result.error}`);
        }
      }
    }

    if (summaryParts.length > 0) {
      parts.push(`\nPrevious work:\n${summaryParts.join('\n')}`);
    }
  }

  // Add current SQL if any
  if (session.currentSql) {
    parts.push(`\nCurrent SQL draft:\n${session.currentSql}`);
  }

  // Add last error if any
  if (session.lastError) {
    parts.push(`\nLast error: ${session.lastError}`);
  }

  return parts.join('\n');
}

export const useAgentSessionStore = create<AgentSessionStore>()((set, get) => ({
  currentSessionId: null,
  sessions: {},
  isLoadingSessions: false,

  setIsLoadingSessions: (loading: boolean) => {
    set({ isLoadingSessions: loading });
  },

  setSessions: (sessions: AgentSession[]) => {
    set((state) => {
      const sessionsMap: Record<string, AgentSession> = {};

      // First, add all sessions from API
      for (const session of sessions) {
        sessionsMap[session.id] = session;
      }

      // Preserve local sessions that aren't in the API response yet
      // These are sessions with temp IDs or sessions that haven't been synced
      for (const [id, session] of Object.entries(state.sessions)) {
        // Keep temp sessions (not yet saved to DB)
        if (id.startsWith('temp-session-') && !sessionsMap[id]) {
          sessionsMap[id] = session;
        }
        // Keep running sessions that might not be in API yet
        if (session.status === 'running' && !sessionsMap[id]) {
          sessionsMap[id] = session;
        }
      }

      return { sessions: sessionsMap };
    });
  },

  createSession: (goal: string, previousSql?: string) => {
    const id = generateSessionId();
    const session: AgentSession = {
      id,
      goal,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'running',
      currentStep: 0,
      maxSteps: 25,
      toolCalls: [],
      todos: [],
      currentSql: previousSql || null,
      previousSql: previousSql || null,
      lastStreamingText: '',
      lastError: null,
      resumptionContext: '',
      chatHistory: [],
    };

    set((state) => ({
      currentSessionId: id,
      sessions: {
        ...state.sessions,
        [id]: session,
      },
    }));

    return id;
  },

  updateSession: (sessionId: string, update: Partial<AgentSession>) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;

      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...session,
            ...update,
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  setCurrentSession: (sessionId: string | null) => {
    set({ currentSessionId: sessionId });
  },

  getSession: (sessionId: string) => {
    return get().sessions[sessionId];
  },

  getCurrentSession: () => {
    const { currentSessionId, sessions } = get();
    return currentSessionId ? sessions[currentSessionId] : undefined;
  },

  getResumableSessions: () => {
    const { sessions } = get();
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    return Object.values(sessions)
      .filter((s) =>
        s.status === 'paused' &&
        (now - s.updatedAt) < maxAge &&
        // Show sessions that have meaningful work: todos, tool calls, or streaming text
        (s.todos.length > 0 || s.toolCalls.length > 0 || s.lastStreamingText.length > 0)
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  pauseSession: (sessionId: string, context: string) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;

      // Build full resumption context
      const resumptionContext = context || buildResumptionContext(session);

      return {
        currentSessionId: null,
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...session,
            status: 'paused',
            resumptionContext,
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  completeSession: (sessionId: string, success: boolean) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;

      return {
        currentSessionId: null,
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...session,
            status: success ? 'completed' : 'failed',
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  cleanupOldSessions: (maxAgeMs = 7 * 24 * 60 * 60 * 1000) => {
    const now = Date.now();

    set((state) => {
      const sessions: Record<string, AgentSession> = {};

      for (const [id, session] of Object.entries(state.sessions)) {
        // Keep sessions that are:
        // 1. Currently running
        // 2. Paused and within age limit
        // 3. Recently completed/failed (within age limit)
        if (
          session.status === 'running' ||
          (now - session.updatedAt) < maxAgeMs
        ) {
          sessions[id] = session;
        }
      }

      return { sessions };
    });
  },

  clearAllSessions: () => {
    set({
      currentSessionId: null,
      sessions: {},
    });
  },

  addChatMessage: (sessionId: string, message: PersistedChatMessage) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;

      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...session,
            chatHistory: [...session.chatHistory, message],
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  getCompletedSessions: () => {
    const { sessions } = get();
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    return Object.values(sessions)
      .filter((s) =>
        s.status === 'completed' &&
        (now - s.updatedAt) < maxAge &&
        s.chatHistory.length > 0
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
}));

// Export the context builder for use elsewhere
export { buildResumptionContext };

// Persist session state using sendBeacon (reliable for page unload)
export function persistSessionOnUnload(
  sessionId: string,
  data: Partial<{
    status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
    currentStep: number;
    toolCalls: ToolCallInfo[];
    todos: AgentTodoItem[];
    currentSql: string | null;
    lastStreamingText: string;
    lastError: string | null;
    resumptionContext: string;
    chatHistory: PersistedChatMessage[];
  }>
): boolean {
  // Skip temp sessions that haven't been saved to DB yet
  if (sessionId.startsWith('temp-session-')) {
    return false;
  }

  try {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    return navigator.sendBeacon(`/api/agent-sessions/${sessionId}`, blob);
  } catch {
    return false;
  }
}

// API helper functions for agent sessions
export async function fetchAgentSessions(organizationId: string, options?: {
  projectId?: string;
  queryId?: string;
  status?: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  limit?: number;
  offset?: number;
}): Promise<{ sessions: AgentSession[]; total: number }> {
  const params = new URLSearchParams({ organizationId });
  if (options?.projectId) params.set('projectId', options.projectId);
  if (options?.queryId) params.set('queryId', options.queryId);
  if (options?.status) params.set('status', options.status);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  const response = await fetch(`/api/agent-sessions?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch agent sessions');
  }

  const data = await response.json();
  return {
    sessions: data.sessions.map((s: {
      id: string;
      goal: string;
      status: string;
      currentStep: number;
      maxSteps: number;
      toolCalls: ToolCallInfo[] | null;
      todos: AgentTodoItem[] | null;
      currentSql: string | null;
      previousSql: string | null;
      lastStreamingText: string | null;
      lastError: string | null;
      resumptionContext: string | null;
      chatHistory: PersistedChatMessage[] | null;
      queryName: string | null;
      queryCount: number;
      createdAt: number;
      updatedAt: number;
    }) => ({
      id: s.id,
      goal: s.goal,
      status: s.status as AgentSession['status'],
      currentStep: s.currentStep,
      maxSteps: s.maxSteps,
      toolCalls: s.toolCalls || [],
      todos: s.todos || [],
      currentSql: s.currentSql,
      previousSql: s.previousSql,
      lastStreamingText: s.lastStreamingText || '',
      lastError: s.lastError,
      resumptionContext: s.resumptionContext || '',
      chatHistory: s.chatHistory || [],
      queryName: s.queryName || undefined,
      queryCount: s.queryCount,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
    total: data.total,
  };
}

export async function createAgentSession(data: {
  organizationId: string;
  projectId?: string;
  goal: string;
  previousSql?: string;
}): Promise<AgentSession> {
  const response = await fetch('/api/agent-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create agent session');
  }

  const result = await response.json();
  const s = result.session;
  return {
    id: s.id,
    goal: s.goal,
    status: s.status as AgentSession['status'],
    currentStep: s.currentStep,
    maxSteps: s.maxSteps,
    toolCalls: s.toolCalls || [],
    todos: s.todos || [],
    currentSql: s.currentSql,
    previousSql: s.previousSql,
    lastStreamingText: s.lastStreamingText || '',
    lastError: s.lastError,
    resumptionContext: s.resumptionContext || '',
    chatHistory: s.chatHistory || [],
    queryName: s.queryName || undefined,
    projectId: s.projectId || undefined,
    queryId: s.queryId || undefined,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export async function updateAgentSession(
  sessionId: string,
  data: Partial<{
    status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
    currentStep: number;
    toolCalls: ToolCallInfo[];
    todos: AgentTodoItem[];
    currentSql: string | null;
    previousSql: string | null;
    lastStreamingText: string;
    lastError: string | null;
    resumptionContext: string;
    chatHistory: PersistedChatMessage[];
    queryName: string;
  }>
): Promise<AgentSession> {
  const response = await fetch(`/api/agent-sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update agent session');
  }

  const result = await response.json();
  const s = result.session;
  return {
    id: s.id,
    goal: s.goal,
    status: s.status as AgentSession['status'],
    currentStep: s.currentStep,
    maxSteps: s.maxSteps,
    toolCalls: s.toolCalls || [],
    todos: s.todos || [],
    currentSql: s.currentSql,
    previousSql: s.previousSql,
    lastStreamingText: s.lastStreamingText || '',
    lastError: s.lastError,
    resumptionContext: s.resumptionContext || '',
    chatHistory: s.chatHistory || [],
    queryName: s.queryName || undefined,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export async function getAgentSession(sessionId: string): Promise<AgentSession & { queryExecutions: Array<{
  id: string;
  sql: string;
  queryName?: string;
  source: string;
  success: boolean;
  error?: string;
  rowCount?: number;
  executionTime?: number;
  createdAt: number;
}> }> {
  const response = await fetch(`/api/agent-sessions/${sessionId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch agent session');
  }

  const result = await response.json();
  const s = result.session;
  return {
    id: s.id,
    goal: s.goal,
    status: s.status as AgentSession['status'],
    currentStep: s.currentStep,
    maxSteps: s.maxSteps,
    toolCalls: s.toolCalls || [],
    todos: s.todos || [],
    currentSql: s.currentSql,
    previousSql: s.previousSql,
    lastStreamingText: s.lastStreamingText || '',
    lastError: s.lastError,
    resumptionContext: s.resumptionContext || '',
    chatHistory: s.chatHistory || [],
    queryName: s.queryName || undefined,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    queryExecutions: s.queryExecutions || [],
  };
}
