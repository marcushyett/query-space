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
}

interface QueryStore {
  currentQuery: string;
  setCurrentQuery: (q: string) => void;
  queryResults: QueryResult | null;
  setQueryResults: (r: QueryResult | null) => void;
  clearResults: () => void;
  // Query history is now stored in database per project
  // Keep local session history for quick access
  sessionHistory: SavedQuery[];
  addToSessionHistory: (sql: string, rowCount: number | null, executionTime: number | null) => void;
  clearSessionHistory: () => void;
  isExecuting: boolean;
  setIsExecuting: (val: boolean) => void;
  // Error state
  lastError: string | null;
  setLastError: (error: string | null) => void;
}

const MAX_SESSION_HISTORY = 20;

export const useQueryStore = create<QueryStore>((set) => ({
  currentQuery: '',
  queryResults: null,
  sessionHistory: [],
  isExecuting: false,
  lastError: null,

  setCurrentQuery: (q: string) => {
    set({ currentQuery: q });
  },

  setQueryResults: (r: QueryResult | null) => {
    set({ queryResults: r, lastError: null });
  },

  clearResults: () => {
    set({ queryResults: null, lastError: null });
  },

  addToSessionHistory: (sql: string, rowCount: number | null, executionTime: number | null) => {
    const newQuery: SavedQuery = {
      id: Date.now().toString(),
      sql,
      timestamp: Date.now(),
      rowCount,
      executionTime,
    };

    set((state) => {
      const newHistory = [newQuery, ...state.sessionHistory].slice(0, MAX_SESSION_HISTORY);
      return { sessionHistory: newHistory };
    });
  },

  clearSessionHistory: () => {
    set({ sessionHistory: [] });
  },

  setIsExecuting: (val: boolean) => {
    set({ isExecuting: val });
  },

  setLastError: (error: string | null) => {
    set({ lastError: error });
  },
}));

// Export deprecated names for backwards compatibility
export const useQueryStore_deprecated = useQueryStore;
