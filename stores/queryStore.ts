import { create } from 'zustand';

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
  source: QuerySource;
  aiSessionId?: string;
  queryId?: string;
  queryName?: string;
  success: boolean;
  error?: string;
  projectId?: string;
}

interface QueryStore {
  currentQuery: string;
  setCurrentQuery: (q: string) => void;
  queryName: string;
  setQueryName: (name: string) => void;
  queryResults: QueryResult | null;
  setQueryResults: (r: QueryResult | null) => void;
  clearResults: () => void;
  // Query history loaded from API
  queryHistory: SavedQuery[];
  setQueryHistory: (queries: SavedQuery[]) => void;
  addToHistory: (query: SavedQuery) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  // Loading state for API calls
  isLoadingHistory: boolean;
  setIsLoadingHistory: (loading: boolean) => void;
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
  lastError: string | null;
  setLastError: (error: string | null) => void;
}

export const useQueryStore = create<QueryStore>()((set, get) => ({
  currentQuery: '',
  queryName: '',
  queryResults: null,
  queryHistory: [],
  isLoadingHistory: false,
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

  setQueryHistory: (queries: SavedQuery[]) => {
    set({ queryHistory: queries });
  },

  addToHistory: (query: SavedQuery) => {
    set((state) => ({
      queryHistory: [query, ...state.queryHistory],
    }));
  },

  removeFromHistory: (id: string) => {
    set((state) => ({
      queryHistory: state.queryHistory.filter((q) => q.id !== id),
    }));
  },

  clearHistory: () => {
    set({ queryHistory: [] });
  },

  setIsLoadingHistory: (loading: boolean) => {
    set({ isLoadingHistory: loading });
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
}));

// API helper functions for query executions
export async function fetchQueryHistory(organizationId: string, options?: {
  projectId?: string;
  queryId?: string;
  agentSessionId?: string;
  source?: 'MANUAL' | 'AI';
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ executions: SavedQuery[]; total: number }> {
  const params = new URLSearchParams({ organizationId });
  if (options?.projectId) params.set('projectId', options.projectId);
  if (options?.queryId) params.set('queryId', options.queryId);
  if (options?.agentSessionId) params.set('agentSessionId', options.agentSessionId);
  if (options?.source) params.set('source', options.source);
  if (options?.search) params.set('search', options.search);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  const response = await fetch(`/api/query-executions?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch query history');
  }

  const data = await response.json();
  return {
    executions: data.executions.map((e: {
      id: string;
      sql: string;
      queryName?: string;
      source: string;
      success: boolean;
      error?: string;
      rowCount?: number;
      executionTime?: number;
      agentSessionId?: string;
      queryId?: string;
      createdAt: number;
    }) => ({
      id: e.id,
      sql: e.sql,
      queryName: e.queryName,
      source: e.source as QuerySource,
      success: e.success,
      error: e.error,
      rowCount: e.rowCount ?? null,
      executionTime: e.executionTime ?? null,
      aiSessionId: e.agentSessionId,
      queryId: e.queryId,
      timestamp: e.createdAt,
    })),
    total: data.total,
  };
}

export async function saveQueryExecution(data: {
  organizationId: string;
  projectId?: string;
  queryId?: string;
  sql: string;
  queryName?: string;
  source: 'MANUAL' | 'AI';
  success: boolean;
  error?: string;
  rowCount?: number;
  executionTime?: number;
  agentSessionId?: string;
}): Promise<SavedQuery> {
  const response = await fetch('/api/query-executions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to save query execution');
  }

  const result = await response.json();
  const e = result.execution;
  return {
    id: e.id,
    sql: e.sql,
    queryName: e.queryName,
    source: e.source as QuerySource,
    success: e.success,
    error: e.error,
    rowCount: e.rowCount ?? null,
    executionTime: e.executionTime ?? null,
    aiSessionId: e.agentSessionId,
    queryId: e.queryId,
    timestamp: e.createdAt,
  };
}
