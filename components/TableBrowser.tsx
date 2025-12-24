'use client';

import { useEffect, useMemo, useState } from 'react';
import { Tree, Input, Typography, Empty, Button } from 'antd';
import { TechSpinner } from './TechSpinner';
import {
  TableOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  DatabaseOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { useTables } from '@/hooks/useTables';
import { useConnectionStore } from '@/stores/connectionStore';
import { useUiStore } from '@/stores/uiStore';
import type { TableInfo } from '@/app/api/tables/route';
import type { DataNode } from 'antd/es/tree';

const { Text } = Typography;
const { Search } = Input;

interface TableBrowserProps {
  onTableSelect?: (schema: string, table: string) => void;
}

export function TableBrowser({ onTableSelect }: TableBrowserProps) {
  const { tables, isLoading, fetchTables, refreshTables } = useTables();
  const { connectionString } = useConnectionStore();
  const { setSelectedTable, setTableDetailDrawerOpen } = useUiStore();
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  // Fetch tables when connection changes
  useEffect(() => {
    if (connectionString) {
      fetchTables();
    }
  }, [connectionString, fetchTables]);

  // Group tables by schema
  const tablesBySchema = useMemo(() => {
    const grouped: Record<string, TableInfo[]> = {};
    tables.forEach((table) => {
      if (!grouped[table.schema]) {
        grouped[table.schema] = [];
      }
      grouped[table.schema].push(table);
    });
    return grouped;
  }, [tables]);

  // Filter tables by search
  const filteredTables = useMemo(() => {
    if (!searchValue.trim()) return tablesBySchema;

    const filtered: Record<string, TableInfo[]> = {};
    const searchLower = searchValue.toLowerCase();

    Object.entries(tablesBySchema).forEach(([schema, schemaTables]) => {
      const matchingTables = schemaTables.filter(
        (table) =>
          table.name.toLowerCase().includes(searchLower) ||
          schema.toLowerCase().includes(searchLower)
      );
      if (matchingTables.length > 0) {
        filtered[schema] = matchingTables;
      }
    });

    return filtered;
  }, [tablesBySchema, searchValue]);

  // Build tree data
  const treeData: DataNode[] = useMemo(() => {
    return Object.entries(filteredTables).map(([schema, schemaTables]) => ({
      key: schema,
      title: (
        <span className="mobile-tree-node">
          <FolderOutlined style={{ color: '#888', flexShrink: 0 }} />
          <span className="table-name">{schema}</span>
          <Text type="secondary" className="row-count">
            ({schemaTables.length})
          </Text>
        </span>
      ),
      selectable: false,
      children: schemaTables.map((table) => ({
        key: `${schema}.${table.name}`,
        title: (
          <span className="mobile-tree-node">
            {table.type === 'view' ? (
              <EyeOutlined style={{ color: '#888', flexShrink: 0 }} />
            ) : (
              <TableOutlined style={{ color: '#888', flexShrink: 0 }} />
            )}
            <span className="table-name">{table.name}</span>
            {table.rowCount !== null && (
              <Text type="secondary" className="row-count">
                ~{formatRowCount(table.rowCount)}
              </Text>
            )}
          </span>
        ),
        isLeaf: true,
      })),
    }));
  }, [filteredTables]);

  // Auto-expand schemas when filtered - using memo pattern to avoid effect setState warning
  const expandedSchemas = useMemo(() => {
    if (searchValue.trim()) {
      return Object.keys(filteredTables);
    }
    return expandedKeys;
  }, [searchValue, filteredTables, expandedKeys]);

  const handleSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length === 0) return;

    const key = selectedKeys[0] as string;
    if (!key.includes('.')) return; // Schema node, not table

    const [schema, table] = key.split('.');
    setSelectedTable(key);
    setTableDetailDrawerOpen(true);
    onTableSelect?.(schema, table);
  };

  if (!connectionString) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <DatabaseOutlined style={{ fontSize: 32, color: '#666', marginBottom: 8 }} />
        <Text type="secondary" style={{ display: 'block' }}>
          Connect to a database to browse tables
        </Text>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text strong>Tables</Text>
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined spin={isLoading} />}
          onClick={refreshTables}
          disabled={isLoading}
          aria-label="Refresh tables"
        />
      </div>

      {/* Search */}
      <div style={{ padding: '8px 12px' }}>
        <Search
          placeholder="Search tables..."
          prefix={<SearchOutlined style={{ color: '#666' }} />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          allowClear
          size="small"
        />
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <TechSpinner size="small" />
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Loading tables...
            </Text>
          </div>
        ) : treeData.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              searchValue ? 'No matching tables' : 'No tables found'
            }
          />
        ) : (
          <Tree
            treeData={treeData}
            onSelect={handleSelect}
            expandedKeys={expandedSchemas}
            onExpand={(keys) => setExpandedKeys(keys as React.Key[])}
            showLine={{ showLeafIcon: false }}
            blockNode
            style={{ background: 'transparent' }}
          />
        )}
      </div>

      {/* Footer with count */}
      {tables.length > 0 && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid #333',
            textAlign: 'center',
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            {tables.length} {tables.length === 1 ? 'table' : 'tables'} in{' '}
            {Object.keys(tablesBySchema).length}{' '}
            {Object.keys(tablesBySchema).length === 1 ? 'schema' : 'schemas'}
          </Text>
        </div>
      )}
    </div>
  );
}

function formatRowCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}
