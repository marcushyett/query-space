'use client';

import { useEffect } from 'react';
import { Button, Typography, Tooltip, Grid } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DatabaseOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { ConnectionDialog } from './ConnectionDialog';
import { SqlEditor } from './SqlEditor';
import { QueryResults } from './QueryResults';
import { TableBrowser } from './TableBrowser';
import { TableDetailDrawer } from './TableDetailDrawer';
import { QueryHistoryDrawer } from './QueryHistoryDrawer';
import { useConnectionStore } from '@/stores/connectionStore';
import { useUiStore } from '@/stores/uiStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const TABLE_BROWSER_WIDTH = 260;
const TABLE_BROWSER_WIDTH_MOBILE = 200;

export function HomePage() {
  const { connectionString } = useConnectionStore();
  const { setConnectionDialogOpen, tableBrowserOpen, toggleTableBrowser, setTableBrowserOpen, toggleHistoryDrawer } = useUiStore();
  const screens = useBreakpoint();

  // Determine if we're on mobile (xs or sm breakpoints)
  const isMobile = !screens.md;

  useKeyboardShortcuts();

  useEffect(() => {
    if (!connectionString) {
      setConnectionDialogOpen(true);
    }
  }, [connectionString, setConnectionDialogOpen]);

  // Auto-close sidebar on mobile
  useEffect(() => {
    if (isMobile && tableBrowserOpen) {
      setTableBrowserOpen(false);
    }
  }, [isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  const sidebarWidth = isMobile ? TABLE_BROWSER_WIDTH_MOBILE : TABLE_BROWSER_WIDTH;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="flex items-center gap-4">
          <Tooltip title={tableBrowserOpen ? 'Hide sidebar (Cmd+B)' : 'Show sidebar (Cmd+B)'}>
            <Button
              type="text"
              icon={tableBrowserOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
              onClick={toggleTableBrowser}
            />
          </Tooltip>
          <Title level={4} className="app-title">
            Query Space
          </Title>
        </div>
        <div className="flex items-center gap-4">
          {connectionString && !isMobile && (
            <div className="flex items-center gap-2">
              <DatabaseOutlined className="icon-muted" />
              <Text type="secondary" className="text-sm">
                Connected
              </Text>
            </div>
          )}
          <Button
            size="small"
            onClick={() => setConnectionDialogOpen(true)}
          >
            {connectionString ? (isMobile ? 'Connect' : 'Change Connection') : 'Connect'}
          </Button>
          <Tooltip title="Query History (Cmd+H)">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={toggleHistoryDrawer}
            />
          </Tooltip>
          {!isMobile && (
            <Text type="secondary" className="text-xs">
              Cmd+Enter to run
            </Text>
          )}
        </div>
      </header>

      <main className="app-main">
        <aside
          className={tableBrowserOpen ? 'sidebar' : 'sidebar sidebar-hidden'}
          style={{ width: tableBrowserOpen ? sidebarWidth : 0 }}
        >
          {tableBrowserOpen && <TableBrowser />}
        </aside>

        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <div className="editor-pane">
            <SqlEditor />
          </div>
          <div className="results-pane">
            <QueryResults />
          </div>
        </div>
      </main>

      <ConnectionDialog />
      <TableDetailDrawer />
      <QueryHistoryDrawer />
    </div>
  );
}
