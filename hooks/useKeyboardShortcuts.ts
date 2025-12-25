'use client';

import { useHotkeys } from 'react-hotkeys-hook';
import { useQuery } from './useQuery';
import { useQueryStore } from '@/stores/queryStore';
import { useUiStore } from '@/stores/uiStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useAiChatStore } from '@/stores/aiChatStore';

export function useKeyboardShortcuts() {
  const { executeQuery } = useQuery();
  const { currentQuery } = useQueryStore();
  const connectionString = useConnectionStore((state) => state.connectionString);
  const {
    toggleTableBrowser,
    toggleHistoryDrawer,
    setShortcutsHelpOpen,
    setConnectionDialogOpen,
  } = useUiStore();
  const { toggleOpen: toggleAiChat } = useAiChatStore();

  // Execute query (Cmd+Enter)
  useHotkeys(
    'mod+enter',
    () => {
      if (currentQuery.trim()) {
        executeQuery(currentQuery);
      }
    },
    { enableOnFormTags: true, preventDefault: true }
  );

  // Toggle table browser (Cmd+B)
  useHotkeys('mod+b', () => {
    toggleTableBrowser();
  });

  // Toggle history (Cmd+H)
  useHotkeys('mod+h', () => {
    toggleHistoryDrawer();
  });

  // Show shortcuts help (Cmd+/)
  useHotkeys('mod+/', () => {
    setShortcutsHelpOpen(true);
  });

  // New query (Cmd+N)
  useHotkeys('mod+n', () => {
    useQueryStore.getState().setCurrentQuery('');
  });

  // Cmd+K: AI chat panel (when connected) / Connection dialog (when not)
  useHotkeys('mod+k', () => {
    if (connectionString) {
      toggleAiChat();
    } else {
      setConnectionDialogOpen(true);
    }
  });

  // Escape: Close AI chat panel
  useHotkeys('escape', () => {
    const { isOpen, setOpen } = useAiChatStore.getState();
    if (isOpen) {
      setOpen(false);
    }
  });
}
