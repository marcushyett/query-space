'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Typography, Grid } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DatabaseOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { SqlEditor } from './SqlEditor';
import { QueryResults } from './QueryResults';
import { TableBrowser } from './TableBrowser';
import { TableDetailDrawer } from './TableDetailDrawer';
import { QueryHistoryDrawer } from './QueryHistoryDrawer';
import { AiChatPanel } from './AiChatPanel';
import { useConnectionStore } from '@/stores/connectionStore';
import { useUiStore } from '@/stores/uiStore';
import { useQueryStore } from '@/stores/queryStore';
import { useAiChatStore } from '@/stores/aiChatStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useQuery } from '@/hooks/useQuery';
import { useSchema } from '@/hooks/useSchema';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const TABLE_BROWSER_WIDTH = 260;
const TABLE_BROWSER_WIDTH_MOBILE = 200;

export function HomePage() {
  const router = useRouter();
  const { connectionString } = useConnectionStore();
  const { tableBrowserOpen, toggleTableBrowser, setTableBrowserOpen, toggleHistoryDrawer } = useUiStore();
  const { currentQuery, isExecuting } = useQueryStore();
  const { isOpen: aiChatOpen, setOpen: setAiChatOpen } = useAiChatStore();
  const { executeQuery } = useQuery();
  const screens = useBreakpoint();

  // Fetch schema for autocomplete (automatically triggered when connected)
  useSchema();

  // Determine if we're on mobile (xs or sm breakpoints)
  const isMobile = !screens.md;

  useKeyboardShortcuts();

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

  const handleToggleAiChat = () => {
    setAiChatOpen(!aiChatOpen);
  };

  // Show loading spinner while checking org settings
  if (isLoadingConnection) {
    return (
      <div className="app-container">
        <div className="loading-state-large">
          <Spin size="large" />
        </div>
      </div>
    );
  }

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
              onClick={() => router.push('/settings')}
            >
              Connect
            </Button>
          )}
          {connectionString && (
            <Button
              type={aiChatOpen ? 'primary' : 'text'}
              icon={<RobotOutlined />}
              onClick={handleToggleAiChat}
              aria-label="AI Query Assistant"
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
            icon={<SettingOutlined />}
            onClick={() => router.push('/settings')}
            aria-label="Settings"
          />
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

        <div className="main-content-area">
          <div className="editor-results-container">
            <div className="editor-pane">
              <SqlEditor />
            </div>
            <div className="results-pane">
              <QueryResults />
            </div>
          </div>

          {/* AI Chat Panel */}
          <AiChatPanel />
        </div>
      </main>

      <TableDetailDrawer />
      <QueryHistoryDrawer />
    </div>
  );
}
