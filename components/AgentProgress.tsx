'use client';

import React from 'react';
import { Progress, Button, Typography, Space, Tag, Collapse } from 'antd';
import {
  StopOutlined,
  TableOutlined,
  CodeOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { ToolCallInfo } from '@/stores/aiChatStore';

const { Text } = Typography;

interface AgentProgressProps {
  currentStep: number;
  maxSteps: number;
  toolCalls: ToolCallInfo[];
  onStop: () => void;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  get_table_schema: <TableOutlined />,
  get_json_keys: <SearchOutlined />,
  execute_query: <CodeOutlined />,
  validate_query: <CheckCircleOutlined />,
  update_query_ui: <EditOutlined />,
};

const TOOL_LABELS: Record<string, string> = {
  get_table_schema: 'Getting schema',
  get_json_keys: 'Exploring JSON fields',
  execute_query: 'Running query',
  validate_query: 'Validating query',
  update_query_ui: 'Updating query',
};

function getToolIcon(toolName: string): React.ReactNode {
  return TOOL_ICONS[toolName] || <CodeOutlined />;
}

function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] || toolName;
}

function getStatusIcon(status: ToolCallInfo['status']): React.ReactNode {
  switch (status) {
    case 'running':
      return <LoadingOutlined spin style={{ color: '#1890ff' }} />;
    case 'success':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    case 'error':
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    default:
      return null;
  }
}

export function AgentProgress({ currentStep, maxSteps, toolCalls, onStop }: AgentProgressProps) {
  const percent = Math.round((currentStep / maxSteps) * 100);
  const recentCalls = toolCalls.slice(-5); // Show last 5 tool calls

  return (
    <div className="agent-progress">
      <div className="agent-progress-header">
        <Space>
          <Text strong style={{ fontSize: 12 }}>
            Agent working
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Step {currentStep}/{maxSteps}
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

      <Progress
        percent={percent}
        size="small"
        showInfo={false}
        strokeColor="#1890ff"
        style={{ marginBottom: 12 }}
      />

      {recentCalls.length > 0 && (
        <Collapse
          size="small"
          ghost
          defaultActiveKey={['tools']}
          items={[
            {
              key: 'tools',
              label: (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Tool calls ({toolCalls.length})
                </Text>
              ),
              children: (
                <div className="agent-tool-calls">
                  {recentCalls.map((call) => (
                    <div key={call.id} className="agent-tool-call">
                      <Space size={4}>
                        {getStatusIcon(call.status)}
                        <Tag
                          icon={getToolIcon(call.toolName)}
                          color={call.status === 'error' ? 'error' : call.status === 'success' ? 'success' : 'processing'}
                          style={{ fontSize: 10, margin: 0 }}
                        >
                          {getToolLabel(call.toolName)}
                        </Tag>
                      </Space>
                      {call.status === 'success' && call.result != null ? (
                        <ToolResult result={call.result} toolName={call.toolName} />
                      ) : null}
                      {call.status === 'error' && call.result != null ? (
                        <Text type="danger" style={{ fontSize: 10, display: 'block', marginTop: 2 }}>
                          {String((call.result as { error?: string }).error || 'Error')}
                        </Text>
                      ) : null}
                    </div>
                  ))}
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

interface ToolResultProps {
  result: unknown;
  toolName: string;
}

function ToolResult({ result, toolName }: ToolResultProps) {
  if (!result || typeof result !== 'object') return null;

  const r = result as Record<string, unknown>;

  // Execute query results
  if (toolName === 'execute_query') {
    if (r.success) {
      const warningText = r.warning ? ` - ${String(r.warning)}` : '';
      return (
        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2 }}>
          {String(r.rowCount)} rows in {String(r.executionTime)}ms
          {warningText && <span style={{ color: '#faad14' }}>{warningText}</span>}
        </Text>
      );
    }
  }

  // Schema results
  if (toolName === 'get_table_schema') {
    return (
      <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2 }}>
        {String(r.tableCount)} tables found
      </Text>
    );
  }

  // JSON keys results
  if (toolName === 'get_json_keys') {
    const keys = r.keys as string[];
    if (keys && keys.length > 0) {
      const keyText = keys.slice(0, 5).join(', ') + (keys.length > 5 ? '...' : '');
      return (
        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2 }}>
          Keys: {keyText}
        </Text>
      );
    }
  }

  // Validate query results
  if (toolName === 'validate_query') {
    const statusText = r.isValid ? 'Valid' : String(r.error || 'Invalid');
    return (
      <Text
        type={r.isValid ? 'success' : 'danger'}
        style={{ fontSize: 10, display: 'block', marginTop: 2 }}
      >
        {statusText}
      </Text>
    );
  }

  return null;
}
