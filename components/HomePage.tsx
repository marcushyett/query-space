'use client';

import { useEffect } from 'react';
import { Button, Typography, Tooltip } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { ConnectionDialog } from './ConnectionDialog';
import { SqlEditor } from './SqlEditor';
import { QueryResults } from './QueryResults';
import { TableBrowser } from './TableBrowser';
import { TableDetailDrawer } from './TableDetailDrawer';
import { useConnectionStore } from '@/stores/connectionStore';
import { useUiStore } from '@/stores/uiStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

const { Title, Text } = Typography;

const TABLE_BROWSER_WIDTH = 260;

export function HomePage() {
  const { connectionString } = useConnectionStore();
  const { setConnectionDialogOpen, tableBrowserOpen, toggleTableBrowser } = useUiStore();

  // Register keyboard shortcuts
  useKeyboardShortcuts();

  // Show connection dialog if no connection
  useEffect(() => {
    if (!connectionString) {
      setConnectionDialogOpen(true);
    }
  }, [connectionString, setConnectionDialogOpen]);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: 48,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Tooltip title={tableBrowserOpen ? 'Hide sidebar (Cmd+B)' : 'Show sidebar (Cmd+B)'}>
            <Button
              type="text"
              icon={tableBrowserOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
              onClick={toggleTableBrowser}
            />
          </Tooltip>
          <div>
            <Title level={4} style={{ margin: 0, color: '#fff', fontSize: 16 }}>
              Query Space
            </Title>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {connectionString && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <DatabaseOutlined style={{ color: '#52c41a' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
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
          <Text type="secondary" style={{ fontSize: 11 }}>
            Cmd+Enter to run
          </Text>
        </div>
      </div>

      {/* Main Content Area - Three Panel Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Table Browser */}
        <div
          style={{
            width: tableBrowserOpen ? TABLE_BROWSER_WIDTH : 0,
            borderRight: tableBrowserOpen ? '1px solid #333' : 'none',
            overflow: 'hidden',
            transition: 'width 0.2s ease-in-out',
            flexShrink: 0,
          }}
        >
          {tableBrowserOpen && <TableBrowser />}
        </div>

        {/* Center Panel - Editor + Results */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* SQL Editor */}
          <div style={{ height: '40%', minHeight: 200, borderBottom: '1px solid #333' }}>
            <SqlEditor />
          </div>

          {/* Query Results */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <QueryResults />
          </div>
        </div>
      </div>

      {/* Connection Dialog */}
      <ConnectionDialog />

      {/* Table Detail Drawer */}
      <TableDetailDrawer />
    </div>
  );
}
