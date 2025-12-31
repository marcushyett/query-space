import { create } from 'zustand';

export interface QueryResult {
  rows: Record<string, unknown>[];
  fields: { name: string; dataTypeID: number }[];
  rowCount: number;
  executionTime: number;
}

export interface SavedQuery {
  id: string;
  sql: string;
  timestamp: number;
  rowCount: number | null;
  executionTime: number | null;
  // AI session link for resuming conversations
  aiSessionId?: string;
  queryName?: string;
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
  // Session-based history (not persisted to localStorage)
  queryHistory: SavedQuery[];
  addToHistory: (sql: string, rowCount: number | null, executionTime: number | null, aiSessionId?: string, queryName?: string) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  isExecuting: boolean;
  setIsExecuting: (val: boolean) => void;
  // Error state
  lastError: string | null;
  setLastError: (error: string | null) => void;
}

const MAX_HISTORY_SIZE = 50;

export const useQueryStore = create<QueryStore>((set) => ({
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

  addToHistory: (sql: string, rowCount: number | null, executionTime: number | null, aiSessionId?: string, queryName?: string) => {
    const newQuery: SavedQuery = {
      id: Date.now().toString(),
      sql,
      timestamp: Date.now(),
      rowCount,
      executionTime,
      aiSessionId,
      queryName,
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

  setIsExecuting: (val: boolean) => {
    set({ isExecuting: val });
  },

  setLastError: (error: string | null) => {
    set({ lastError: error });
  },
}));
