import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConnectionStore {
  connectionString: string | null;
  setConnectionString: (cs: string) => void;
  clearConnection: () => void;
  isConnected: () => boolean;
}

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set, get) => ({
      connectionString: null,

      setConnectionString: (cs: string) => {
        set({ connectionString: cs });
      },

      clearConnection: () => {
        set({ connectionString: null });
      },

      isConnected: () => {
        return get().connectionString !== null;
      },
    }),
    {
      name: 'query-space-connection',
    }
  )
);
