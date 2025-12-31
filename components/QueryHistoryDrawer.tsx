'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Drawer, List, Typography, Button, Empty, Tooltip, Popconfirm, Grid, Tabs, Tag, Space, Input, Badge, Collapse, Spin } from 'antd';
import {
  DeleteOutlined,
  ClearOutlined,
  ClockCircleOutlined,
  RobotOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  FilterOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useUiStore } from '@/stores/uiStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore, type SavedQuery, type QuerySource, fetchQueryHistory } from '@/stores/queryStore';
import { useAgentSessionStore, type AgentSession, fetchAgentSessions } from '@/stores/agentSessionStore';
import { useAiAgent } from '@/hooks/useAiAgent';

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

interface HistoryItemProps {
  query: SavedQuery;
  onSelect: (sql: string) => void;
  onDelete: (id: string) => void;
  onViewSession?: (sessionId: string) => void;
}

function HistoryItem({ query, onSelect, onDelete, onViewSession }: HistoryItemProps) {
  return (
    <List.Item
      className="history-item"
      onClick={() => onSelect(query.sql)}
      actions={[
        <Tooltip key="delete" title="Delete">
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(query.id);
            }}
            className="icon-muted"
          />
        </Tooltip>,
      ]}
    >
      <List.Item.Meta
        avatar={
          <div style={{ paddingTop: 4 }}>
            {query.source === 'ai' ? (
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
            {query.queryName && (
              <Text strong style={{ display: 'block', fontSize: 13, marginBottom: 2 }}>
                {query.queryName}
              </Text>
            )}
            <Paragraph
              ellipsis={{ rows: 2 }}
              className="history-query-text"
              style={{ marginBottom: 0, fontSize: query.queryName ? 11 : 12 }}
            >
              {truncateQuery(query.sql, 150)}
            </Paragraph>
          </div>
        }
        description={
          <div className="flex items-center gap-3 flex-wrap">
            <Text type="secondary" className="text-xs">
              <ClockCircleOutlined className="icon-muted" /> {formatRelativeTime(query.timestamp)}
            </Text>
            {query.success ? (
              <Tag color="success" style={{ marginRight: 0, fontSize: 10 }}>
                <CheckCircleOutlined /> OK
              </Tag>
            ) : (
              <Tooltip title={query.error}>
                <Tag color="error" style={{ marginRight: 0, fontSize: 10 }}>
                  <CloseCircleOutlined /> Error
                </Tag>
              </Tooltip>
            )}
            {query.rowCount !== null && (
              <Text type="secondary" className="text-xs">
                {query.rowCount} rows
              </Text>
            )}
            {query.executionTime !== null && (
              <Text type="secondary" className="text-xs">
                {query.executionTime}ms
              </Text>
            )}
            {query.aiSessionId && onViewSession && (
              <Button
                type="link"
                size="small"
                style={{ padding: 0, height: 'auto', fontSize: 11 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onViewSession(query.aiSessionId!);
                }}
              >
                View Session
              </Button>
            )}
          </div>
        }
      />
    </List.Item>
  );
}

interface SessionHistoryItemProps {
  session: AgentSession;
  queries: SavedQuery[];
  onResumeSession: (session: AgentSession) => void;
  onLoadSession: (sessionId: string) => void;
  onSelectQuery: (sql: string) => void;
}

