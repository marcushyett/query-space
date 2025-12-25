'use client';

import React from 'react';
import { Typography } from 'antd';
import {
  UserOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  WarningOutlined,
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

    return (
      <div className={`chat-system-message ${isError ? 'chat-system-error' : 'chat-system-success'}`}>
        {isError ? (
          <WarningOutlined className="chat-system-icon chat-system-icon-error" />
        ) : (
          <CheckCircleOutlined className="chat-system-icon chat-system-icon-success" />
        )}
        <div className="chat-system-content">
          <Text className={isError ? 'chat-system-text-error' : 'chat-system-text-success'}>
            {message.content}
          </Text>
          {hasResult && (
            <Text type="secondary" className="chat-system-stats">
              {message.queryResult!.rowCount} rows in {message.queryResult!.executionTime}ms
            </Text>
          )}
        </div>
      </div>
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
          <Text className="chat-message-text">{message.content}</Text>
        </div>
      </div>
    );
  }

  // Assistant message
  const hasDiff = message.previousSql && message.sql && message.previousSql !== message.sql;
  const diff = hasDiff ? computeSqlDiff(message.previousSql!, message.sql!) : null;

  return (
    <div className="chat-message chat-message-assistant">
      <div className={`chat-message-icon chat-message-icon-assistant ${message.isAutoFix ? 'chat-message-icon-autofix' : ''}`}>
        {message.isAutoFix ? <ThunderboltOutlined /> : <RobotOutlined />}
      </div>
      <div className="chat-message-content">
        {message.error ? (
          <div className="chat-message-error">
            <CloseCircleOutlined className="chat-error-icon" />
            <Text type="danger">{message.error}</Text>
          </div>
        ) : (
          <>
            {message.isAutoFix && (
              <div className="chat-autofix-badge">
                <ThunderboltOutlined />
                <Text className="chat-autofix-text">Auto-fix applied</Text>
              </div>
            )}

            {message.explanation && (
              <div className="chat-message-explanation">
                <Text className="chat-message-text">{message.explanation}</Text>
              </div>
            )}

            {/* Show changes list if available */}
            {message.sql && hasDiff && diff && diff.hasChanges && (
              <div className="chat-changes-summary">
                <div className="chat-changes-header">
                  <CheckCircleOutlined className="chat-changes-icon" />
                  <Text strong className="chat-changes-title">Changes made:</Text>
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
                <div className="chat-sql-header">
                  <Text type="secondary" className="text-xs">Generated SQL:</Text>
                </div>
                <pre className="chat-sql-code">{message.sql}</pre>
              </div>
            )}

            {isLatest && message.sql && (
              <div className="chat-message-status">
                <CheckCircleOutlined className="chat-success-icon" />
                <Text type="secondary" className="text-xs">Query ready</Text>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
