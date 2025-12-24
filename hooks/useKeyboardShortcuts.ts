'use client';

import { useHotkeys } from 'react-hotkeys-hook';
import { useQuery } from './useQuery';
import { useQueryStore } from '@/stores/queryStore';
import { useUiStore } from '@/stores/uiStore';

export function useKeyboardShortcuts() {
  const { executeQuery } = useQuery();
  const { currentQuery } = useQueryStore();
  const {
    toggleTableBrowser,
    toggleHistoryDrawer,
    setShortcutsHelpOpen,
    setConnectionDialogOpen,
  } = useUiStore();

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

  // Open connection dialog (Cmd+K when not connected)
  useHotkeys('mod+k', () => {
    setConnectionDialogOpen(true);
  });
}
