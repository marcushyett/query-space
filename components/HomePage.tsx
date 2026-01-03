'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Typography, Grid, Layout, Flex } from 'antd';
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
import { AgentHistoryPanel } from './AgentHistoryPanel';
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
const { Header, Sider, Content } = Layout;

const TABLE_BROWSER_WIDTH = 260;
const TABLE_BROWSER_WIDTH_MOBILE = 200;
const HEADER_HEIGHT = 48; // Main nav header
const TOOLBAR_HEIGHT = 48; // Secondary toolbar

export function HomePage() {
  const router = useRouter();
  const { organizationId } = useConnectionStore();
  const { tableBrowserOpen, toggleTableBrowser, setTableBrowserOpen, historyDrawerOpen, setHistoryDrawerOpen } = useUiStore();
  const { currentQuery, isExecuting } = useQueryStore();
  const { isOpen: aiChatOpen, setOpen: setAiChatOpen, isGenerating: isAiGenerating, agentProgress } = useAiChatStore();
  const isAgentWorking = isAiGenerating || (agentProgress?.isRunning ?? false);
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

  // Calculate available height for main content (viewport - header - toolbar)
  const mainHeight = `calc(100vh - ${HEADER_HEIGHT}px)`;

  return (
    <Layout style={{ width: '100%', height: mainHeight }}>
      {/* Secondary Toolbar */}
      <Header
        style={{
          height: TOOLBAR_HEIGHT,
          lineHeight: `${TOOLBAR_HEIGHT}px`,
          padding: '0 16px',
          background: '#000',
          borderBottom: '1px solid #222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Flex align="center" gap={16}>
          <Button
            type="text"
            icon={tableBrowserOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={toggleTableBrowser}
            aria-label={tableBrowserOpen ? 'Hide sidebar' : 'Show sidebar'}
          />
          <Title level={4} style={{ margin: 0, fontSize: 16 }}>
            Query Space
          </Title>
        </Flex>
        <Flex align="center" gap={16}>
          {organizationId && !isMobile && (
            <Flex align="center" gap={8}>
              <DatabaseOutlined style={{ color: '#666' }} />
              <Text type="secondary" style={{ fontSize: 13 }}>
                Connected
              </Text>
            </Flex>
          )}
          {!organizationId && (
            <Button
              size="small"
              onClick={() => router.push('/settings')}
            >
              Connect
            </Button>
          )}
          {organizationId && (
            <Button
              type={aiChatOpen ? 'primary' : 'text'}
              icon={<RobotOutlined />}
              onClick={handleToggleAiChat}
              aria-label="AI Query Assistant"
            />
          )}
          {isMobile && organizationId && (
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
            onClick={() => setHistoryDrawerOpen(true)}
            aria-label="AI History"
          />
          {!isMobile && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              Cmd+Enter to run
            </Text>
          )}
        </Flex>
      </Header>

      <Layout style={{ flex: 1, overflow: 'hidden' }}>
        {/* Sidebar with Table Browser */}
        <Sider
          width={sidebarWidth}
          collapsed={!tableBrowserOpen}
          collapsedWidth={0}
          trigger={null}
          style={{
            background: '#000',
            borderRight: tableBrowserOpen ? '1px solid #222' : 'none',
            overflow: 'hidden',
          }}
        >
          {tableBrowserOpen && <TableBrowser />}
        </Sider>

        {/* Main Content Area */}
        <Content style={{ display: 'flex', overflow: 'hidden' }}>
          {/* Editor and Results */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ height: '40%', minHeight: 200, borderBottom: '1px solid #222' }}>
              <SqlEditor disabled={isAgentWorking} />
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <QueryResults />
            </div>
          </div>

          {/* AI Chat Panel */}
          <AiChatPanel />
        </Content>
      </Layout>

      <TableDetailDrawer />
      <AgentHistoryPanel
        open={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
      />
    </Layout>
  );
}
