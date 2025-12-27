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
} from '@ant-design/icons';

const { Text } = Typography;

interface AgentSummaryProps {
  summary: string;
  sql: string;
  explanation?: string;
  confidence?: 'high' | 'medium' | 'low';
  suggestions?: string[];
  onLoadQuery?: (sql: string) => void;
}

export function AgentSummary({
  summary,
  sql,
  onLoadQuery,
}: AgentSummaryProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

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
    </div>
  );
}
