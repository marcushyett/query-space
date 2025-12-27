'use client';

import React from 'react';
import { Typography, Space, Tag } from 'antd';
import {
  CheckCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';
import type { AgentTodoItem } from '@/stores/aiChatStore';

const { Text } = Typography;

interface AgentTodoListProps {
  todos: AgentTodoItem[];
  compact?: boolean;
}

function getStatusIcon(status: AgentTodoItem['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircleOutlined className="todo-icon todo-icon-completed" />;
    case 'in_progress':
      return <LoadingOutlined className="todo-icon todo-icon-in-progress" spin />;
    case 'skipped':
      return <MinusCircleOutlined className="todo-icon todo-icon-skipped" />;
    default:
      return <ClockCircleOutlined className="todo-icon todo-icon-pending" />;
  }
}

export function AgentTodoList({ todos, compact = false }: AgentTodoListProps) {
  if (todos.length === 0) return null;

  const completedCount = todos.filter((t) => t.status === 'completed').length;
  const totalCount = todos.length;
  const progress = Math.round((completedCount / totalCount) * 100);

  return (
    <div className={`agent-todo-list ${compact ? 'agent-todo-list-compact' : ''}`}>
      {/* Header with progress */}
      <div className="agent-todo-header">
        <Space size={8}>
          <Text strong style={{ fontSize: 12 }}>Plan</Text>
          <Tag color={progress === 100 ? 'success' : 'processing'} style={{ fontSize: 10, margin: 0 }}>
            {completedCount}/{totalCount}
          </Tag>
        </Space>
        <div className="agent-todo-progress-bar">
          <div
            className="agent-todo-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Todo items */}
      <div className="agent-todo-items">
        {todos.map((todo, index) => (
          <div
            key={todo.id}
            className={`agent-todo-item agent-todo-item-${todo.status} ${
              todo.addedDuringExecution ? 'agent-todo-item-added' : ''
            }`}
          >
            <div className="agent-todo-item-icon">
              {getStatusIcon(todo.status)}
            </div>
            <div className="agent-todo-item-content">
              <Text
                className={`agent-todo-item-text ${
                  todo.status === 'completed' ? 'agent-todo-item-text-completed' : ''
                } ${todo.status === 'skipped' ? 'agent-todo-item-text-skipped' : ''}`}
                style={{ fontSize: compact ? 11 : 12 }}
              >
                {todo.text}
              </Text>
              {todo.addedDuringExecution && (
                <Tag
                  icon={<PlusCircleOutlined />}
                  color="blue"
                  style={{ fontSize: 9, marginLeft: 6, padding: '0 4px' }}
                >
                  new
                </Tag>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
