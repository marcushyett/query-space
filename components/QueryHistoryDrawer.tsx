'use client';

import { Drawer, List, Typography, Button, Empty, Tooltip, Popconfirm, Grid } from 'antd';
import { DeleteOutlined, ClearOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useUiStore } from '@/stores/uiStore';
import { useQueryStore, type SavedQuery } from '@/stores/queryStore';

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
}

function HistoryItem({ query, onSelect, onDelete }: HistoryItemProps) {
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
        title={
          <Paragraph
            ellipsis={{ rows: 2 }}
            className="history-query-text"
          >
            {truncateQuery(query.sql, 150)}
          </Paragraph>
        }
        description={
          <div className="flex items-center gap-3">
            <Text type="secondary" className="text-xs">
              <ClockCircleOutlined className="icon-muted" /> {formatRelativeTime(query.timestamp)}
            </Text>
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
          </div>
        }
      />
    </List.Item>
  );
}

export function QueryHistoryDrawer() {
  const { historyDrawerOpen, setHistoryDrawerOpen } = useUiStore();
  const { queryHistory, setCurrentQuery, removeFromHistory, clearHistory } = useQueryStore();
  const screens = useBreakpoint();

  // Responsive drawer width: full width on mobile, 400px on larger screens
  const drawerWidth = screens.md ? 400 : '100%';

  const handleClose = () => {
    setHistoryDrawerOpen(false);
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

  return (
    <Drawer
      title="Query History"
      placement="right"
      width={drawerWidth}
      open={historyDrawerOpen}
      onClose={handleClose}
      extra={
        queryHistory.length > 0 && (
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
      {queryHistory.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No queries in history"
        />
      ) : (
        <List
          dataSource={queryHistory}
          renderItem={(query) => (
            <HistoryItem
              key={query.id}
              query={query}
              onSelect={handleSelectQuery}
              onDelete={handleDeleteQuery}
            />
          )}
        />
      )}
    </Drawer>
  );
}
