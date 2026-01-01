'use client';

import { useState, useEffect, useCallback } from 'react';
import { List, Typography, Button, Empty, Tooltip, Tag, Space, Spin, Drawer, Grid, Divider, Badge } from 'antd';
import {
  ClockCircleOutlined,
  RobotOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
  LoadingOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore, fetchQueryHistory, type SavedQuery } from '@/stores/queryStore';
import { fetchAgentSessions, type AgentSession } from '@/stores/agentSessionStore';
import { usePersistentAgent } from '@/hooks/usePersistentAgent';

const { Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

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

function truncateQuery(sql: string, maxLength: number = 100): string {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength) + '...';
}

interface VersionItemProps {
  execution: SavedQuery;
  isCurrentVersion: boolean;
  onRestore: (sql: string) => void;
}

function VersionItem({ execution, isCurrentVersion, onRestore }: VersionItemProps) {
  return (
    <List.Item
      className="history-item"
      style={{
        cursor: isCurrentVersion ? 'default' : 'pointer',
        opacity: isCurrentVersion ? 0.7 : 1,
        background: isCurrentVersion ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
      }}
      onClick={() => !isCurrentVersion && onRestore(execution.sql)}
    >
      <List.Item.Meta
        avatar={
          <div style={{ paddingTop: 4 }}>
            {execution.source === 'ai' ? (
              <Tooltip title="AI Generated">
                <RobotOutlined style={{ color: '#1890ff', fontSize: 16 }} />
              </Tooltip>
            ) : (
              <Tooltip title="Manual">
                <UserOutlined style={{ color: '#888', fontSize: 16 }} />
              </Tooltip>
            )}
          </div>
        }
        title={
          <div>
            <Space size={8}>
              {isCurrentVersion && (
                <Tag color="blue" style={{ marginRight: 0, fontSize: 10 }}>Current</Tag>
              )}
              {execution.success ? (
                <Tag color="success" style={{ marginRight: 0, fontSize: 10 }}>
                  <CheckCircleOutlined /> OK
                </Tag>
              ) : (
                <Tooltip title={execution.error}>
                  <Tag color="error" style={{ marginRight: 0, fontSize: 10 }}>
                    <CloseCircleOutlined /> Error
                  </Tag>
                </Tooltip>
              )}
            </Space>
            <Paragraph
              ellipsis={{ rows: 2 }}
              className="history-query-text"
              style={{ marginBottom: 0, marginTop: 4, fontSize: 11, fontFamily: 'monospace' }}
            >
              {truncateQuery(execution.sql, 150)}
            </Paragraph>
          </div>
        }
        description={
          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 4 }}>
            <Text type="secondary" className="text-xs">
              <ClockCircleOutlined className="icon-muted" /> {formatRelativeTime(execution.timestamp)}
            </Text>
            {execution.rowCount !== null && (
              <Text type="secondary" className="text-xs">
                {execution.rowCount} rows
              </Text>
            )}
            {execution.executionTime !== null && (
              <Text type="secondary" className="text-xs">
                {execution.executionTime}ms
              </Text>
            )}
          </div>
        }
      />
    </List.Item>
  );
}

interface SessionItemProps {
  session: AgentSession;
  onResume: (session: AgentSession) => void;
  onLoad: (session: AgentSession) => void;
}

function SessionItem({ session, onResume, onLoad }: SessionItemProps) {
  const completedTodos = session.todos.filter(t => t.status === 'completed').length;
  const totalTodos = session.todos.length;

  const statusColor = {
    completed: 'success',
    failed: 'error',
    paused: 'warning',
    running: 'processing',
  }[session.status] as 'success' | 'error' | 'warning' | 'processing';

  const canResume = session.status === 'paused';

  return (
    <List.Item
      className="history-item"
      style={{ cursor: 'pointer' }}
      onClick={() => onLoad(session)}
    >
      <List.Item.Meta
        avatar={
          <div style={{ paddingTop: 4 }}>
            <Badge status={statusColor}>
              <RobotOutlined style={{ color: '#1890ff', fontSize: 16 }} />
            </Badge>
          </div>
        }
        title={
          <div>
            <Space size={8}>
              <Tag color={statusColor} style={{ marginRight: 0, fontSize: 10 }}>
                {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
              </Tag>
              {totalTodos > 0 && (
                <Text type="secondary" style={{ fontSize: 10 }}>
                  {completedTodos}/{totalTodos} tasks
                </Text>
              )}
            </Space>
            <Paragraph
              ellipsis={{ rows: 2 }}
              style={{ marginBottom: 0, marginTop: 4, fontSize: 12 }}
            >
              {session.goal}
            </Paragraph>
          </div>
        }
        description={
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" className="text-xs">
              <ClockCircleOutlined className="icon-muted" /> {formatRelativeTime(session.updatedAt)}
            </Text>
            {session.queryCount !== undefined && session.queryCount > 0 && (
              <Text type="secondary" className="text-xs" style={{ marginLeft: 12 }}>
                {session.queryCount} queries
              </Text>
            )}
          </div>
        }
      />
      <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
        {canResume && (
          <Tooltip title="Resume session">
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => onResume(session)}
            >
              Resume
            </Button>
          </Tooltip>
        )}
        <Tooltip title="Load conversation">
          <Button
            size="small"
            icon={<MessageOutlined />}
            onClick={() => onLoad(session)}
          >
            Load
          </Button>
        </Tooltip>
      </div>
    </List.Item>
  );
}

