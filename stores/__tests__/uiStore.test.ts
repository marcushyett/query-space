import { describe, it, expect, beforeEach } from 'vitest'
import { useUiStore } from '../uiStore'

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useUiStore.setState({
      tableBrowserOpen: true,
      historyDrawerOpen: false,
      shortcutsHelpOpen: false,
      connectionDialogOpen: false,
      tableDetailDrawerOpen: false,
      selectedTable: null,
      aiModalOpen: false,
    })
  })

  describe('initial state', () => {
    it('should have table browser open by default', () => {
      const state = useUiStore.getState()
      expect(state.tableBrowserOpen).toBe(true)
    })

    it('should have history drawer closed by default', () => {
      const state = useUiStore.getState()
      expect(state.historyDrawerOpen).toBe(false)
    })

    it('should have shortcuts help closed by default', () => {
      const state = useUiStore.getState()
      expect(state.shortcutsHelpOpen).toBe(false)
    })

    it('should have connection dialog closed by default', () => {
      const state = useUiStore.getState()
      expect(state.connectionDialogOpen).toBe(false)
    })

    it('should have table detail drawer closed by default', () => {
      const state = useUiStore.getState()
      expect(state.tableDetailDrawerOpen).toBe(false)
    })

    it('should have no selected table by default', () => {
      const state = useUiStore.getState()
      expect(state.selectedTable).toBeNull()
    })

    it('should have AI modal closed by default', () => {
      const state = useUiStore.getState()
      expect(state.aiModalOpen).toBe(false)
    })
  })

  describe('toggleTableBrowser', () => {
    it('should close table browser when open', () => {
      useUiStore.setState({ tableBrowserOpen: true })
      useUiStore.getState().toggleTableBrowser()

      const state = useUiStore.getState()
      expect(state.tableBrowserOpen).toBe(false)
    })

    it('should open table browser when closed', () => {
      useUiStore.setState({ tableBrowserOpen: false })
      useUiStore.getState().toggleTableBrowser()

      const state = useUiStore.getState()
      expect(state.tableBrowserOpen).toBe(true)
    })

    it('should toggle multiple times', () => {
      useUiStore.getState().toggleTableBrowser()
      expect(useUiStore.getState().tableBrowserOpen).toBe(false)

      useUiStore.getState().toggleTableBrowser()
      expect(useUiStore.getState().tableBrowserOpen).toBe(true)

      useUiStore.getState().toggleTableBrowser()
      expect(useUiStore.getState().tableBrowserOpen).toBe(false)
    })
  })

  describe('toggleHistoryDrawer', () => {
    it('should open history drawer when closed', () => {
      useUiStore.setState({ historyDrawerOpen: false })
      useUiStore.getState().toggleHistoryDrawer()

      const state = useUiStore.getState()
      expect(state.historyDrawerOpen).toBe(true)
    })

    it('should close history drawer when open', () => {
      useUiStore.setState({ historyDrawerOpen: true })
      useUiStore.getState().toggleHistoryDrawer()

      const state = useUiStore.getState()
      expect(state.historyDrawerOpen).toBe(false)
    })
  })

  describe('setShortcutsHelpOpen', () => {
    it('should set shortcuts help open', () => {
      useUiStore.getState().setShortcutsHelpOpen(true)

      const state = useUiStore.getState()
      expect(state.shortcutsHelpOpen).toBe(true)
    })

    it('should set shortcuts help closed', () => {
      useUiStore.setState({ shortcutsHelpOpen: true })
      useUiStore.getState().setShortcutsHelpOpen(false)

      const state = useUiStore.getState()
      expect(state.shortcutsHelpOpen).toBe(false)
    })
  })

  describe('setConnectionDialogOpen', () => {
    it('should set connection dialog open', () => {
      useUiStore.getState().setConnectionDialogOpen(true)

      const state = useUiStore.getState()
      expect(state.connectionDialogOpen).toBe(true)
    })

    it('should set connection dialog closed', () => {
      useUiStore.setState({ connectionDialogOpen: true })
      useUiStore.getState().setConnectionDialogOpen(false)

      const state = useUiStore.getState()
      expect(state.connectionDialogOpen).toBe(false)
    })
  })

  describe('setTableDetailDrawerOpen', () => {
    it('should set table detail drawer open', () => {
      useUiStore.getState().setTableDetailDrawerOpen(true)

      const state = useUiStore.getState()
      expect(state.tableDetailDrawerOpen).toBe(true)
    })

    it('should set table detail drawer closed', () => {
      useUiStore.setState({ tableDetailDrawerOpen: true })
      useUiStore.getState().setTableDetailDrawerOpen(false)

      const state = useUiStore.getState()
      expect(state.tableDetailDrawerOpen).toBe(false)
    })
  })

  describe('setSelectedTable', () => {
    it('should set selected table', () => {
      useUiStore.getState().setSelectedTable('public.users')

      const state = useUiStore.getState()
      expect(state.selectedTable).toBe('public.users')
    })

    it('should clear selected table with null', () => {
      useUiStore.setState({ selectedTable: 'public.users' })
      useUiStore.getState().setSelectedTable(null)

      const state = useUiStore.getState()
      expect(state.selectedTable).toBeNull()
    })

    it('should update selected table', () => {
      useUiStore.getState().setSelectedTable('public.users')
      useUiStore.getState().setSelectedTable('public.orders')

      const state = useUiStore.getState()
      expect(state.selectedTable).toBe('public.orders')
    })
  })

  describe('setAiModalOpen', () => {
    it('should set AI modal open', () => {
      useUiStore.getState().setAiModalOpen(true)

      const state = useUiStore.getState()
      expect(state.aiModalOpen).toBe(true)
    })

    it('should set AI modal closed', () => {
      useUiStore.setState({ aiModalOpen: true })
      useUiStore.getState().setAiModalOpen(false)

      const state = useUiStore.getState()
      expect(state.aiModalOpen).toBe(false)
    })
  })

  describe('multiple state changes', () => {
    it('should handle multiple independent state changes', () => {
      useUiStore.getState().toggleTableBrowser()
      useUiStore.getState().setConnectionDialogOpen(true)
      useUiStore.getState().setSelectedTable('public.users')

      const state = useUiStore.getState()
      expect(state.tableBrowserOpen).toBe(false)
      expect(state.connectionDialogOpen).toBe(true)
      expect(state.selectedTable).toBe('public.users')
    })
  })
})
