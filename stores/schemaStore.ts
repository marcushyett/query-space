import { create } from 'zustand';
import type { SchemaTable } from '@/app/api/schema/route';

interface SchemaStore {
  tables: SchemaTable[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  setTables: (tables: SchemaTable[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useSchemaStore = create<SchemaStore>((set) => ({
  tables: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  setTables: (tables: SchemaTable[]) => {
    set({ tables, lastFetched: Date.now(), error: null });
  },

  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  reset: () => {
    set({ tables: [], isLoading: false, error: null, lastFetched: null });
  },
}));
