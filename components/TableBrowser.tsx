'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tree, Input, Typography, Empty, Button, Alert, Grid, Tooltip } from 'antd';
import { TechSpinner } from './TechSpinner';
import {
  TableOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  DatabaseOutlined,
  FolderOutlined,
  SettingOutlined,
  KeyOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  CloseOutlined,
  RightOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { useTables } from '@/hooks/useTables';
import { useTableInfo } from '@/hooks/useTableInfo';
import { useConnectionStore } from '@/stores/connectionStore';
import { useUiStore } from '@/stores/uiStore';
import { useQueryStore } from '@/stores/queryStore';
import type { TableInfo } from '@/app/api/tables/route';
import type { DataNode } from 'antd/es/tree';
import Link from 'next/link';

const { Text } = Typography;
const { Search } = Input;
const { useBreakpoint } = Grid;

interface TableBrowserProps {
  onTableSelect?: (schema: string, table: string) => void;
  isMobileFullScreen?: boolean;
  onClose?: () => void;
}

export function TableBrowser({ onTableSelect, isMobileFullScreen, onClose }: TableBrowserProps) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { tables, isLoading, error, fetchTables, refreshTables } = useTables();
  const { tableInfo, isLoading: tableInfoLoading, fetchTableInfo, clearTableInfo } = useTableInfo();
  const { organizationId } = useConnectionStore();
  const { setCurrentQuery, currentQuery } = useQueryStore();
  const { tableBrowserOpen, setTableBrowserOpen } = useUiStore();

  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());

  // Handle table click - expand inline to show columns
  const handleTableClick = useCallback((schema: string, tableName: string) => {
    const key = `${schema}.${tableName}`;
    if (expandedTable === key) {
      setExpandedTable(null);
      clearTableInfo();
    } else {
      setExpandedTable(key);
      fetchTableInfo(schema, tableName);
    }
    onTableSelect?.(schema, tableName);
  }, [expandedTable, fetchTableInfo, clearTableInfo, onTableSelect]);

  // Toggle JSON column expansion
  const toggleColumnExpansion = useCallback((columnName: string) => {
    setExpandedColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnName)) {
        next.delete(columnName);
      } else {
        next.add(columnName);
      }
      return next;
    });
  }, []);

  // Run sample query for table
  const runTableSample = useCallback((schema: string, tableName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const query = `SELECT *\nFROM "${schema}"."${tableName}"\nLIMIT 10;`;
    setCurrentQuery(query);
    if (isMobile && onClose) {
      onClose();
    }
  }, [setCurrentQuery, isMobile, onClose]);

  // Run sample query for column
  const runColumnSample = useCallback((schema: string, tableName: string, columnName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const query = `SELECT "${columnName}"\nFROM "${schema}"."${tableName}"\nLIMIT 10;`;
    setCurrentQuery(query);
    if (isMobile && onClose) {
      onClose();
    }
  }, [setCurrentQuery, isMobile, onClose]);

  // Insert column name into query
  const insertColumnName = useCallback((columnName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newQuery = currentQuery
      ? `${currentQuery.trimEnd()} ${columnName}`
      : columnName;
    setCurrentQuery(newQuery);
  }, [currentQuery, setCurrentQuery]);

  // Fetch tables when organization changes
  useEffect(() => {
    if (organizationId) {
      fetchTables();
    }
  }, [organizationId, fetchTables]);

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

  // Get JSON keys from sample data for a column
  const getJsonKeys = useCallback((columnName: string): string[] => {
    if (!tableInfo?.sampleData?.length) return [];

    const keys = new Set<string>();
    tableInfo.sampleData.forEach(row => {
      const value = row[columnName];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.keys(value).forEach(k => keys.add(k));
      }
    });
    return Array.from(keys).sort();
  }, [tableInfo]);

  // Auto-expand schemas when filtered
  const expandedSchemas = useMemo(() => {
    if (searchValue.trim()) {
      return Object.keys(filteredTables);
    }
    return expandedKeys;
  }, [searchValue, filteredTables, expandedKeys]);

  if (!organizationId) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <DatabaseOutlined style={{ fontSize: 32, color: '#666', marginBottom: 8 }} />
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          No database connected
        </Text>
        <Link href="/settings">
          <Button type="primary" size="small" icon={<SettingOutlined />}>
            Connect Database
          </Button>
        </Link>
      </div>
    );
  }

  const containerStyle: React.CSSProperties = isMobileFullScreen
    ? {
        position: 'fixed',
        top: 48,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#000',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      };

  return (
    <div style={containerStyle}>
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
        <div style={{ display: 'flex', gap: 4 }}>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined spin={isLoading} />}
            onClick={refreshTables}
            disabled={isLoading}
            aria-label="Refresh tables"
          />
          {isMobileFullScreen && onClose && (
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={onClose}
              aria-label="Close"
            />
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div style={{ padding: '8px 12px' }}>
          <Alert
            type="error"
            message={error}
            showIcon
            closable
            action={
              <Button size="small" onClick={refreshTables}>
                Retry
              </Button>
            }
          />
        </div>
      )}

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

      {/* Tables List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <TechSpinner size="small" />
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Loading tables...
            </Text>
          </div>
        ) : error && Object.keys(filteredTables).length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <DatabaseOutlined style={{ fontSize: 24, color: '#888', marginBottom: 8 }} />
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Connection failed
            </Text>
            <Link href="/settings">
              <Button size="small" icon={<SettingOutlined />}>
                Go to Settings
              </Button>
            </Link>
          </div>
        ) : Object.keys(filteredTables).length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={searchValue ? 'No matching tables' : 'No tables found'}
          />
        ) : (
          <div style={{ paddingBottom: 16 }}>
            {Object.entries(filteredTables).map(([schema, schemaTables]) => (
              <div key={schema} style={{ marginBottom: 8 }}>
                {/* Schema Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    if (expandedSchemas.includes(schema)) {
                      setExpandedKeys(expandedKeys.filter(k => k !== schema));
                    } else {
                      setExpandedKeys([...expandedKeys, schema]);
                    }
                  }}
                >
                  {expandedSchemas.includes(schema) ? (
                    <DownOutlined style={{ color: '#666', fontSize: 10 }} />
                  ) : (
                    <RightOutlined style={{ color: '#666', fontSize: 10 }} />
                  )}
                  <FolderOutlined style={{ color: '#888' }} />
                  <span style={{ color: '#888' }}>{schema}</span>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    ({schemaTables.length})
                  </Text>
                </div>

                {/* Tables in Schema */}
                {expandedSchemas.includes(schema) && (
                  <div style={{ marginLeft: 16 }}>
                    {schemaTables.map((table) => {
                      const tableKey = `${schema}.${table.name}`;
                      const isExpanded = expandedTable === tableKey;

                      return (
                        <div key={tableKey}>
                          {/* Table Row */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 8px',
                              cursor: 'pointer',
                              borderRadius: 4,
                              background: isExpanded ? '#0a0a0a' : 'transparent',
                            }}
                            onClick={() => handleTableClick(schema, table.name)}
                          >
                            {isExpanded ? (
                              <DownOutlined style={{ color: '#666', fontSize: 10 }} />
                            ) : (
                              <RightOutlined style={{ color: '#666', fontSize: 10 }} />
                            )}
                            {table.type === 'view' ? (
                              <EyeOutlined style={{ color: '#888' }} />
                            ) : (
                              <TableOutlined style={{ color: '#888' }} />
                            )}
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {table.name}
                            </span>
                            {table.rowCount !== null && (
                              <Text type="secondary" style={{ fontSize: 10, flexShrink: 0 }}>
                                ~{formatRowCount(table.rowCount)}
                              </Text>
                            )}
                            <Button
                              type="text"
                              size="small"
                              icon={<PlayCircleOutlined />}
                              onClick={(e) => runTableSample(schema, table.name, e)}
                              style={{ padding: '0 4px', height: 20, opacity: 0.7 }}
                              title="Sample 10 rows"
                            />
                          </div>

                          {/* Expanded Columns */}
                          {isExpanded && (
                            <div style={{ marginLeft: 32, borderLeft: '1px solid #333', paddingLeft: 12 }}>
                              {tableInfoLoading ? (
                                <div style={{ padding: 12, textAlign: 'center' }}>
                                  <TechSpinner size="small" />
                                </div>
                              ) : tableInfo?.columns?.map((col) => {
                                const isJsonType = col.type.toLowerCase().includes('json');
                                const jsonKeys = isJsonType ? getJsonKeys(col.name) : [];
                                const isColumnExpanded = expandedColumns.has(col.name);

                                return (
                                  <div key={col.name}>
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '4px 0',
                                        fontSize: 12,
                                      }}
                                    >
                                      {/* Expand button for JSON columns */}
                                      {isJsonType && jsonKeys.length > 0 ? (
                                        <span
                                          style={{ cursor: 'pointer', width: 12 }}
                                          onClick={() => toggleColumnExpansion(col.name)}
                                        >
                                          {isColumnExpanded ? (
                                            <DownOutlined style={{ color: '#666', fontSize: 8 }} />
                                          ) : (
                                            <RightOutlined style={{ color: '#666', fontSize: 8 }} />
                                          )}
                                        </span>
                                      ) : (
                                        <span style={{ width: 12 }} />
                                      )}

                                      {/* Column icons */}
                                      {col.isPrimaryKey && (
                                        <KeyOutlined style={{ color: '#1890ff', fontSize: 10 }} title="Primary Key" />
                                      )}
                                      {col.isForeignKey && (
                                        <LinkOutlined style={{ color: '#888', fontSize: 10 }} title={`References: ${col.references}`} />
                                      )}

                                      {/* Column name - clickable to insert */}
                                      <span
                                        style={{
                                          cursor: 'pointer',
                                          color: '#d4d4d4',
                                          flex: 1,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                        onClick={(e) => insertColumnName(col.name, e)}
                                        title={`Click to insert "${col.name}"`}
                                      >
                                        {col.name}
                                      </span>

                                      {/* Column type */}
                                      <Text type="secondary" style={{ fontSize: 10, flexShrink: 0 }}>
                                        {col.type}
                                      </Text>

                                      {/* Sample button */}
                                      <Button
                                        type="text"
                                        size="small"
                                        icon={<PlayCircleOutlined />}
                                        onClick={(e) => runColumnSample(schema, table.name, col.name, e)}
                                        style={{ padding: '0 2px', height: 16, opacity: 0.6, fontSize: 10 }}
                                        title="Sample this column"
                                      />
                                    </div>

                                    {/* JSON Keys */}
                                    {isJsonType && isColumnExpanded && jsonKeys.length > 0 && (
                                      <div style={{ marginLeft: 24, borderLeft: '1px solid #222', paddingLeft: 8 }}>
                                        {jsonKeys.map((key) => (
                                          <div
                                            key={key}
                                            style={{
                                              fontSize: 11,
                                              color: '#888',
                                              padding: '2px 0',
                                              cursor: 'pointer',
                                            }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const accessor = `${col.name}->>'${key}'`;
                                              insertColumnName(accessor, e);
                                            }}
                                            title={`Click to insert ${col.name}->>'${key}'`}
                                          >
                                            .{key}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
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