function SessionHistoryItem({ session, queries, onResumeSession, onLoadSession, onSelectQuery }: SessionHistoryItemProps) {
  const completedTodos = session.todos.filter(t => t.status === 'completed').length;
  const totalTodos = session.todos.length;
  const successfulQueries = queries.filter(q => q.success).length;

  const statusColor = {
    completed: 'success',
    failed: 'error',
    paused: 'warning',
    running: 'processing',
  }[session.status] as 'success' | 'error' | 'warning' | 'processing';

  return (
    <Collapse
      size="small"
      items={[
        {
          key: session.id,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge status={statusColor} />
                  <Text ellipsis style={{ fontSize: 13, maxWidth: '80%' }}>
                    {session.goal}
                  </Text>
                </div>
                <Space size={8} style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {formatRelativeTime(session.updatedAt)}
                  </Text>
                  {totalTodos > 0 && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {completedTodos}/{totalTodos} tasks
                    </Text>
                  )}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {queries.length} queries ({successfulQueries} OK)
                  </Text>
                </Space>
              </div>
            </div>
          ),
          children: (
            <div>
              {/* Session actions */}
              <Space style={{ marginBottom: 12 }}>
                {session.status === 'paused' && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => onResumeSession(session)}
                  >
                    Resume
                  </Button>
                )}
                <Button
                  size="small"
                  icon={<HistoryOutlined />}
                  onClick={() => onLoadSession(session.id)}
                >
                  Load Conversation
                </Button>
              </Space>

              {/* Session queries */}
              {queries.length > 0 ? (
                <List
                  size="small"
                  dataSource={queries}
                  renderItem={(query) => (
                    <List.Item
                      className="history-item"
                      onClick={() => onSelectQuery(query.sql)}
                      style={{ padding: '8px 0', cursor: 'pointer' }}
                    >
                      <List.Item.Meta
                        title={
                          <Space size={4}>
                            {query.success ? (
                              <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                            ) : (
                              <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />
                            )}
                            <Text style={{ fontSize: 11 }} ellipsis>
                              {query.queryName || truncateQuery(query.sql, 60)}
                            </Text>
                          </Space>
                        }
                        description={
                          <Text type="secondary" style={{ fontSize: 10 }}>
                            {query.rowCount ?? 0} rows, {query.executionTime ?? 0}ms
                          </Text>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>No queries executed in this session</Text>
              )}
            </div>
          ),
        },
      ]}
      style={{ marginBottom: 8 }}
    />
  );
}

