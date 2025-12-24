'use client';

import { useEffect } from 'react';
import { Button, Typography, Tooltip } from 'antd';
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

const TABLE_BROWSER_WIDTH = 260;

export function HomePage() {
  const { connectionString } = useConnectionStore();
  const { setConnectionDialogOpen, tableBrowserOpen, toggleTableBrowser, toggleHistoryDrawer } = useUiStore();

  useKeyboardShortcuts();

  useEffect(() => {
    if (!connectionString) {
      setConnectionDialogOpen(true);
    }
  }, [connectionString, setConnectionDialogOpen]);

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
          {connectionString && (
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
            {connectionString ? 'Change Connection' : 'Connect'}
          </Button>
          <Tooltip title="Query History (Cmd+H)">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={toggleHistoryDrawer}
            />
          </Tooltip>
          <Text type="secondary" className="text-xs">
            Cmd+Enter to run
          </Text>
        </div>
      </header>

      <main className="app-main">
        <aside
          className={tableBrowserOpen ? 'sidebar' : 'sidebar sidebar-hidden'}
          style={{ width: tableBrowserOpen ? TABLE_BROWSER_WIDTH : 0 }}
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
