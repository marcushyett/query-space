'use client';

import React, { useState } from 'react';
import { Typography, Space, Button, Tooltip, Card, Collapse, Tag } from 'antd';
import {
  TrophyOutlined,
  CodeOutlined,
  CopyOutlined,
  CheckOutlined,
  PlayCircleOutlined,
  DownOutlined,
  RightOutlined,
  BulbOutlined,
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface AgentSummaryProps {
  summary: string;
  sql: string;
  explanation?: string;
  confidence?: 'high' | 'medium' | 'low';
  suggestions?: string[];
  onLoadQuery?: (sql: string) => void;
}

const confidenceColors: Record<string, string> = {
  high: 'success',
  medium: 'warning',
  low: 'error',
};

export function AgentSummary({
  summary,
  sql,
  explanation,
  confidence = 'high',
  suggestions,
  onLoadQuery,
}: AgentSummaryProps) {
  const [showSql, setShowSql] = useState(false);
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
    <Card
      className="agent-summary"
      size="small"
      style={{
        background: 'linear-gradient(135deg, rgba(250, 173, 20, 0.1) 0%, rgba(24, 144, 255, 0.1) 100%)',
        border: '1px solid rgba(250, 173, 20, 0.3)',
        borderRadius: 8,
      }}
    >
      {/* Header */}
      <div className="agent-summary-header">
        <Space size={8}>
          <TrophyOutlined style={{ color: '#faad14', fontSize: 16 }} />
          <Text strong style={{ fontSize: 13 }}>Analysis Complete</Text>
          <Tag color={confidenceColors[confidence]} style={{ fontSize: 10, margin: 0 }}>
            {confidence} confidence
          </Tag>
        </Space>
      </div>

      {/* Summary */}
      <div className="agent-summary-content" style={{ marginTop: 12 }}>
        <Space size={4} align="start">
          <BulbOutlined style={{ color: '#1890ff', marginTop: 2 }} />
          <Paragraph style={{ margin: 0, fontSize: 12 }}>
            {summary}
          </Paragraph>
        </Space>
      </div>

      {/* Explanation (if different from summary) */}
      {explanation && explanation !== summary && (
        <Paragraph
          type="secondary"
          style={{ fontSize: 11, marginTop: 8, marginBottom: 0 }}
        >
          {explanation}
        </Paragraph>
      )}

      {/* Final Query Section */}
      <div className="agent-summary-query" style={{ marginTop: 12 }}>
        <div
          className="agent-summary-query-header"
          onClick={() => setShowSql(!showSql)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            padding: '8px 0',
          }}
        >
          <Space size={8}>
            <CodeOutlined />
            <Text strong style={{ fontSize: 12 }}>Final Query</Text>
          </Space>
          <Space size={4}>
            <Tooltip title={copied ? 'Copied!' : 'Copy SQL'}>
              <Button
                size="small"
                type="text"
                icon={copied ? <CheckOutlined style={{ color: '#52c41a' }} /> : <CopyOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
              />
            </Tooltip>
            {onLoadQuery && (
              <Tooltip title="Load in editor">
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
              icon={showSql ? <DownOutlined /> : <RightOutlined />}
            />
          </Space>
        </div>

        <Collapse
          ghost
          activeKey={showSql ? ['sql'] : []}
          items={[
            {
              key: 'sql',
              showArrow: false,
              label: null,
              children: (
                <pre
                  style={{
                    background: '#1a1a1a',
                    padding: '8px 12px',
                    borderRadius: 4,
                    fontSize: 11,
                    margin: 0,
                    overflow: 'auto',
                    maxHeight: 200,
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

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className="agent-summary-suggestions" style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>
            Suggestions for refinement:
          </Text>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11 }}>
            {suggestions.map((suggestion, idx) => (
              <li key={idx} style={{ marginBottom: 2 }}>
                <Text type="secondary">{suggestion}</Text>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