interface QueryVersionsPanelProps {
  queryId: string;
  currentSql: string;
  open: boolean;
  onClose: () => void;
}

export function QueryVersionsPanel({ queryId, currentSql, open, onClose }: QueryVersionsPanelProps) {
  const { organizationId } = useConnectionStore();
  const { setCurrentQuery } = useQueryStore();
  const { resumeSession, loadConversationFromSession } = usePersistentAgent();
  const screens = useBreakpoint();

  const [executions, setExecutions] = useState<SavedQuery[]>([]);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const drawerWidth = screens.md ? 400 : '100%';

  const loadData = useCallback(async () => {
    if (!organizationId || !queryId || queryId === 'new') return;

    setLoading(true);
    try {
      // Load both query executions and AI sessions in parallel
      const [executionsResult, sessionsResult] = await Promise.all([
        fetchQueryHistory(organizationId, {
          queryId,
          limit: 100,
        }),
        fetchAgentSessions(organizationId, {
          queryId,
          limit: 50,
        }),
      ]);

      setExecutions(executionsResult.executions);
      setTotal(executionsResult.total);
      setSessions(sessionsResult.sessions);
    } catch (error) {
      console.error('Failed to load query history:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, queryId]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  const handleRestore = (sql: string) => {
    setCurrentQuery(sql);
    onClose();
  };

  const handleResumeSession = async (session: AgentSession) => {
    const success = await resumeSession(session);
    if (success) {
      onClose();
    }
  };

  const handleLoadSession = (session: AgentSession) => {
    loadConversationFromSession(session.id);
    onClose();
  };

  const hasContent = executions.length > 0 || sessions.length > 0;

  return (
    <Drawer
      title={
        <Space>
          <HistoryOutlined />
          <span>History</span>
          {total > 0 && (
            <Tag style={{ marginLeft: 4 }}>{total}</Tag>
          )}
        </Space>
      }
      placement="right"
      width={drawerWidth}
      open={open}
      onClose={onClose}
      extra={
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          onClick={loadData}
          loading={loading}
        >
          Refresh
        </Button>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">Loading history...</Text>
          </div>
        </div>
      ) : !hasContent ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No history yet"
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            Run queries or start an AI session to build history
          </Text>
        </Empty>
      ) : (
        <>
          {/* AI Sessions Section */}
          {sessions.length > 0 && (
            <>
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: 13 }}>
                  <RobotOutlined style={{ marginRight: 6 }} />
                  AI Sessions
                </Text>
              </div>
              <List
                size="small"
                dataSource={sessions}
                renderItem={(session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    onResume={handleResumeSession}
                    onLoad={handleLoadSession}
                  />
                )}
              />
              {executions.length > 0 && <Divider style={{ margin: '16px 0' }} />}
            </>
          )}

          {/* Query Executions Section */}
          {executions.length > 0 && (
            <>
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: 13 }}>
                  <HistoryOutlined style={{ marginRight: 6 }} />
                  Query Executions
                </Text>
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                  Click to restore
                </Text>
              </div>
              <List
                dataSource={executions}
                renderItem={(execution) => (
                  <VersionItem
                    key={execution.id}
                    execution={execution}
                    isCurrentVersion={execution.sql.trim() === currentSql.trim()}
                    onRestore={handleRestore}
                  />
                )}
              />
            </>
          )}
        </>
      )}
    </Drawer>
  );
}
