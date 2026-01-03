'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  List,
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
  Tooltip,
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

const { Text, Paragraph } = Typography;
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
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, projectId, queryId, searchQuery]);

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
    if (item.type === 'session') {
      switch (item.status) {
        case 'running':
          return <SyncOutlined spin style={{ color: '#1890ff' }} />;
        case 'paused':
          return <PauseCircleOutlined style={{ color: '#faad14' }} />;
        case 'completed':
          return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
        case 'failed':
          return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
        default:
          return <RobotOutlined style={{ color: '#1890ff' }} />;
      }
    }

    if (item.type === 'execution') {
      if (item.source === 'ai') {
        return item.success
          ? <RobotOutlined style={{ color: '#52c41a' }} />
          : <RobotOutlined style={{ color: '#ff4d4f' }} />;
      }
      return item.success
        ? <UserOutlined style={{ color: '#52c41a' }} />
        : <UserOutlined style={{ color: '#ff4d4f' }} />;
    }

    return <CodeOutlined style={{ color: '#666' }} />;
  };

  const getStatusTag = (item: HistoryItem) => {
    if (item.type === 'session' && item.status) {
      const colors: Record<string, 'processing' | 'warning' | 'success' | 'error'> = {
        running: 'processing',
        paused: 'warning',
        completed: 'success',
        failed: 'error',
      };
      return (
        <Tag color={colors[item.status]} style={{ fontSize: 10, marginRight: 4 }}>
          {item.status}
        </Tag>
      );
    }

    if (item.type === 'execution') {
      return item.success
        ? <Tag color="success" style={{ fontSize: 10, marginRight: 4 }}>OK</Tag>
        : <Tooltip title={item.error}><Tag color="error" style={{ fontSize: 10, marginRight: 4 }}>Error</Tag></Tooltip>;
    }

    return null;
  };

  const renderItemActions = (item: HistoryItem) => {
    const actions: React.ReactNode[] = [];

    if (item.type === 'session') {
      if (item.status === 'running') {
        actions.push(
          <Button
            key="view"
            type="primary"
            size="small"
            icon={<SyncOutlined spin />}
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
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
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
            danger
            icon={<DeleteOutlined />}
            loading={deletingId === item.sessionId}
            onClick={(e) => e.stopPropagation()}
          />
        </Popconfirm>
      );
    }

    if (item.type === 'execution' && item.sql) {
      actions.push(
        <Button
          key="restore"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            handleRestoreSql(item.sql!);
          }}
        >
          Restore
        </Button>
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
  const activeSessions = sessions.filter(s => s.status === 'running' || s.status === 'paused');
  const completedSessions = sessions.filter(s => s.status === 'completed' || s.status === 'failed');

  return (
    <Drawer
      title={
        <Space>
          <HistoryOutlined />
          <span>History</span>
          {(counts.sessions > 0 || counts.executions > 0) && (
            <Tag>{counts.sessions + counts.executions}</Tag>
          )}
        </Space>
      }
      placement="right"
      width={drawerWidth}
      open={open}
      onClose={handleClose}
      extra={
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          onClick={loadHistory}
          loading={isLoading}
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
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">Loading history...</Text>
          </div>
        </div>
      ) : items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            searchQuery
              ? "No matching items"
              : "No history yet. Run queries or start AI sessions."
          }
        />
      ) : (
        <div>
          {/* Active Sessions (Running/Paused) */}
          {activeSessions.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Text strong style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>
                Active Sessions
              </Text>
              <List
                size="small"
                dataSource={activeSessions}
                renderItem={(item) => (
                  <List.Item
                    style={{
                      padding: '10px 12px',
                      background: item.status === 'paused' ? 'rgba(250, 173, 20, 0.05)' : 'rgba(24, 144, 255, 0.05)',
                      borderRadius: 6,
                      marginBottom: 6,
                      border: `1px solid ${item.status === 'paused' ? 'rgba(250, 173, 20, 0.2)' : 'rgba(24, 144, 255, 0.2)'}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => handleItemClick(item)}
                    actions={renderItemActions(item)}
                  >
                    <List.Item.Meta
                      avatar={getItemIcon(item)}
                      title={
                        <Space size={4}>
                          {getStatusTag(item)}
                          <Text style={{ fontSize: 12 }} ellipsis>
                            {truncateText(item.goal || item.queryName || 'Untitled', 50)}
                          </Text>
                        </Space>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          <ClockCircleOutlined /> {formatRelativeTime(item.timestamp)}
                          {item.queryCount !== undefined && item.queryCount > 0 && (
                            <span style={{ marginLeft: 8 }}>{item.queryCount} queries</span>
                          )}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          )}

          {/* Recent Activity (Completed Sessions + Executions mixed by time) */}
          {(completedSessions.length > 0 || executions.length > 0) && (
            <div>
              <Text strong style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>
                Recent Activity
              </Text>
              <List
                size="small"
                dataSource={[...completedSessions, ...executions].sort((a, b) => b.timestamp - a.timestamp)}
                renderItem={(item) => (
                  <List.Item
                    style={{
                      padding: '10px 12px',
                      background: '#fafafa',
                      borderRadius: 6,
                      marginBottom: 6,
                      cursor: 'pointer',
                    }}
                    onClick={() => handleItemClick(item)}
                    actions={renderItemActions(item)}
                  >
                    <List.Item.Meta
                      avatar={getItemIcon(item)}
                      title={
                        <Space size={4}>
                          {getStatusTag(item)}
                          <Text style={{ fontSize: 12 }} ellipsis>
                            {item.type === 'session'
                              ? truncateText(item.goal || 'AI Session', 50)
                              : truncateText(item.sql || 'Query', 50)}
                          </Text>
                        </Space>
                      }
                      description={
                        <Space size={12}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <ClockCircleOutlined /> {formatRelativeTime(item.timestamp)}
                          </Text>
                          {item.type === 'execution' && item.rowCount !== undefined && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {item.rowCount} rows
                            </Text>
                          )}
                          {item.type === 'execution' && item.executionTime !== undefined && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {item.executionTime}ms
                            </Text>
                          )}
                          {item.type === 'session' && item.queryCount !== undefined && item.queryCount > 0 && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {item.queryCount} queries
                            </Text>
                          )}
                          {item.projectName && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {item.projectName}
                            </Text>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
