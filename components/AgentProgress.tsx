'use client';

import React from 'react';
import { Button, Typography, Space } from 'antd';
import { StopOutlined } from '@ant-design/icons';
import type { ToolCallInfo, AgentTodoItem } from '@/stores/aiChatStore';
import { TechSpinner } from './TechSpinner';

const { Text } = Typography;

interface AgentProgressProps {
  currentStep: number;
  maxSteps: number;
  toolCalls: ToolCallInfo[];
  streamingText?: string;
  todos?: AgentTodoItem[];
  onStop: () => void;
  onLoadQuery?: (sql: string) => void;
}

const TOOL_LABELS: Record<string, string> = {
  get_table_schema: 'Getting schema',
  get_json_keys: 'Exploring JSON fields',
  execute_query: 'Running query',
  validate_query: 'Validating query',
  update_query_ui: 'Updating query',
  generate_chart: 'Generating chart',
  manage_todo: 'Planning',
};

export function AgentProgress({ currentStep, maxSteps, toolCalls, streamingText: _streamingText, todos = [], onStop }: AgentProgressProps) {
  void _streamingText; // Reserved for future streaming indicator
  // Check if there's a final query (update_query_ui was called)
  const finalQueryCall = toolCalls.find(tc => tc.toolName === 'update_query_ui' && tc.status === 'success');

  // Check if all todos are complete but agent is still working
  const allTodosComplete = todos.length > 0 && todos.every(t => t.status === 'completed' || t.status === 'skipped');
  const hasActiveTool = toolCalls.some(tc => tc.status === 'running');
  const isFinalizingWithoutTodos = todos.length === 0 && toolCalls.length > 0 && !finalQueryCall;

  // Determine working status text
  const getWorkingStatus = () => {
    if (hasActiveTool) {
      const activeTool = toolCalls.find(tc => tc.status === 'running');
      if (activeTool) {
        return TOOL_LABELS[activeTool.toolName] || 'Processing';
      }
    }
    if (allTodosComplete && !finalQueryCall) {
      return 'Finalizing query';
    }
    if (isFinalizingWithoutTodos) {
      return 'Building query';
    }
    return 'Thinking';
  };

  // Simple status bar at the bottom - all details are in the chat stream
  return (
    <div className="agent-progress agent-progress-minimal">
      <div className="agent-progress-status">
        <Space size={8}>
          <TechSpinner size="small" />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {getWorkingStatus()}... (Step {currentStep}/{maxSteps})
          </Text>
        </Space>
        <Button
          size="small"
          type="text"
          danger
          icon={<StopOutlined />}
          onClick={onStop}
        >
          Stop
        </Button>
      </div>
    </div>
  );
}
