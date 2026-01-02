'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, List, Typography, Button, Empty, Tooltip, Grid, Tag, Space, Input, Badge, Collapse, Spin } from 'antd';
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
  FileTextOutlined,
  FolderOutlined,
  PauseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useUiStore } from '@/stores/uiStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore } from '@/stores/queryStore';
import { getAgentSession } from '@/stores/agentSessionStore';
import { usePersistentAgent } from '@/hooks/usePersistentAgent';
import type { HistoryItem } from '@/app/api/history/route';

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

interface GroupedHistory {
  queryId: string;
  queryName: string;
  sql?: string;
  projectId?: string;
  projectName?: string;
  timestamp: number;
  executions: HistoryItem[];
  sessions: HistoryItem[];
}

interface QueryHistoryDrawerProps {
  projectId?: string; // Optional: filter by project
}

export function QueryHistoryDrawer({ projectId: filterProjectId }: QueryHistoryDrawerProps = {}) {
  const router = useRouter();
  const { historyDrawerOpen, setHistoryDrawerOpen, currentProjectId } = useUiStore();
  const { organizationId } = useConnectionStore();
  const { setCurrentQuery } = useQueryStore();
  const { resumeSession, loadConversationFromSession } = usePersistentAgent();
  const screens = useBreakpoint();

  const [isLoading, setIsLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'queries' | 'sessions'>('all');

  // Use the filter project or current project
  const effectiveProjectId = filterProjectId || currentProjectId;

  // Responsive drawer width: full width on mobile, 520px on larger screens
  const drawerWidth = screens.md ? 520 : '100%';

  // Load data from API when drawer opens
  const loadData = useCallback(async () => {
    if (!organizationId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({ organizationId });
      if (effectiveProjectId) {
        params.set('projectId', effectiveProjectId);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await fetch(`/api/history?${params}`);
      if (response.ok) {
        const data = await response.json();
        setHistoryItems(data.items);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, effectiveProjectId, searchQuery]);

  useEffect(() => {
    if (historyDrawerOpen && organizationId) {
      loadData();
    }
  }, [historyDrawerOpen, organizationId, loadData]);

  // Group history items by query
  const groupedHistory = useMemo(() => {
    const groups: Map<string, GroupedHistory> = new Map();
    const standaloneItems: HistoryItem[] = [];

    for (const item of historyItems) {
      if (item.type === 'query' && item.queryId) {
        // Create or update group for this query
        if (!groups.has(item.queryId)) {
          groups.set(item.queryId, {
            queryId: item.queryId,
            queryName: item.queryName || 'Untitled Query',
            sql: item.sql,
            projectId: item.projectId,
            projectName: item.projectName,
            timestamp: item.timestamp,
            executions: [],
            sessions: [],
          });
        }
      } else if (item.type === 'execution' && item.queryId) {
        // Add execution to existing group or create new group
        if (!groups.has(item.queryId)) {
          groups.set(item.queryId, {
            queryId: item.queryId,
            queryName: item.queryName || 'Untitled Query',
            sql: item.sql,
            projectId: item.projectId,
            projectName: item.projectName,
            timestamp: item.timestamp,
            executions: [],
            sessions: [],
          });
        }
        groups.get(item.queryId)!.executions.push(item);
      } else if (item.type === 'session' && item.queryId) {
        // Add session to existing group or create new group
        if (!groups.has(item.queryId)) {
          groups.set(item.queryId, {
            queryId: item.queryId,
            queryName: item.queryName || 'Untitled Query',
            projectId: item.projectId,
            projectName: item.projectName,
            timestamp: item.timestamp,
            executions: [],
            sessions: [],
          });
        }
        groups.get(item.queryId)!.sessions.push(item);
      } else {
        // Standalone item (no query association)
        standaloneItems.push(item);
      }
    }

    // Convert to array and sort by timestamp
    const result = Array.from(groups.values()).sort((a, b) => b.timestamp - a.timestamp);

    // Filter based on filterType
    let filtered = result;
    if (filterType === 'sessions') {
      filtered = result.filter(g => g.sessions.length > 0);
    }

    return { groups: filtered, standalone: standaloneItems };
  }, [historyItems, filterType]);

  // Count resumable sessions from history items
  const resumableSessionCount = useMemo(() => {
    return historyItems.filter(
      (item) => item.type === 'session' && (item.status === 'paused' || item.status === 'running')
    ).length;
  }, [historyItems]);

  const handleClose = () => {
    setHistoryDrawerOpen(false);
    setSearchQuery('');
  };

  const handleSelectQuery = (sql: string) => {
    setCurrentQuery(sql);
    setHistoryDrawerOpen(false);
  };

  const handleNavigateToQuery = (projectId: string, queryId: string) => {
    setHistoryDrawerOpen(false);
    router.push(`/projects/${projectId}/query/${queryId}`);
  };

  const handleResumeSession = async (item: HistoryItem) => {
    if (!item.sessionId) return;

    try {
      // Fetch full session from API
      const session = await getAgentSession(item.sessionId);
      setHistoryDrawerOpen(false);
      resumeSession(session);
    } catch (error) {
      console.error('Failed to fetch session for resume:', error);
    }
  };

  const handleLoadSession = async (sessionId: string) => {
    setHistoryDrawerOpen(false);
    await loadConversationFromSession(sessionId);
  };

  const getStatusIcon = (status?: string) => {
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
        return null;
    }
  };

  const getStatusColor = (status?: string): 'success' | 'error' | 'warning' | 'processing' | 'default' => {
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

  return (
    <Drawer
      title={
        <Space>
          <HistoryOutlined />
          <span>History</span>
          {resumableSessionCount > 0 && (
            <Badge count={resumableSessionCount} style={{ backgroundColor: '#faad14' }} />
          )}
        </Space>
      }
      placement="right"
      width={drawerWidth}
      open={historyDrawerOpen}
      onClose={handleClose}
    >
      {/* Search and filters */}
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search queries and sessions..."
          prefix={<SearchOutlined style={{ color: '#666' }} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onPressEnter={loadData}
          allowClear
          style={{ marginBottom: 12 }}
        />

        <Space size={8}>
          <Button
            size="small"
            type={filterType === 'all' ? 'primary' : 'default'}
            onClick={() => setFilterType('all')}
          >
            All
          </Button>
          <Button
            size="small"
            type={filterType === 'queries' ? 'primary' : 'default'}
            onClick={() => setFilterType('queries')}
            icon={<FileTextOutlined />}
          >
            Queries
          </Button>
          <Button
            size="small"
            type={filterType === 'sessions' ? 'primary' : 'default'}
            onClick={() => setFilterType('sessions')}
            icon={<RobotOutlined />}
          >
            AI Sessions
          </Button>
        </Space>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">Loading history...</Text>
          </div>
        </div>
      ) : groupedHistory.groups.length === 0 && groupedHistory.standalone.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            searchQuery
              ? "No matching queries or sessions"
              : "No history yet. Execute queries or start AI sessions to see them here."
          }
        />
      ) : (
        <div>
          {/* Grouped queries with their executions and sessions */}
          {groupedHistory.groups.map((group) => (
            <Collapse
              key={group.queryId}
              size="small"
              defaultActiveKey={group.sessions.some(s => s.status === 'paused' || s.status === 'running') ? [group.queryId] : []}
              items={[
                {
                  key: group.queryId,
                  label: (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <FileTextOutlined style={{ color: '#1890ff' }} />
                          <Text strong ellipsis style={{ fontSize: 13, maxWidth: '70%' }}>
                            {group.queryName}
                          </Text>
                        </div>
                        {group.sql && (
                          <Paragraph
                            ellipsis={{ rows: 1 }}
                            style={{ marginBottom: 4, fontSize: 11, color: '#888' }}
                          >
                            {truncateQuery(group.sql, 80)}
                          </Paragraph>
                        )}
                        <Space size={8}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <ClockCircleOutlined /> {formatRelativeTime(group.timestamp)}
                          </Text>
                          {group.projectName && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              <FolderOutlined /> {group.projectName}
                            </Text>
                          )}
                          {group.executions.length > 0 && (
                            <Tag style={{ fontSize: 10 }}>
                              {group.executions.length} execution{group.executions.length !== 1 ? 's' : ''}
                            </Tag>
                          )}
                          {group.sessions.length > 0 && (
                            <Tag color="blue" style={{ fontSize: 10 }}>
                              <RobotOutlined /> {group.sessions.length} session{group.sessions.length !== 1 ? 's' : ''}
                            </Tag>
                          )}
                        </Space>
                      </div>
                    </div>
                  ),
                  children: (
                    <div>
                      {/* Action buttons */}
                      <Space style={{ marginBottom: 12 }}>
                        {group.projectId && (
                          <Button
                            size="small"
                            type="primary"
                            onClick={() => handleNavigateToQuery(group.projectId!, group.queryId)}
                          >
                            Open Query
                          </Button>
                        )}
                        {group.sql && (
                          <Button
                            size="small"
                            onClick={() => handleSelectQuery(group.sql!)}
                          >
                            Load SQL
                          </Button>
                        )}
                      </Space>

                      {/* AI Sessions for this query */}
                      {group.sessions.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <Text strong style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 8 }}>
                            AI Sessions
                          </Text>
                          <List
                            size="small"
                            dataSource={group.sessions}
                            renderItem={(session) => (
                              <List.Item
                                style={{ padding: '8px 0' }}
                                actions={[
                                  session.status === 'paused' && (
                                    <Button
                                      key="resume"
                                      size="small"
                                      type="primary"
                                      icon={<PlayCircleOutlined />}
                                      onClick={() => handleResumeSession(session)}
                                    >
                                      Resume
                                    </Button>
                                  ),
                                  <Button
                                    key="load"
                                    size="small"
                                    icon={<HistoryOutlined />}
                                    onClick={() => handleLoadSession(session.sessionId!)}
                                  >
                                    Load
                                  </Button>,
                                ].filter(Boolean)}
                              >
                                <List.Item.Meta
                                  avatar={getStatusIcon(session.status)}
                                  title={
                                    <Space size={4}>
                                      <Text style={{ fontSize: 12 }} ellipsis>
                                        {session.goal}
                                      </Text>
                                      <Badge status={getStatusColor(session.status)} />
                                    </Space>
                                  }
                                  description={
                                    <Space size={8}>
                                      <Text type="secondary" style={{ fontSize: 10 }}>
                                        {formatRelativeTime(session.timestamp)}
                                      </Text>
                                      {session.queryCount !== undefined && session.queryCount > 0 && (
                                        <Text type="secondary" style={{ fontSize: 10 }}>
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

                      {/* Executions for this query */}
                      {group.executions.length > 0 && (
                        <div>
                          <Text strong style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 8 }}>
                            Executions
                          </Text>
                          <List
                            size="small"
                            dataSource={group.executions.slice(0, 5)} // Show last 5
                            renderItem={(exec) => (
                              <List.Item
                                style={{ padding: '6px 0', cursor: 'pointer' }}
                                onClick={() => handleSelectQuery(exec.sql!)}
                              >
                                <List.Item.Meta
                                  avatar={
                                    exec.source === 'ai' ? (
                                      <RobotOutlined style={{ color: '#1890ff', fontSize: 14 }} />
                                    ) : (
                                      <UserOutlined style={{ color: '#888', fontSize: 14 }} />
                                    )
                                  }
                                  title={
                                    <Space size={4}>
                                      {exec.success ? (
                                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                                      ) : (
                                        <Tooltip title={exec.error}>
                                          <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />
                                        </Tooltip>
                                      )}
                                      <Text style={{ fontSize: 11 }} ellipsis>
                                        {truncateQuery(exec.sql || '', 50)}
                                      </Text>
                                    </Space>
                                  }
                                  description={
                                    <Space size={8}>
                                      <Text type="secondary" style={{ fontSize: 10 }}>
                                        {formatRelativeTime(exec.timestamp)}
                                      </Text>
                                      {exec.rowCount !== undefined && (
                                        <Text type="secondary" style={{ fontSize: 10 }}>
                                          {exec.rowCount} rows
                                        </Text>
                                      )}
                                      {exec.executionTime !== undefined && (
                                        <Text type="secondary" style={{ fontSize: 10 }}>
                                          {exec.executionTime}ms
                                        </Text>
                                      )}
                                    </Space>
                                  }
                                />
                              </List.Item>
                            )}
                          />
                          {group.executions.length > 5 && (
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                              +{group.executions.length - 5} more executions
                            </Text>
                          )}
                        </div>
                      )}
                    </div>
                  ),
                },
              ]}
              style={{ marginBottom: 8 }}
            />
          ))}

          {/* Standalone items (not linked to a query) */}
          {groupedHistory.standalone.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text strong style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 8 }}>
                Other History
              </Text>
              <List
                size="small"
                dataSource={groupedHistory.standalone}
                renderItem={(item) => (
                  <List.Item
                    style={{ padding: '8px 0', cursor: item.sql ? 'pointer' : 'default' }}
                    onClick={item.sql ? () => handleSelectQuery(item.sql!) : undefined}
                  >
                    <List.Item.Meta
                      avatar={
                        item.type === 'session' ? (
                          getStatusIcon(item.status)
                        ) : item.source === 'ai' ? (
                          <RobotOutlined style={{ color: '#1890ff', fontSize: 14 }} />
                        ) : (
                          <UserOutlined style={{ color: '#888', fontSize: 14 }} />
                        )
                      }
                      title={
                        <Text style={{ fontSize: 12 }} ellipsis>
                          {item.type === 'session' ? item.goal : truncateQuery(item.sql || '', 60)}
                        </Text>
                      }
                      description={
                        <Space size={8}>
                          <Text type="secondary" style={{ fontSize: 10 }}>
                            {formatRelativeTime(item.timestamp)}
                          </Text>
                          {item.type === 'session' && item.status && (
                            <Tag color={getStatusColor(item.status)} style={{ fontSize: 10 }}>
                              {item.status}
                            </Tag>
                          )}
                          {item.type === 'execution' && item.success !== undefined && (
                            item.success ? (
                              <Tag color="success" style={{ fontSize: 10 }}>OK</Tag>
                            ) : (
                              <Tag color="error" style={{ fontSize: 10 }}>Error</Tag>
                            )
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
