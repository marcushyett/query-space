'use client';

import React from 'react';
import { Typography, Tag, Alert, Space, Table } from 'antd';
import {
  UserOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import type { ChatMessage as ChatMessageType } from '@/stores/aiChatStore';
import { computeSqlDiff } from '@/lib/sqlDiff';

const { Text } = Typography;

interface ChatMessageProps {
  message: ChatMessageType;
  isLatest?: boolean;
}

export function ChatMessage({ message, isLatest }: ChatMessageProps) {
  // System message (query results, errors)
  if (message.role === 'system') {
    const isError = message.content.toLowerCase().includes('error');
    const hasResult = message.queryResult;
    const sampleResults = message.queryResult?.sampleResults;

    // Generate columns and data for sample results table
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
      <Alert
        type={isError ? 'warning' : 'success'}
        message={
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Text>{message.content}</Text>
            {hasResult && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {message.queryResult!.rowCount} rows in {message.queryResult!.executionTime}ms
              </Text>
            )}
            {sampleResults && sampleResults.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                  Sample results:
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
          </Space>
        }
        showIcon
        style={{ marginBottom: 8 }}
      />
    );
  }

  // User message
  if (message.role === 'user') {
    return (
      <div className="chat-message chat-message-user">
        <div className="chat-message-icon">
          <UserOutlined />
        </div>
        <div className="chat-message-content">
          <Text type="secondary">{message.content}</Text>
        </div>
      </div>
    );
  }

  // Assistant message
  const hasDiff = message.previousSql && message.sql && message.previousSql !== message.sql;
  const diff = hasDiff ? computeSqlDiff(message.previousSql!, message.sql!) : null;

  return (
    <div className="chat-message chat-message-assistant">
      <div className="chat-message-icon chat-message-icon-assistant">
        {message.isAutoFix ? <ThunderboltOutlined /> : <RobotOutlined />}
      </div>
      <div className="chat-message-content">
        {message.error ? (
          <Alert type="error" message={message.error} showIcon />
        ) : (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {message.isAutoFix && (
              <Tag icon={<ThunderboltOutlined />} color="warning">
                Auto-fix applied
              </Tag>
            )}

            {/* Clarifying questions */}
            {message.clarifyingQuestions && message.clarifyingQuestions.length > 0 && (
              <Alert
                type="info"
                icon={<QuestionCircleOutlined />}
                message={
                  <Space direction="vertical" size={4}>
                    <Text strong style={{ fontSize: 12 }}>I need some clarification:</Text>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {message.clarifyingQuestions.map((q, idx) => (
                        <li key={idx}><Text>{q}</Text></li>
                      ))}
                    </ul>
                  </Space>
                }
              />
            )}

            {message.explanation && !message.needsClarification && (
              <Text>{message.explanation}</Text>
            )}

            {/* Show diff for modified queries */}
            {message.sql && hasDiff && diff && diff.hasChanges && (
              <div className="chat-changes-summary">
                <div className="chat-changes-header">
                  <CheckCircleOutlined className="chat-changes-icon" />
                  <Text strong style={{ fontSize: 12 }}>Changes made:</Text>
                </div>
                <div className="chat-diff-view">
                  {diff.lines.map((line, index) => (
                    <div
                      key={index}
                      className={`chat-diff-line chat-diff-line-${line.type}`}
                    >
                      <span className="chat-diff-prefix">
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                      </span>
                      <span className="chat-diff-content">{line.content || ' '}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Show SQL for new queries (no diff) */}
            {message.sql && !hasDiff && (
              <div className="chat-sql-preview">
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                  Generated SQL:
                </Text>
                <pre className="chat-sql-code">{message.sql}</pre>
              </div>
            )}

            {isLatest && message.sql && (
              <Space size={4}>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                <Text type="secondary" style={{ fontSize: 11 }}>Query ready</Text>
              </Space>
            )}
          </Space>
        )}
      </div>
    </div>
  );
}
