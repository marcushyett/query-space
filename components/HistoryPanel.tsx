'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Typography,
  Button,
  Empty,
  Space,
  Input,
  Tag,
  Popconfirm,
  Spin,
  Grid,
  App,
} from 'antd';
import {
  ClockCircleOutlined,
  RobotOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  SyncOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore } from '@/stores/queryStore';
import { usePersistentAgent } from '@/hooks/usePersistentAgent';
import { useAiChatStore } from '@/stores/aiChatStore';
import type { HistoryItem } from '@/app/api/history/route';

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
  projectId?: string; // Optional: filter by project
  queryId?: string; // Optional: filter by specific query
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function truncateText(text: string, maxLength: number = 80): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength) + '...';
}

export function HistoryPanel({ open, onClose, projectId, queryId }: HistoryPanelProps) {
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const { organizationId } = useConnectionStore();
  const { setCurrentQuery } = useQueryStore();
  const { loadConversationFromSession, resumeSession, reconnectToSession } = usePersistentAgent();
  const { setOpen: setAiChatOpen } = useAiChatStore();

  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ queries: 0, executions: 0, sessions: 0 });

  // Responsive drawer width
  const drawerWidth = screens.md ? 480 : '100%';

  // Load history from API
  const loadHistory = useCallback(async () => {
    if (!organizationId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({ organizationId });
      if (projectId) params.set('projectId', projectId);
      if (queryId) params.set('queryId', queryId);
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/history?${params}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items);
        setCounts(data.counts);
      } else {
        // Log and show error to user
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load history:', response.status, errorData);
        message.error(`Failed to load history: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      message.error('Failed to load history');
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, projectId, queryId, searchQuery, message]);

  useEffect(() => {
    if (open && organizationId) {
      loadHistory();
    }
  }, [open, organizationId, loadHistory]);

  const handleClose = () => {
    onClose();
    setSearchQuery('');
  };

  // Handle restoring SQL from an execution
  const handleRestoreSql = (sql: string) => {
    setCurrentQuery(sql);
    handleClose();
    message.success('SQL restored to editor');
  };

  // Handle viewing an agent session
  const handleViewSession = async (sessionId: string) => {
    handleClose();
    await loadConversationFromSession(sessionId);
    setAiChatOpen(true);
  };

  // Handle joining a running session
  const handleJoinRunningSession = async (sessionId: string) => {
    handleClose();
    const success = await reconnectToSession(sessionId);
    if (success) {
      setAiChatOpen(true);
    } else {
      // Fall back to viewing if reconnect fails (session might have completed)
      await loadConversationFromSession(sessionId);
      setAiChatOpen(true);
    }
  };

  // Handle resuming a paused session
  const handleResumeSession = async (item: HistoryItem) => {
    if (!item.sessionId) return;

    handleClose();
    try {
      const response = await fetch(`/api/agent-sessions/${item.sessionId}`);
      if (response.ok) {
        const data = await response.json();
        const fullSession = {
          id: data.session.id,
          goal: data.session.goal,
          status: data.session.status as 'running' | 'paused' | 'completed' | 'failed',
          currentStep: data.session.currentStep,
          maxSteps: data.session.maxSteps,
          toolCalls: data.session.toolCalls || [],
          todos: data.session.todos || [],
          currentSql: data.session.currentSql,
          previousSql: data.session.previousSql,
          lastStreamingText: data.session.lastStreamingText || '',
          lastError: data.session.lastError,
          resumptionContext: data.session.resumptionContext || '',
          chatHistory: data.session.chatHistory || [],
          queryName: data.session.queryName,
          createdAt: data.session.createdAt,
          updatedAt: data.session.updatedAt,
        };
        await resumeSession(fullSession);
        setAiChatOpen(true);
      }
    } catch (error) {
      console.error('Failed to resume session:', error);
      message.error('Failed to resume session');
    }
  };

  // Handle deleting a session
  const handleDeleteSession = async (sessionId: string) => {
    setDeletingId(sessionId);
    try {
      const response = await fetch(`/api/agent-sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setItems(prev => prev.filter(i => i.sessionId !== sessionId));
        message.success('Session deleted');
      } else {
        message.error('Failed to delete session');
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      message.error('Failed to delete session');
    } finally {
      setDeletingId(null);
    }
  };

  const getItemIcon = (item: HistoryItem) => {
    const iconStyle = { color: '#888', fontSize: 14 };

    if (item.type === 'session') {
      switch (item.status) {
        case 'running':
          return <SyncOutlined spin style={iconStyle} />;
        case 'paused':
          return <PauseCircleOutlined style={iconStyle} />;
        case 'completed':
          return <CheckCircleOutlined style={iconStyle} />;
        case 'failed':
          return <CloseCircleOutlined style={iconStyle} />;
        default:
          return <RobotOutlined style={iconStyle} />;
      }
    }

    if (item.type === 'execution') {
      if (item.source === 'ai') {
        return <RobotOutlined style={iconStyle} />;
      }
      return <UserOutlined style={iconStyle} />;
    }

    return <CodeOutlined style={iconStyle} />;
  };

  const getStatusTag = (item: HistoryItem) => {
    const tagStyle = {
      fontSize: 10,
      marginRight: 4,
      background: '#1a1a1a',
      border: '1px solid #333',
      color: '#888',
    };

    if (item.type === 'session' && item.status) {
      return (
        <Tag style={tagStyle}>
          {item.status}
        </Tag>
      );
    }

    if (item.type === 'execution') {
      return (
        <Tag style={tagStyle}>
          {item.success ? 'OK' : 'Error'}
        </Tag>
      );
    }

    return null;
  };

  const renderItemActions = (item: HistoryItem) => {
    const actions: React.ReactNode[] = [];
    const btnStyle = {
      background: '#1a1a1a',
      border: '1px solid #333',
      color: '#fff',
      fontSize: 11,
      height: 28,
      padding: '0 10px',
    };

    if (item.type === 'session') {
      if (item.status === 'running') {
        actions.push(
          <Button
            key="view"
            size="small"
            style={btnStyle}
            icon={<SyncOutlined spin style={{ fontSize: 11, color: '#888' }} />}
            onClick={(e) => {
              e.stopPropagation();
              if (item.sessionId) {
                handleJoinRunningSession(item.sessionId);
              }
            }}
          >
            View
          </Button>
        );
      } else if (item.status === 'paused') {
        actions.push(
          <Button
            key="resume"
            size="small"
            style={btnStyle}
            icon={<PlayCircleOutlined style={{ fontSize: 11, color: '#888' }} />}
            onClick={(e) => {
              e.stopPropagation();
              handleResumeSession(item);
            }}
          >
            Resume
          </Button>
        );
      }
      actions.push(
        <Popconfirm
          key="delete"
          title="Delete this session?"
          description="This action cannot be undone."
          onConfirm={() => item.sessionId && handleDeleteSession(item.sessionId)}
          okText="Delete"
          cancelText="Cancel"
        >
          <Button
            size="small"
            style={{ ...btnStyle, padding: '0 8px' }}
            icon={<DeleteOutlined style={{ fontSize: 11, color: '#888' }} />}
            loading={deletingId === item.sessionId}
            onClick={(e) => e.stopPropagation()}
          />
        </Popconfirm>
      );
    }

    return actions;
  };

  const handleItemClick = (item: HistoryItem) => {
    if (item.type === 'session' && item.sessionId) {
      // For running sessions, join/reconnect to see live updates
      if (item.status === 'running') {
        handleJoinRunningSession(item.sessionId);
      } else {
        handleViewSession(item.sessionId);
      }
    } else if (item.type === 'execution' && item.sql) {
      handleRestoreSql(item.sql);
    }
  };

  // Group items by type for display
  const sessions = items.filter(i => i.type === 'session');
  const executions = items.filter(i => i.type === 'execution');
  // Include 'pending' in active sessions (sessions that haven't started running yet)
  const activeSessions = sessions.filter(s => s.status === 'running' || s.status === 'paused' || s.status === 'pending');
  const completedSessions = sessions.filter(s => s.status === 'completed' || s.status === 'failed');

  // Render a single history item
  const renderHistoryItem = (item: HistoryItem) => (
    <div
      key={item.sessionId || item.executionId || item.timestamp}
      onClick={() => handleItemClick(item)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid #222',
        cursor: 'pointer',
      }}
    >
      {/* Icon */}
      <div style={{ paddingTop: 2 }}>
        {getItemIcon(item)}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          {getStatusTag(item)}
          <Text
            style={{
              fontSize: 12,
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.type === 'session'
              ? truncateText(item.goal || item.queryName || 'Untitled', 50)
              : truncateText(item.sql || 'Query', 50)}
          </Text>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 11, color: '#666' }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {formatRelativeTime(item.timestamp)}
          </Text>
          {item.type === 'session' && item.queryCount !== undefined && item.queryCount > 0 && (
            <Text style={{ fontSize: 11, color: '#666' }}>
              {item.queryCount} queries
            </Text>
          )}
          {item.type === 'execution' && item.rowCount !== undefined && (
            <Text style={{ fontSize: 11, color: '#666' }}>
              {item.rowCount} rows
            </Text>
          )}
          {item.type === 'execution' && item.executionTime !== undefined && (
            <Text style={{ fontSize: 11, color: '#666' }}>
              {item.executionTime}ms
            </Text>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {renderItemActions(item)}
      </div>
    </div>
  );

  return (
    <Drawer
      title={
        <Space>
          <HistoryOutlined style={{ color: '#888' }} />
          <span>History</span>
          {(counts.sessions > 0 || counts.executions > 0) && (
            <Tag style={{ background: '#1a1a1a', border: '1px solid #333', color: '#888' }}>
              {counts.sessions + counts.executions}
            </Tag>
          )}
        </Space>
      }
      placement="right"
      width={drawerWidth}
      open={open}
      onClose={handleClose}
      styles={{
        body: { padding: screens.md ? 16 : 12 },
      }}
      extra={
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined style={{ color: '#888' }} />}
          onClick={loadHistory}
          loading={isLoading}
          style={{ background: 'transparent' }}
        />
      }
    >
      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search history..."
          prefix={<SearchOutlined style={{ color: '#666' }} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onPressEnter={loadHistory}
          allowClear
          style={{
            background: '#0a0a0a',
            border: '1px solid #333',
          }}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24, color: '#888' }} spin />} />
          <div style={{ marginTop: 12 }}>
            <Text style={{ color: '#666' }}>Loading history...</Text>
          </div>
        </div>
      ) : items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ color: '#666' }}>
              {searchQuery
                ? "No matching items"
                : "No history yet. Run queries or start AI sessions."}
            </span>
          }
        />
      ) : (
        <div>
          {/* Active Sessions (Running/Paused) */}
          {activeSessions.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Active Sessions
              </Text>
              {activeSessions.map(renderHistoryItem)}
            </div>
          )}

          {/* Recent Activity */}
          {(completedSessions.length > 0 || executions.length > 0) && (
            <div>
              <Text style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Recent Activity
              </Text>
              {[...completedSessions, ...executions]
                .sort((a, b) => b.timestamp - a.timestamp)
                .map(renderHistoryItem)}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
