'use client';

import { useState, useEffect, useCallback } from 'react';
import { List, Typography, Button, Empty, Tooltip, Tag, Space, Spin, Drawer, Grid } from 'antd';
import {
  ClockCircleOutlined,
  RobotOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore, fetchQueryHistory, type SavedQuery } from '@/stores/queryStore';

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

interface QueryVersionsPanelProps {
  queryId: string;
  currentSql: string;
  open: boolean;
  onClose: () => void;
}

export function QueryVersionsPanel({ queryId, currentSql, open, onClose }: QueryVersionsPanelProps) {
  const { organizationId } = useConnectionStore();
  const { setCurrentQuery } = useQueryStore();
  const screens = useBreakpoint();

  const [executions, setExecutions] = useState<SavedQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const drawerWidth = screens.md ? 400 : '100%';

  const loadExecutions = useCallback(async () => {
    if (!organizationId || !queryId || queryId === 'new') return;

    setLoading(true);
    try {
      const { executions: loaded, total: loadedTotal } = await fetchQueryHistory(organizationId, {
        queryId,
        limit: 100,
      });
      setExecutions(loaded);
      setTotal(loadedTotal);
    } catch (error) {
      console.error('Failed to load query versions:', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, queryId]);

  useEffect(() => {
    if (open) {
      loadExecutions();
    }
  }, [open, loadExecutions]);

  const handleRestore = (sql: string) => {
    setCurrentQuery(sql);
    onClose();
  };

  return (
    <Drawer
      title={
        <Space>
          <HistoryOutlined />
          <span>Query History</span>
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
          onClick={loadExecutions}
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
            <Text type="secondary">Loading query history...</Text>
          </div>
        </div>
      ) : executions.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No execution history yet"
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            Run this query to start tracking its history
          </Text>
        </Empty>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Click on a previous version to restore it to the editor
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
    </Drawer>
  );
}
