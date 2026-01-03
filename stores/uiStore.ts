import { create } from 'zustand';

interface UiStore {
  tableBrowserOpen: boolean;
  shortcutsHelpOpen: boolean;
  connectionDialogOpen: boolean;
  tableDetailDrawerOpen: boolean;
  selectedTable: string | null;
  currentProjectId: string | null;
  currentQueryId: string | null;
  toggleTableBrowser: () => void;
  setTableBrowserOpen: (open: boolean) => void;
  setShortcutsHelpOpen: (open: boolean) => void;
  setConnectionDialogOpen: (open: boolean) => void;
  setTableDetailDrawerOpen: (open: boolean) => void;
  setSelectedTable: (table: string | null) => void;
  setCurrentProjectId: (projectId: string | null) => void;
  setCurrentQueryId: (queryId: string | null) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  tableBrowserOpen: true,
  shortcutsHelpOpen: false,
  connectionDialogOpen: false,
  tableDetailDrawerOpen: false,
  selectedTable: null,
  currentProjectId: null,
  currentQueryId: null,

  toggleTableBrowser: () =>
    set((state) => ({ tableBrowserOpen: !state.tableBrowserOpen })),

  setTableBrowserOpen: (open: boolean) =>
    set({ tableBrowserOpen: open }),

  setShortcutsHelpOpen: (open: boolean) =>
    set({ shortcutsHelpOpen: open }),

  setConnectionDialogOpen: (open: boolean) =>
    set({ connectionDialogOpen: open }),

  setTableDetailDrawerOpen: (open: boolean) =>
    set({ tableDetailDrawerOpen: open }),

  setSelectedTable: (table: string | null) =>
    set({ selectedTable: table }),

  setCurrentProjectId: (projectId: string | null) =>
    set({ currentProjectId: projectId }),

  setCurrentQueryId: (queryId: string | null) =>
    set({ currentQueryId: queryId }),
}));
