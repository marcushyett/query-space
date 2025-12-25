import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AiStore {
  apiKey: string | null;
  persistApiKey: boolean;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  setPersistApiKey: (persist: boolean) => void;
  hasApiKey: () => boolean;
}

export const useAiStore = create<AiStore>()(
  persist(
    (set, get) => ({
      apiKey: null,
      persistApiKey: false,

      setApiKey: (key: string) => {
        set({ apiKey: key });
      },

      clearApiKey: () => {
        set({ apiKey: null });
      },

      setPersistApiKey: (persist: boolean) => {
        if (!persist) {
          // Clear API key when user disables persistence
          set({ persistApiKey: persist, apiKey: null });
        } else {
          set({ persistApiKey: persist });
        }
      },

      hasApiKey: () => {
        const key = get().apiKey;
        return key !== null && key.length > 0;
      },
    }),
    {
      name: 'query-space-ai',
      // Only persist if persistApiKey is true
      partialize: (state) =>
        state.persistApiKey
          ? { apiKey: state.apiKey, persistApiKey: state.persistApiKey }
          : { apiKey: null, persistApiKey: false },
    }
  )
);
