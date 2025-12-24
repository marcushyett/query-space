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
  toggleHistoryDrawer: () => void;
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

  toggleHistoryDrawer: () =>
    set((state) => ({ historyDrawerOpen: !state.historyDrawerOpen })),

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
