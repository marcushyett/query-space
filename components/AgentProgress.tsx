'use client';

import React from 'react';
import { Progress, Button, Typography, Space, Tag, Collapse, Tooltip } from 'antd';
import {
  StopOutlined,
  TableOutlined,
  CodeOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
  EditOutlined,
  PlayCircleOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import type { ToolCallInfo } from '@/stores/aiChatStore';

const { Text } = Typography;

interface AgentProgressProps {
  currentStep: number;
  maxSteps: number;
  toolCalls: ToolCallInfo[];
  streamingText?: string;
  onStop: () => void;
  onLoadQuery?: (sql: string) => void;
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

export function AgentProgress({ currentStep, maxSteps, toolCalls, streamingText, onStop, onLoadQuery }: AgentProgressProps) {
  const percent = Math.round((currentStep / maxSteps) * 100);
  const recentCalls = toolCalls.slice(-8); // Show last 8 tool calls

  // Check if there's a final query (update_query_ui was called)
  const finalQueryCall = toolCalls.find(tc => tc.toolName === 'update_query_ui' && tc.status === 'success');

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

      {streamingText && (
        <div className="agent-streaming-text">
          <Text style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{streamingText}</Text>
        </div>
      )}

      {recentCalls.length > 0 && (
        <Collapse
          size="small"
          ghost
          defaultActiveKey={[]}
          items={[
            {
              key: 'tools',
              label: (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {toolCalls.length} tool call{toolCalls.length !== 1 ? 's' : ''}
                  {finalQueryCall && <TrophyOutlined style={{ marginLeft: 6, color: '#faad14' }} />}
                </Text>
              ),
              children: (
                <div className="agent-tool-calls">
                  {recentCalls.map((call) => {
                    const isFinalQuery = call.toolName === 'update_query_ui' && call.status === 'success';
                    return (
                      <div key={call.id} className={`agent-tool-call ${isFinalQuery ? 'final-query' : ''}`}>
                        <Space size={4} style={{ flexWrap: 'wrap' }}>
                          {isFinalQuery ? (
                            <Tooltip title="Goal completed">
                              <TrophyOutlined style={{ color: '#faad14' }} />
                            </Tooltip>
                          ) : (
                            getStatusIcon(call.status)
                          )}
                          <Tag
                            icon={getToolIcon(call.toolName)}
                            color={isFinalQuery ? 'gold' : call.status === 'error' ? 'error' : call.status === 'success' ? 'success' : 'processing'}
                            style={{ fontSize: 10, margin: 0 }}
                          >
                            {isFinalQuery ? 'Final Query' : getToolLabel(call.toolName)}
                          </Tag>
                        </Space>
                        {call.status === 'success' && call.result != null ? (
                          <ToolResult
                            result={call.result}
                            toolName={call.toolName}
                            args={call.args}
                            onLoadQuery={onLoadQuery}
                            isFinalQuery={isFinalQuery}
                          />
                        ) : null}
                        {call.status === 'error' && call.result != null ? (
                          <Text type="danger" style={{ fontSize: 10, display: 'block', marginTop: 2 }}>
                            {String((call.result as { error?: string }).error || 'Error')}
                          </Text>
                        ) : null}
                      </div>
                    );
                  })}
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
  args?: Record<string, unknown>;
  onLoadQuery?: (sql: string) => void;
  isFinalQuery?: boolean;
}

function ToolResult({ result, toolName, args, onLoadQuery, isFinalQuery }: ToolResultProps) {
  if (!result || typeof result !== 'object') return null;

  const r = result as Record<string, unknown>;

  // Execute query results - show SQL with load button
  if (toolName === 'execute_query') {
    const sql = args?.sql as string | undefined;
    if (r.success) {
      const warningText = r.warning ? ` - ${String(r.warning)}` : '';
      return (
        <div style={{ marginTop: 4 }}>
          <Space size={4}>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {String(r.rowCount)} rows in {String(r.executionTime)}ms
              {warningText && <span style={{ color: '#faad14' }}>{warningText}</span>}
            </Text>
            {sql && onLoadQuery && (
              <Tooltip title="Load this query">
                <Button
                  size="small"
                  type="link"
                  icon={<PlayCircleOutlined />}
                  onClick={() => onLoadQuery(sql)}
                  style={{ fontSize: 10, padding: '0 4px', height: 16 }}
                />
              </Tooltip>
            )}
          </Space>
          {sql && (
            <Text
              code
              style={{ fontSize: 9, display: 'block', marginTop: 2, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {sql.slice(0, 80)}{sql.length > 80 ? '...' : ''}
            </Text>
          )}
        </div>
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

  // Validate query results - show SQL with load button
  if (toolName === 'validate_query') {
    const sql = args?.sql as string | undefined;
    const isValid = Boolean(r.isValid);
    const statusText = isValid ? 'Valid' : String(r.error || 'Invalid');
    return (
      <div style={{ marginTop: 4 }}>
        <Space size={4}>
          <Text
            type={isValid ? 'success' : 'danger'}
            style={{ fontSize: 10 }}
          >
            {statusText}
          </Text>
          {sql && isValid && onLoadQuery && (
            <Tooltip title="Load this query">
              <Button
                size="small"
                type="link"
                icon={<PlayCircleOutlined />}
                onClick={() => onLoadQuery(sql)}
                style={{ fontSize: 10, padding: '0 4px', height: 16 }}
              />
            </Tooltip>
          )}
        </Space>
        {sql && (
          <Text
            code
            style={{ fontSize: 9, display: 'block', marginTop: 2, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {sql.slice(0, 80)}{sql.length > 80 ? '...' : ''}
          </Text>
        )}
      </div>
    );
  }

  // Update query UI - the final query
  if (toolName === 'update_query_ui') {
    const sql = args?.sql as string | undefined;
    const explanation = args?.explanation as string | undefined;
    return (
      <div style={{ marginTop: 4, padding: isFinalQuery ? '4px 8px' : 0, background: isFinalQuery ? 'rgba(250, 173, 20, 0.1)' : 'transparent', borderRadius: 4 }}>
        {explanation && (
          <Text style={{ fontSize: 10, display: 'block' }}>
            {explanation.slice(0, 100)}{explanation.length > 100 ? '...' : ''}
          </Text>
        )}
        {sql && (
          <Space size={4} style={{ marginTop: 2 }}>
            <Text
              code
              style={{ fontSize: 9, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {sql.slice(0, 60)}{sql.length > 60 ? '...' : ''}
            </Text>
            {onLoadQuery && (
              <Tooltip title="Load this query">
                <Button
                  size="small"
                  type="link"
                  icon={<PlayCircleOutlined />}
                  onClick={() => onLoadQuery(sql)}
                  style={{ fontSize: 10, padding: '0 4px', height: 16 }}
                />
              </Tooltip>
            )}
          </Space>
        )}
      </div>
    );
  }

  return null;
}