export function QueryHistoryDrawer() {
  const { historyDrawerOpen, setHistoryDrawerOpen } = useUiStore();
  const { organizationId } = useConnectionStore();
  const { queryHistory, setQueryHistory, setCurrentQuery, removeFromHistory, clearHistory, getQueriesBySession, isLoadingHistory, setIsLoadingHistory } = useQueryStore();
  const { sessions, setSessions, isLoadingSessions, setIsLoadingSessions } = useAgentSessionStore();
  const { resumeSession, loadConversationFromSession } = useAiAgent();
  const screens = useBreakpoint();

  const [activeTab, setActiveTab] = useState<'queries' | 'sessions'>('queries');
  const [sourceFilter, setSourceFilter] = useState<QuerySource | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Responsive drawer width: full width on mobile, 480px on larger screens
  const drawerWidth = screens.md ? 480 : '100%';

  // Load data from API when drawer opens
  const loadData = useCallback(async () => {
    if (!organizationId) return;

    // Load query history
    setIsLoadingHistory(true);
    try {
      const { executions } = await fetchQueryHistory(organizationId, { limit: 500 });
      setQueryHistory(executions);
    } catch (error) {
      console.error('Failed to load query history:', error);
    } finally {
      setIsLoadingHistory(false);
    }

    // Load agent sessions
    setIsLoadingSessions(true);
    try {
      const { sessions: loadedSessions } = await fetchAgentSessions(organizationId, { limit: 100 });
      setSessions(loadedSessions);
    } catch (error) {
      console.error('Failed to load agent sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [organizationId, setQueryHistory, setIsLoadingHistory, setSessions, setIsLoadingSessions]);

  useEffect(() => {
    if (historyDrawerOpen && organizationId) {
      loadData();
    }
  }, [historyDrawerOpen, organizationId, loadData]);

  // Filter queries based on search and source
  const filteredQueries = useMemo(() => {
    let result = queryHistory;

    // Filter by selected session
    if (selectedSessionId) {
      result = result.filter(q => q.aiSessionId === selectedSessionId);
    }

    // Filter by source
    if (sourceFilter !== 'all') {
      result = result.filter(q => q.source === sourceFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const search = searchQuery.toLowerCase();
      result = result.filter(q =>
        q.sql.toLowerCase().includes(search) ||
        (q.queryName?.toLowerCase().includes(search))
      );
    }

    return result;
  }, [queryHistory, sourceFilter, searchQuery, selectedSessionId]);

  // Get all sessions sorted by updated time
  const allSessions = useMemo(() => {
    return Object.values(sessions)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [sessions]);

  // Stats for tabs
  const manualCount = queryHistory.filter(q => q.source === 'manual').length;
  const aiCount = queryHistory.filter(q => q.source === 'ai').length;

  const handleClose = () => {
    setHistoryDrawerOpen(false);
    setSelectedSessionId(null);
    setSearchQuery('');
  };

  const handleSelectQuery = (sql: string) => {
    setCurrentQuery(sql);
    setHistoryDrawerOpen(false);
  };

  const handleDeleteQuery = (id: string) => {
    removeFromHistory(id);
  };

  const handleClearAll = () => {
    clearHistory();
  };

  const handleViewSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const handleClearSessionFilter = () => {
    setSelectedSessionId(null);
  };

  const handleResumeSession = (session: AgentSession) => {
    setHistoryDrawerOpen(false);
    resumeSession(session);
  };

  const handleLoadSession = (sessionId: string) => {
    setHistoryDrawerOpen(false);
    loadConversationFromSession(sessionId);
  };

  return (
    <Drawer
      title={
        <Space>
          <HistoryOutlined />
          <span>History</span>
        </Space>
      }
      placement="right"
      width={drawerWidth}
      open={historyDrawerOpen}
      onClose={handleClose}
      extra={
        activeTab === 'queries' && queryHistory.length > 0 && !selectedSessionId && (
          <Popconfirm
            title="Clear all history?"
            description="This action cannot be undone."
            onConfirm={handleClearAll}
            okText="Clear"
            cancelText="Cancel"
          >
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined />}
              className="icon-muted"
            >
              Clear All
            </Button>
          </Popconfirm>
        )
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'queries' | 'sessions')}
        items={[
          {
            key: 'queries',
            label: (
              <Space size={4}>
                <SearchOutlined />
                <span>Queries</span>
                <Badge count={queryHistory.length} style={{ backgroundColor: '#333' }} size="small" />
              </Space>
            ),
            children: (
              <div>
                {isLoadingHistory ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                    <div style={{ marginTop: 12 }}>
                      <Text type="secondary">Loading query history...</Text>
                    </div>
                  </div>
                ) : (
                  <>
                {/* Search and filters */}
                {queryHistory.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Input
                      placeholder="Search queries..."
                      prefix={<SearchOutlined style={{ color: '#666' }} />}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      allowClear
                      style={{ marginBottom: 12 }}
                    />

                    {/* Session filter indicator */}
                    {selectedSessionId && (
                      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FilterOutlined style={{ color: '#1890ff' }} />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Showing queries from session
                        </Text>
                        <Button type="link" size="small" onClick={handleClearSessionFilter}>
                          Clear filter
                        </Button>
                      </div>
                    )}

                    {/* Source filter tabs */}
                    {!selectedSessionId && (
                      <Space size={8}>
                        <Button
                          size="small"
                          type={sourceFilter === 'all' ? 'primary' : 'default'}
                          onClick={() => setSourceFilter('all')}
                        >
                          All ({queryHistory.length})
                        </Button>
                        <Button
                          size="small"
                          type={sourceFilter === 'manual' ? 'primary' : 'default'}
                          onClick={() => setSourceFilter('manual')}
                          icon={<UserOutlined />}
                        >
                          Manual ({manualCount})
                        </Button>
                        <Button
                          size="small"
                          type={sourceFilter === 'ai' ? 'primary' : 'default'}
                          onClick={() => setSourceFilter('ai')}
                          icon={<RobotOutlined />}
                        >
                          AI ({aiCount})
                        </Button>
                      </Space>
                    )}
                  </div>
                )}

                {/* Query list */}
                {filteredQueries.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      searchQuery || sourceFilter !== 'all' || selectedSessionId
                        ? "No matching queries"
                        : "No queries in history"
                    }
                  />
                ) : (
                  <List
                    dataSource={filteredQueries}
                    renderItem={(query) => (
                      <HistoryItem
                        key={query.id}
                        query={query}
                        onSelect={handleSelectQuery}
                        onDelete={handleDeleteQuery}
                        onViewSession={handleViewSession}
                      />
                    )}
                  />
                )}
                </>
                )}
              </div>
            ),
          },
          {
            key: 'sessions',
            label: (
              <Space size={4}>
                <RobotOutlined />
                <span>AI Sessions</span>
                <Badge count={allSessions.length} style={{ backgroundColor: '#1890ff' }} size="small" />
              </Space>
            ),
            children: (
              <div>
                {isLoadingSessions ? (
                  <div style={{ textAlign: 'center', padding: 40 }}>
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                    <div style={{ marginTop: 12 }}>
                      <Text type="secondary">Loading AI sessions...</Text>
                    </div>
                  </div>
                ) : allSessions.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No AI sessions yet"
                  />
                ) : (
                  <div>
                    {allSessions.map((session) => (
                      <SessionHistoryItem
                        key={session.id}
                        session={session}
                        queries={getQueriesBySession(session.id)}
                        onResumeSession={handleResumeSession}
                        onLoadSession={handleLoadSession}
                        onSelectQuery={handleSelectQuery}
                      />
                    ))}
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </Drawer>
  );
}
