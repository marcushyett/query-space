import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AgentTodoItem, ToolCallInfo } from './aiChatStore';

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

  // Chat messages for context (just user/assistant messages)
  chatHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
}

interface AgentSessionStore {
  // Current active session
  currentSessionId: string | null;

  // All sessions (keyed by ID)
  sessions: Record<string, AgentSession>;

  // Actions
  createSession: (goal: string, previousSql?: string) => string;
  updateSession: (sessionId: string, update: Partial<AgentSession>) => void;
  setCurrentSession: (sessionId: string | null) => void;
  getSession: (sessionId: string) => AgentSession | undefined;
  getCurrentSession: () => AgentSession | undefined;

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
}

// Generate a unique session ID
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Build resumption context from tool calls and todos
function buildResumptionContext(session: AgentSession): string {
  const parts: string[] = [];

  // Add goal
  parts.push(`Goal: ${session.goal}`);

  // Add todo progress
  if (session.todos.length > 0) {
    const completed = session.todos.filter(t => t.status === 'completed').length;
    const inProgress = session.todos.find(t => t.status === 'in_progress');

    parts.push(`\nTodo Progress: ${completed}/${session.todos.length} completed`);

    if (inProgress) {
      parts.push(`Currently working on: ${inProgress.text}`);
    }

    const pending = session.todos.filter(t => t.status === 'pending');
    if (pending.length > 0) {
      parts.push(`Remaining tasks: ${pending.map(t => t.text).join(', ')}`);
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

export const useAgentSessionStore = create<AgentSessionStore>()(
  persist(
    (set, get) => ({
      currentSessionId: null,
      sessions: {},

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
    }),
    {
      name: 'query-space-agent-sessions',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        // Don't persist currentSessionId - it should be null on page load
      }),
    }
  )
);

// Export the context builder for use elsewhere
export { buildResumptionContext };
