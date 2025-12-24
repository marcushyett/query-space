import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface QueryResult {
  rows: any[];
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
  setQueryResults: (r: QueryResult) => void;
  queryHistory: SavedQuery[];
  addToHistory: (sql: string, rowCount: number | null, executionTime: number | null) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  isExecuting: boolean;
  setIsExecuting: (val: boolean) => void;
}

const MAX_HISTORY_SIZE = 50;

export const useQueryStore = create<QueryStore>()(
  persist(
    (set, get) => ({
      currentQuery: '',
      queryResults: null,
      queryHistory: [],
      isExecuting: false,

      setCurrentQuery: (q: string) => {
        set({ currentQuery: q });
      },

      setQueryResults: (r: QueryResult) => {
        set({ queryResults: r });
      },

      addToHistory: (sql: string, rowCount: number | null, executionTime: number | null) => {
        const newQuery: SavedQuery = {
          id: Date.now().toString(),
          sql,
          timestamp: Date.now(),
          rowCount,
          executionTime,
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
    }),
    {
      name: 'query-space-query',
      partialize: (state) => ({
        queryHistory: state.queryHistory,
        // Don't persist currentQuery, queryResults, or isExecuting
      }),
    }
  )
);
