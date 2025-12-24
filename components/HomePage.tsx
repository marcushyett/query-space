'use client';

import { useEffect } from 'react';
import { Button, Typography } from 'antd';
import { ConnectionDialog } from './ConnectionDialog';
import { SqlEditor } from './SqlEditor';
import { QueryResults } from './QueryResults';
import { useConnectionStore } from '@/stores/connectionStore';
import { useUiStore } from '@/stores/uiStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

const { Title, Text } = Typography;

export function HomePage() {
  const { connectionString } = useConnectionStore();
  const { setConnectionDialogOpen } = useUiStore();

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
          padding: '12px 16px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, color: '#fff' }}>
            Query Space
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            PostgreSQL Analytics Tool
          </Text>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {connectionString && (
            <Text
              type="secondary"
              style={{ fontSize: 12, maxWidth: 300 }}
              ellipsis
            >
              Connected
            </Text>
          )}
          <Button
            size="small"
            onClick={() => setConnectionDialogOpen(true)}
          >
            {connectionString ? 'Change Connection' : 'Connect'}
          </Button>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Cmd+Enter to execute
          </Text>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* SQL Editor */}
        <div style={{ height: '40%', borderBottom: '1px solid #333' }}>
          <SqlEditor />
        </div>

        {/* Query Results */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <QueryResults />
        </div>
      </div>

      {/* Connection Dialog */}
      <ConnectionDialog />
    </div>
  );
}
