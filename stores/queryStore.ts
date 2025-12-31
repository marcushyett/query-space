import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface QueryResult {
  rows: Record<string, unknown>[];
  fields: { name: string; dataTypeID: number }[];
  rowCount: number;
  executionTime: number;
}

export type QuerySource = 'manual' | 'ai';

export interface SavedQuery {
  id: string;
  sql: string;
  timestamp: number;
  rowCount: number | null;
  executionTime: number | null;
  // Source tracking: was this run manually or by AI agent?
  source: QuerySource;
  // AI session link for resuming conversations
  aiSessionId?: string;
  queryName?: string;
  // Track whether this query was successful
  success: boolean;
  // Error message if query failed
  error?: string;
  // Project context
  projectId?: string;
}

interface QueryHistoryState {
  // All saved queries, persisted to localStorage
  queries: SavedQuery[];
}

interface QueryStore {
  currentQuery: string;
  setCurrentQuery: (q: string) => void;
  // Query name for AI-generated and user-editable naming
  queryName: string;
  setQueryName: (name: string) => void;
  queryResults: QueryResult | null;
  setQueryResults: (r: QueryResult | null) => void;
  clearResults: () => void;
  // Persisted query history
  queryHistory: SavedQuery[];
  addToHistory: (
    sql: string,
    rowCount: number | null,
    executionTime: number | null,
    options?: {
      aiSessionId?: string;
      queryName?: string;
      source?: QuerySource;
      success?: boolean;
      error?: string;
      projectId?: string;
    }
  ) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  // Get queries for a specific AI session
  getQueriesBySession: (sessionId: string) => SavedQuery[];
  // Get queries filtered by source
  getQueriesBySource: (source: QuerySource) => SavedQuery[];
  // Get successful queries only
  getSuccessfulQueries: () => SavedQuery[];
  // Get queries for a specific project
  getQueriesByProject: (projectId: string) => SavedQuery[];
  isExecuting: boolean;
  setIsExecuting: (val: boolean) => void;
  // Error state
  lastError: string | null;
  setLastError: (error: string | null) => void;
}

const MAX_HISTORY_SIZE = 500; // Increased from 50 for longer history

export const useQueryStore = create<QueryStore>()(
  persist(
    (set, get) => ({
      currentQuery: '',
      queryName: '',
      queryResults: null,
      queryHistory: [],
      isExecuting: false,
      lastError: null,

      setCurrentQuery: (q: string) => {
        set({ currentQuery: q });
      },

      setQueryName: (name: string) => {
        set({ queryName: name });
      },

      setQueryResults: (r: QueryResult | null) => {
        set({ queryResults: r, lastError: null });
      },

      clearResults: () => {
        set({ queryResults: null, lastError: null });
      },

      addToHistory: (
        sql: string,
        rowCount: number | null,
        executionTime: number | null,
        options?: {
          aiSessionId?: string;
          queryName?: string;
          source?: QuerySource;
          success?: boolean;
          error?: string;
          projectId?: string;
        }
      ) => {
        const newQuery: SavedQuery = {
          id: `query-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          sql,
          timestamp: Date.now(),
          rowCount,
          executionTime,
          source: options?.source ?? 'manual',
          aiSessionId: options?.aiSessionId,
          queryName: options?.queryName,
          success: options?.success ?? true,
          error: options?.error,
          projectId: options?.projectId,
        };

        set((state) => {
          const newHistory = [newQuery, ...state.queryHistory].slice(0, MAX_HISTORY_SIZE);
          return { queryHistory: newHistory };
        });
      },

      removeFromHistory: (id: string) => {
        set((state) => ({
          queryHistory: state.queryHistory.filter((q) => q.id !== id),
        }));
      },

      clearHistory: () => {
        set({ queryHistory: [] });
      },

      getQueriesBySession: (sessionId: string) => {
        return get().queryHistory.filter((q) => q.aiSessionId === sessionId);
      },

      getQueriesBySource: (source: QuerySource) => {
        return get().queryHistory.filter((q) => q.source === source);
      },

      getSuccessfulQueries: () => {
        return get().queryHistory.filter((q) => q.success);
      },

      getQueriesByProject: (projectId: string) => {
        return get().queryHistory.filter((q) => q.projectId === projectId);
      },

      setIsExecuting: (val: boolean) => {
        set({ isExecuting: val });
      },

      setLastError: (error: string | null) => {
        set({ lastError: error });
      },
    }),
    {
      name: 'query-space-query-history',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist query history, not transient state like current query or results
        queryHistory: state.queryHistory,
      }),
    }
  )
);
