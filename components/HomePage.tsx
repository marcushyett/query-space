'use client';

import React, { useEffect } from 'react';
import { Button, Typography, Grid } from 'antd';
// Tooltips disabled for mobile - using aria-labels instead
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DatabaseOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { ConnectionDialog } from './ConnectionDialog';
import { SqlEditor } from './SqlEditor';
import { QueryResults } from './QueryResults';
import { TableBrowser } from './TableBrowser';
import { TableDetailDrawer } from './TableDetailDrawer';
import { QueryHistoryDrawer } from './QueryHistoryDrawer';
import { AiQueryModal } from './AiQueryModal';
import { useConnectionStore } from '@/stores/connectionStore';
import { useUiStore } from '@/stores/uiStore';
import { useQueryStore } from '@/stores/queryStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useQuery } from '@/hooks/useQuery';
import { useSchema } from '@/hooks/useSchema';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const TABLE_BROWSER_WIDTH = 260;
const TABLE_BROWSER_WIDTH_MOBILE = 200;

export function HomePage() {
  const { connectionString } = useConnectionStore();
  const { connectionDialogOpen, setConnectionDialogOpen, tableBrowserOpen, toggleTableBrowser, setTableBrowserOpen, toggleHistoryDrawer, setAiModalOpen } = useUiStore();
  const { currentQuery, isExecuting } = useQueryStore();
  const { executeQuery } = useQuery();
  const screens = useBreakpoint();
  const hasCheckedConnection = React.useRef(false);

  // Fetch schema for autocomplete (automatically triggered when connected)
  useSchema();

  // Determine if we're on mobile (xs or sm breakpoints)
  const isMobile = !screens.md;

  useKeyboardShortcuts();

  // Only show connection dialog if not connected (run once after mount)
  useEffect(() => {
    // Wait for zustand to hydrate and only check once
    const timer = setTimeout(() => {
      if (!hasCheckedConnection.current && !connectionString && !connectionDialogOpen) {
        hasCheckedConnection.current = true;
        setConnectionDialogOpen(true);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [connectionString, connectionDialogOpen, setConnectionDialogOpen]);

  const handleRunQuery = () => {
    if (currentQuery) {
      executeQuery(currentQuery);
    }
  };

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
          <Button
            type="text"
            icon={tableBrowserOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={toggleTableBrowser}
            aria-label={tableBrowserOpen ? 'Hide sidebar' : 'Show sidebar'}
          />
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
          {!connectionString && (
            <Button
              size="small"
              onClick={() => setConnectionDialogOpen(true)}
            >
              Connect
            </Button>
          )}
          {connectionString && (
            <Button
              type="text"
              icon={<RobotOutlined />}
              onClick={() => setAiModalOpen(true)}
              aria-label="Generate SQL with AI"
            />
          )}
          {isMobile && connectionString && (
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={handleRunQuery}
              loading={isExecuting}
            >
              Run
            </Button>
          )}
          <Button
            type="text"
            icon={<HistoryOutlined />}
            onClick={toggleHistoryDrawer}
            aria-label="Query History"
          />
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
      <AiQueryModal />
    </div>
  );
}
