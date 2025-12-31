'use client';

import React, { useState } from 'react';
import { Typography, Space, Button, Tooltip, Collapse } from 'antd';
import {
  CheckCircleOutlined,
  CodeOutlined,
  CopyOutlined,
  CheckOutlined,
  PlayCircleOutlined,
  DownOutlined,
  RightOutlined,
  DiffOutlined,
} from '@ant-design/icons';
import { computeSqlDiff } from '@/lib/sqlDiff';

const { Text } = Typography;

interface AgentSummaryProps {
  summary: string;
  sql: string;
  previousSql?: string;
  explanation?: string;
  confidence?: 'high' | 'medium' | 'low';
  suggestions?: string[];
  onLoadQuery?: (sql: string) => void;
}

export function AgentSummary({
  summary,
  sql,
  previousSql,
  onLoadQuery,
}: AgentSummaryProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [copied, setCopied] = useState(false);

  // Compute diff if there's a previous SQL
  const hasDiff = previousSql && previousSql !== sql;
  const diff = hasDiff ? computeSqlDiff(previousSql!, sql) : null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      className="agent-summary"
      style={{
        background: 'rgba(82, 196, 26, 0.1)',
        border: '1px solid rgba(82, 196, 26, 0.3)',
        borderRadius: 6,
        padding: '10px 12px',
      }}
    >
      {/* Header with summary */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 14, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <Text style={{ fontSize: 12 }}>{summary}</Text>
        </div>
        <Space size={4}>
          <Tooltip title={copied ? 'Copied!' : 'Copy SQL'}>
            <Button
              size="small"
              type="text"
              icon={copied ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
              onClick={handleCopy}
              style={{ padding: '0 4px', height: 20 }}
            />
          </Tooltip>
          {onLoadQuery && (
            <Tooltip title="Load in editor">
              <Button
                size="small"
                type="text"
                icon={<PlayCircleOutlined />}
                onClick={() => onLoadQuery(sql)}
                style={{ padding: '0 4px', height: 20 }}
              />
            </Tooltip>
          )}
        </Space>
      </div>

      {/* Expandable SQL section */}
      <div
        onClick={() => setShowDetails(!showDetails)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 8,
          cursor: 'pointer',
        }}
      >
        {showDetails ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
        <CodeOutlined style={{ fontSize: 11, color: '#888' }} />
        <Text type="secondary" style={{ fontSize: 11 }}>
          {showDetails ? 'Hide query' : 'Show query'}
        </Text>
      </div>

      <Collapse
        ghost
        activeKey={showDetails ? ['sql'] : []}
        items={[
          {
            key: 'sql',
            showArrow: false,
            label: null,
            children: (
              <pre
                style={{
                  background: '#1a1a1a',
                  padding: '8px 10px',
                  borderRadius: 4,
                  fontSize: 10,
                  margin: '8px 0 0 0',
                  overflow: 'auto',
                  maxHeight: 150,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {sql}
              </pre>
            ),
          },
        ]}
      />

      {/* Show diff toggle when there are changes */}
      {hasDiff && diff && diff.hasChanges && (
        <>
          <div
            onClick={() => setShowDiff(!showDiff)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 8,
              cursor: 'pointer',
            }}
          >
            {showDiff ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
            <DiffOutlined style={{ fontSize: 11, color: '#888' }} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {showDiff ? 'Hide changes' : 'Show changes from previous query'}
            </Text>
          </div>

          <Collapse
            ghost
            activeKey={showDiff ? ['diff'] : []}
            items={[
              {
                key: 'diff',
                showArrow: false,
                label: null,
                children: (
                  <div
                    className="chat-diff-view"
                    style={{
                      background: '#1a1a1a',
                      borderRadius: 4,
                      padding: '8px 10px',
                      margin: '8px 0 0 0',
                      fontSize: 10,
                      fontFamily: 'JetBrains Mono, monospace',
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    {diff.lines.map((line, index) => (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          background: line.type === 'added'
                            ? 'rgba(82, 196, 26, 0.15)'
                            : line.type === 'removed'
                            ? 'rgba(255, 77, 79, 0.15)'
                            : 'transparent',
                          padding: '1px 4px',
                          borderRadius: 2,
                          marginBottom: 1,
                        }}
                      >
                        <span style={{
                          width: 16,
                          color: line.type === 'added' ? '#52c41a' : line.type === 'removed' ? '#ff4d4f' : '#666',
                          flexShrink: 0,
                        }}>
                          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                        </span>
                        <span style={{
                          color: line.type === 'added' ? '#52c41a' : line.type === 'removed' ? '#ff4d4f' : '#aaa',
                        }}>
                          {line.content || ' '}
                        </span>
                      </div>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
