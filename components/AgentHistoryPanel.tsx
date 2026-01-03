'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'antd';
import {
  ClockCircleOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  SyncOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useConnectionStore } from '@/stores/connectionStore';
import { usePersistentAgent } from '@/hooks/usePersistentAgent';

const { Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

interface AgentSessionItem {
  id: string;
  goal: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  currentStep: number;
  maxSteps: number;
  queryName?: string;
  queryCount: number;
  projectId?: string;
  projectName?: string;
  createdAt: number;
  updatedAt: number;
}

interface AgentHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  projectId?: string; // Optional: filter by project
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
  return `${seconds}s ago`;
}

function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function AgentHistoryPanel({ open, onClose, projectId: filterProjectId }: AgentHistoryPanelProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const { organizationId } = useConnectionStore();
  const { loadConversationFromSession, resumeSession } = usePersistentAgent();

  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<AgentSessionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Responsive drawer width: full width on mobile, 480px on larger screens
  const drawerWidth = screens.md ? 480 : '100%';

  // Load sessions from API
  const loadSessions = useCallback(async () => {
    if (!organizationId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({ organizationId });
      if (filterProjectId) {
        params.set('projectId', filterProjectId);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await fetch(`/api/agent-sessions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions.map((s: {
          id: string;
          goal: string;
          status: string;
          currentStep: number;
          maxSteps: number;
          queryName: string | null;
          queryCount: number;
          projectId: string | null;
          projectName: string | null;
          createdAt: number;
          updatedAt: number;
        }) => ({
          id: s.id,
          goal: s.goal,
          status: s.status.toLowerCase() as AgentSessionItem['status'],
          currentStep: s.currentStep,
          maxSteps: s.maxSteps,
          queryName: s.queryName || undefined,
          queryCount: s.queryCount || 0,
          projectId: s.projectId || undefined,
          projectName: s.projectName || undefined,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })));
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, filterProjectId, searchQuery]);

  useEffect(() => {
    if (open && organizationId) {
      loadSessions();
    }
  }, [open, organizationId, loadSessions]);

  const handleClose = () => {
    onClose();
    setSearchQuery('');
  };

  const handleViewSession = async (sessionId: string) => {
    handleClose();
    await loadConversationFromSession(sessionId);
  };

  const handleResumeSession = async (session: AgentSessionItem) => {
    handleClose();
    // Fetch full session data first
    try {
      const response = await fetch(`/api/agent-sessions/${session.id}`);
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
      }
    } catch (error) {
      console.error('Failed to resume session:', error);
      message.error('Failed to resume session');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setDeletingId(sessionId);
    try {
      const response = await fetch(`/api/agent-sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
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

  const handleNavigateToQuery = (projectId: string, sessionId: string) => {
    handleClose();
    // For now, just load the session
    loadConversationFromSession(sessionId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <SyncOutlined spin style={{ color: '#1890ff' }} />;
      case 'paused':
        return <PauseCircleOutlined style={{ color: '#faad14' }} />;
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <RobotOutlined />;
    }
  };

  const getStatusColor = (status: string): 'success' | 'error' | 'warning' | 'processing' | 'default' => {
    switch (status) {
      case 'running':
        return 'processing';
      case 'paused':
        return 'warning';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  // Filter sessions by status for better organization
  const activeSessions = sessions.filter(s => s.status === 'running' || s.status === 'paused');
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const failedSessions = sessions.filter(s => s.status === 'failed');

  return (
    <Drawer
      title={
        <Space>
          <HistoryOutlined />
          <span>AI Agent History</span>
        </Space>
      }
      placement="right"
      width={drawerWidth}
      open={open}
      onClose={handleClose}
    >
      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search sessions..."
          prefix={<SearchOutlined style={{ color: '#666' }} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onPressEnter={loadSessions}
          allowClear
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">Loading sessions...</Text>
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            searchQuery
              ? "No matching sessions"
              : "No AI sessions yet. Start a conversation to see history here."
          }
        />
      ) : (
        <div>
          {/* Active Sessions (Running/Paused) */}
          {activeSessions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <Text strong style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 12 }}>
                Active Sessions
              </Text>
              <List
                size="small"
                dataSource={activeSessions}
                renderItem={(session) => (
                  <List.Item
                    style={{
                      padding: '12px',
                      background: session.status === 'paused' ? 'rgba(250, 173, 20, 0.05)' : 'rgba(24, 144, 255, 0.05)',
                      borderRadius: 8,
                      marginBottom: 8,
                      border: `1px solid ${session.status === 'paused' ? 'rgba(250, 173, 20, 0.2)' : 'rgba(24, 144, 255, 0.2)'}`,
                    }}
                    actions={[
                      session.status === 'paused' && (
                        <Button
                          key="resume"
                          type="primary"
                          size="small"
                          icon={<PlayCircleOutlined />}
                          onClick={() => handleResumeSession(session)}
                        >
                          Resume
                        </Button>
                      ),
                      <Button
                        key="view"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewSession(session.id)}
                      >
                        View
                      </Button>,
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      avatar={getStatusIcon(session.status)}
                      title={
                        <Space size={4}>
                          <Text style={{ fontSize: 13 }} ellipsis>
                            {truncateText(session.goal, 60)}
                          </Text>
                          <Tag color={getStatusColor(session.status)} style={{ fontSize: 10 }}>
                            {session.status}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space size={12}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <ClockCircleOutlined /> {formatRelativeTime(session.updatedAt)}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            Step {session.currentStep}/{session.maxSteps}
                          </Text>
                          {session.queryCount > 0 && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {session.queryCount} queries
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

          {/* Completed Sessions */}
          {completedSessions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <Text strong style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 12 }}>
                Completed ({completedSessions.length})
              </Text>
              <List
                size="small"
                dataSource={completedSessions}
                renderItem={(session) => (
                  <List.Item
                    style={{
                      padding: '12px',
                      background: '#fafafa',
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                    actions={[
                      <Button
                        key="view"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewSession(session.id)}
                      >
                        View
                      </Button>,
                      <Popconfirm
                        key="delete"
                        title="Delete this session?"
                        description="This action cannot be undone."
                        onConfirm={() => handleDeleteSession(session.id)}
                        okText="Delete"
                        cancelText="Cancel"
                      >
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          loading={deletingId === session.id}
                        />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={getStatusIcon(session.status)}
                      title={
                        <Space size={4}>
                          <Text style={{ fontSize: 13 }} ellipsis>
                            {session.queryName || truncateText(session.goal, 50)}
                          </Text>
                        </Space>
                      }
                      description={
                        <Space size={12}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <ClockCircleOutlined /> {formatRelativeTime(session.updatedAt)}
                          </Text>
                          {session.queryCount > 0 && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {session.queryCount} queries
                            </Text>
                          )}
                          {session.projectName && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {session.projectName}
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

          {/* Failed Sessions */}
          {failedSessions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <Text strong style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 12 }}>
                Failed ({failedSessions.length})
              </Text>
              <List
                size="small"
                dataSource={failedSessions}
                renderItem={(session) => (
                  <List.Item
                    style={{
                      padding: '12px',
                      background: 'rgba(255, 77, 79, 0.03)',
                      borderRadius: 8,
                      marginBottom: 8,
                      border: '1px solid rgba(255, 77, 79, 0.1)',
                    }}
                    actions={[
                      <Button
                        key="view"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewSession(session.id)}
                      >
                        View
                      </Button>,
                      <Popconfirm
                        key="delete"
                        title="Delete this session?"
                        description="This action cannot be undone."
                        onConfirm={() => handleDeleteSession(session.id)}
                        okText="Delete"
                        cancelText="Cancel"
                      >
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          loading={deletingId === session.id}
                        />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={getStatusIcon(session.status)}
                      title={
                        <Text style={{ fontSize: 13 }} ellipsis>
                          {truncateText(session.goal, 50)}
                        </Text>
                      }
                      description={
                        <Space size={12}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <ClockCircleOutlined /> {formatRelativeTime(session.updatedAt)}
                          </Text>
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
