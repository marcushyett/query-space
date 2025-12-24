import { create } from 'zustand';

interface UiStore {
  tableBrowserOpen: boolean;
  historyDrawerOpen: boolean;
  shortcutsHelpOpen: boolean;
  connectionDialogOpen: boolean;
  tableDetailDrawerOpen: boolean;
  selectedTable: string | null;
  aiModalOpen: boolean;
  toggleTableBrowser: () => void;
  setTableBrowserOpen: (open: boolean) => void;
  toggleHistoryDrawer: () => void;
  setHistoryDrawerOpen: (open: boolean) => void;
  setShortcutsHelpOpen: (open: boolean) => void;
  setConnectionDialogOpen: (open: boolean) => void;
  setTableDetailDrawerOpen: (open: boolean) => void;
  setSelectedTable: (table: string | null) => void;
  setAiModalOpen: (open: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  tableBrowserOpen: true,
  historyDrawerOpen: false,
  shortcutsHelpOpen: false,
  connectionDialogOpen: false,
  tableDetailDrawerOpen: false,
  selectedTable: null,
  aiModalOpen: false,

  toggleTableBrowser: () =>
    set((state) => ({ tableBrowserOpen: !state.tableBrowserOpen })),

  setTableBrowserOpen: (open: boolean) =>
    set({ tableBrowserOpen: open }),

  toggleHistoryDrawer: () =>
    set((state) => ({ historyDrawerOpen: !state.historyDrawerOpen })),

  setHistoryDrawerOpen: (open: boolean) =>
    set({ historyDrawerOpen: open }),

  setShortcutsHelpOpen: (open: boolean) =>
    set({ shortcutsHelpOpen: open }),

  setConnectionDialogOpen: (open: boolean) =>
    set({ connectionDialogOpen: open }),

  setTableDetailDrawerOpen: (open: boolean) =>
    set({ tableDetailDrawerOpen: open }),

  setSelectedTable: (table: string | null) =>
    set({ selectedTable: table }),

  setAiModalOpen: (open: boolean) =>
    set({ aiModalOpen: open }),
}));
