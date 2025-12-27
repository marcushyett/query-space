'use client';

import React, { useState } from 'react';
import { Typography, Collapse, Space, Table, Button, Tooltip, Tag } from 'antd';
import {
  CodeOutlined,
  DownOutlined,
  RightOutlined,
  PlayCircleOutlined,
  CopyOutlined,
  CheckOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import type { QueryMetadata } from '@/stores/aiChatStore';

const { Text, Paragraph } = Typography;

interface ExpandableQueryProps {
  queryMetadata: QueryMetadata;
  onLoadQuery?: (sql: string) => void;
  compact?: boolean;
}

export function ExpandableQuery({ queryMetadata, onLoadQuery, compact = false }: ExpandableQueryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const { sql, title, description, rowCount, executionTime, sampleResults } = queryMetadata;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Generate columns for sample results table
  const sampleColumns = sampleResults && sampleResults.length > 0
    ? Object.keys(sampleResults[0]).slice(0, 5).map((key) => ({
        title: key,
        dataIndex: key,
        key,
        ellipsis: true,
        width: 120,
        render: (value: unknown) => {
          if (value === null) return <Text type="secondary">null</Text>;
          if (typeof value === 'object') {
            const str = JSON.stringify(value);
            return <Text code style={{ fontSize: 10 }}>{str.length > 30 ? str.slice(0, 30) + '...' : str}</Text>;
          }
          const str = String(value);
          return str.length > 25 ? str.slice(0, 25) + '...' : str;
        },
      }))
    : [];

  return (
    <div className="expandable-query">
      {/* Header with title */}
      <div className="expandable-query-header" onClick={() => setIsExpanded(!isExpanded)}>
        <Space size={8} style={{ flex: 1 }}>
          <DatabaseOutlined style={{ color: '#1890ff' }} />
          <Text strong style={{ fontSize: compact ? 12 : 13 }}>{title}</Text>
          <Tag color="success" style={{ fontSize: 10, margin: 0 }}>
            {rowCount} rows
          </Tag>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {executionTime}ms
          </Text>
        </Space>
        <Space size={4}>
          {onLoadQuery && (
            <Tooltip title="Load this query">
              <Button
                size="small"
                type="text"
                icon={<PlayCircleOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadQuery(sql);
                }}
              />
            </Tooltip>
          )}
          <Button
            size="small"
            type="text"
            icon={isExpanded ? <DownOutlined /> : <RightOutlined />}
          />
        </Space>
      </div>

      {/* Expandable content */}
      <Collapse
        ghost
        activeKey={isExpanded ? ['content'] : []}
        onChange={() => setIsExpanded(!isExpanded)}
        items={[
          {
            key: 'content',
            showArrow: false,
            label: null,
            children: (
              <div className="expandable-query-content">
                {/* Description (moved inside expandable section) */}
                {description && (
                  <Paragraph
                    type="secondary"
                    style={{
                      fontSize: 11,
                      margin: '0 0 12px 0',
                    }}
                  >
                    {description}
                  </Paragraph>
                )}

                {/* SQL Query */}
                <div className="expandable-query-sql">
                  <div className="expandable-query-sql-header">
                    <Space size={4}>
                      <CodeOutlined style={{ fontSize: 11 }} />
                      <Text type="secondary" style={{ fontSize: 10 }}>SQL Query</Text>
                    </Space>
                    <Tooltip title={copied ? 'Copied!' : 'Copy SQL'}>
                      <Button
                        size="small"
                        type="text"
                        icon={copied ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
                        onClick={handleCopy}
                        style={{ fontSize: 10 }}
                      />
                    </Tooltip>
                  </div>
                  <pre className="expandable-query-code">{sql}</pre>
                </div>

                {/* Sample Results */}
                {sampleResults && sampleResults.length > 0 && (
                  <div className="expandable-query-results">
                    <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>
                      Sample results ({Math.min(sampleResults.length, 3)} of {rowCount}):
                    </Text>
                    <Table
                      dataSource={sampleResults.slice(0, 3).map((row, idx) => ({ ...row, key: idx }))}
                      columns={sampleColumns}
                      size="small"
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                      style={{ fontSize: 11 }}
                    />
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
