import { create } from 'zustand';

// This store is now deprecated in favor of organization settings
// Keep it for backwards compatibility with existing components
// The actual connection string is fetched from /api/organizations/[id]/settings

interface ConnectionStore {
  // organizationId is now the primary way to identify connections
  organizationId: string | null;
  // Keep connectionString for backwards compatibility (will be removed)
  connectionString: string | null;
  setOrganizationId: (id: string | null) => void;
  setConnectionString: (cs: string) => void;
  clearConnection: () => void;
  isConnected: () => boolean;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  organizationId: null,
  connectionString: null,

  setOrganizationId: (id: string | null) => {
    set({ organizationId: id });
  },

  setConnectionString: (cs: string) => {
    // Deprecated: use organization settings instead
    set({ connectionString: cs });
  },

  clearConnection: () => {
    set({ connectionString: null, organizationId: null });
  },

  isConnected: () => {
    // Connection is established if we have an organization ID
    // The actual connection string is managed at the org level
    return get().organizationId !== null;
  },
}));
