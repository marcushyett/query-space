'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Typography, Grid, Space, Empty, Select } from 'antd';
import {
  SendOutlined,
  CloseOutlined,
  PlusOutlined,
  RobotOutlined,
  ExpandOutlined,
  CompressOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  WifiOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import { useAiChatStore, CLAUDE_MODELS, ClaudeModelId } from '@/stores/aiChatStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore } from '@/stores/queryStore';
import { usePersistentAgent } from '@/hooks/usePersistentAgent';
import { ChatMessage } from './ChatMessage';
import { AgentProgress } from './AgentProgress';
import { TechSpinner } from './TechSpinner';

const { Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

// Helper to format time ago
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function AiChatPanel() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { isOpen, setOpen, messages, isGenerating, agentProgress, selectedModel, setSelectedModel } = useAiChatStore();
  const { organizationId } = useConnectionStore();
  const { isExecuting, setCurrentQuery } = useQueryStore();
  const {
    sendMessage,
    continueAgent,
    stopAgent,
    startNewConversation,
    setCurrentSql,
    setIsAiGenerated,
    resumeSession,
    resumableSessions,
    isConnected: isAgentConnected,
    activeSessionId,
  } = usePersistentAgent();

  // Handler to load a query from agent tool calls into the main query UI
  const handleLoadQuery = (sql: string) => {
    setCurrentQuery(sql);
    setCurrentSql(sql);
    setIsAiGenerated(true);
  };

  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() || isGenerating || isExecuting) return;
    const prompt = inputValue;
    setInputValue('');
    await sendMessage(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isConnected = !!organizationId;
  const isWorking = isGenerating || isExecuting;

  if (!isOpen) return null;

  return (
    <div className={`ai-chat-panel ${isMobile ? 'ai-chat-panel-mobile' : ''} ${isExpanded ? 'ai-chat-panel-expanded' : ''}`}>
      {/* Header */}
      <div className="panel-header">
        <Space>
          <RobotOutlined />
          <Text strong>AI Assistant</Text>
          <Select
            value={selectedModel}
            onChange={(value: ClaudeModelId) => setSelectedModel(value)}
            size="small"
            style={{ width: 130 }}
            disabled={isWorking || messages.length > 0}
            options={Object.entries(CLAUDE_MODELS).map(([id, name]) => ({
              value: id,
              label: name,
            }))}
          />
          {/* Connection status indicator for active sessions */}
          {activeSessionId && agentProgress?.isRunning && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {isAgentConnected ? (
                <WifiOutlined style={{ color: '#52c41a', fontSize: 12 }} />
              ) : (
                <DisconnectOutlined style={{ color: '#faad14', fontSize: 12 }} />
              )}
              <Text style={{ fontSize: 11, color: isAgentConnected ? '#52c41a' : '#faad14' }}>
                {isAgentConnected ? 'Connected' : 'Reconnecting...'}
              </Text>
            </span>
          )}
          {/* Show resumable indicator when there are paused sessions */}
          {resumableSessions.length > 0 && messages.length > 0 && !isWorking && (
            <Button
              type="text"
              size="small"
              icon={<PlayCircleOutlined style={{ color: '#faad14' }} />}
              onClick={() => resumeSession(resumableSessions[0])}
              style={{
                padding: '0 8px',
                background: 'rgba(250, 173, 20, 0.1)',
                borderRadius: 4,
              }}
            >
              <Text style={{ fontSize: 11, color: '#faad14' }}>Resume</Text>
            </Button>
          )}
        </Space>
        <Space size={4}>
          {messages.length > 0 && (
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => { startNewConversation(); setInputValue(''); }}
            />
          )}
          {!isMobile && (
            <Button
              type="text"
              size="small"
              icon={isExpanded ? <CompressOutlined /> : <ExpandOutlined />}
              onClick={() => setIsExpanded(!isExpanded)}
            />
          )}
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => setOpen(false)}
          />
        </Space>
      </div>

      {/* Content */}
      <div className="ai-chat-content">
        {/* Not connected */}
        {!isConnected && (
          <div className="p-4 text-center">
            <Text type="secondary">Connect to a database first</Text>
          </div>
        )}

        {/* Resumable sessions banner */}
        {resumableSessions.length > 0 && messages.length === 0 && isConnected && !isWorking && (
          <div className="resumable-sessions-banner">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space>
                <HistoryOutlined />
                <Text strong style={{ fontSize: 13 }}>Resume Previous Session</Text>
              </Space>
              {resumableSessions.slice(0, 3).map((session) => {
                const completedTodos = session.todos.filter(t => t.status === 'completed').length;
                const totalTodos = session.todos.length;
                const timeAgo = formatTimeAgo(session.updatedAt);

                // Build progress indicator based on available data
                let progressText = '';
                if (totalTodos > 0) {
                  progressText = `${completedTodos}/${totalTodos} tasks`;
                } else if (session.toolCalls.length > 0) {
                  progressText = `${session.toolCalls.length} steps`;
                } else {
                  progressText = 'Just started';
                }

                return (
                  <div
                    key={session.id}
                    className="resumable-session-item"
                    onClick={() => resumeSession(session)}
                  >
                    <div className="session-content">
                      <Text ellipsis style={{ maxWidth: '100%', fontSize: 12 }}>
                        {session.goal}
                      </Text>
                      <Space size={8}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {progressText}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {timeAgo}
                        </Text>
                      </Space>
                    </div>
                    <Button
                      type="text"
                      size="small"
                      icon={<PlayCircleOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        resumeSession(session);
                      }}
                    />
                  </div>
                );
              })}
            </Space>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && isConnected && resumableSessions.length === 0 && (
          <Empty
            image={<RobotOutlined style={{ fontSize: 48, color: '#333' }} />}
            description={
              <Space direction="vertical" size={4}>
                <Text type="secondary">Ask me to create a query</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  I&apos;ll run it automatically and fix errors
                </Text>
              </Space>
            }
            style={{ padding: '40px 20px' }}
          >
            {isMobile && (
              <Space wrap>
                <Button size="small" onClick={() => setInputValue('Show me all tables')}>
                  Show all tables
                </Button>
                <Button size="small" onClick={() => setInputValue('Count rows in each table')}>
                  Count rows
                </Button>
              </Space>
            )}
          </Empty>
        )}

        {/* Messages */}
        <div className="ai-chat-messages">
          {messages.map((msg, index) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isLatest={index === messages.length - 1 && msg.role === 'assistant'}
              onLoadQuery={handleLoadQuery}
              onResume={resumableSessions.length > 0 ? () => resumeSession(resumableSessions[0]) : undefined}
            />
          ))}

          {/* Agent Progress - hide when final query has been shown */}
          {agentProgress && agentProgress.isRunning && !agentProgress.hasShownFinalQuery && (
            <AgentProgress
              currentStep={agentProgress.currentStep}
              maxSteps={agentProgress.maxSteps}
              toolCalls={agentProgress.toolCalls}
              streamingText={agentProgress.streamingText}
              todos={agentProgress.todos}
              onStop={stopAgent}
              onLoadQuery={handleLoadQuery}
            />
          )}

          {/* Continue Button when step limit reached or has incomplete todos */}
          {agentProgress && agentProgress.canContinue && !agentProgress.isRunning && (
            <div className="agent-resume-section" style={{
              background: '#1a1a1a',
              border: `1px solid ${agentProgress.hasIncompleteTodos ? '#faad14' : '#333'}`,
              borderRadius: 8,
              padding: 16,
              margin: '8px 0'
            }}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space>
                  <HistoryOutlined style={{ color: agentProgress.hasIncompleteTodos ? '#faad14' : '#888' }} />
                  <Text strong style={{ fontSize: 13 }}>
                    {agentProgress.stopReason === 'step_limit'
                      ? 'Agent paused at step limit'
                      : agentProgress.stopReason === 'incomplete_todos'
                      ? 'Agent stopped with incomplete tasks'
                      : 'Agent paused'}
                  </Text>
                </Space>

                {/* Progress summary */}
                <div style={{ fontSize: 12 }}>
                  {agentProgress.todos.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary">Progress: </Text>
                      <Text style={{ color: agentProgress.hasIncompleteTodos ? '#faad14' : undefined }}>
                        {agentProgress.todos.filter(t => t.status === 'completed').length}/
                        {agentProgress.todos.length} tasks completed
                      </Text>
                    </div>
                  )}
                  {agentProgress.todos.length > 0 && agentProgress.hasIncompleteTodos && (
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary">Remaining: </Text>
                      <Text>
                        {agentProgress.todos
                          .filter(t => t.status === 'pending' || t.status === 'in_progress')
                          .map(t => t.text)
                          .slice(0, 2)
                          .join(', ')}
                        {agentProgress.todos.filter(t => t.status === 'pending' || t.status === 'in_progress').length > 2 && '...'}
                      </Text>
                    </div>
                  )}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {agentProgress.stopReason === 'step_limit'
                      ? `The agent used ${agentProgress.currentStep} steps and needs more to complete the task.`
                      : agentProgress.stopReason === 'incomplete_todos'
                      ? 'The agent needs to complete remaining tasks before finalizing.'
                      : `The agent used ${agentProgress.currentStep} steps.`}
                    {' '}Click Continue to resume from where it left off.
                  </Text>
                </div>

                <Button
                  type="primary"
                  onClick={continueAgent}
                  icon={<PlayCircleOutlined />}
                  block
                  style={agentProgress.hasIncompleteTodos ? { background: '#faad14', borderColor: '#faad14' } : undefined}
                >
                  Continue ({agentProgress.todos.filter(t => t.status === 'pending' || t.status === 'in_progress').length || 'remaining'} tasks)
                </Button>
              </Space>
            </div>
          )}

          {isWorking && !agentProgress?.isRunning && (
            <div className="p-4 text-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <TechSpinner size="small" />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {isExecuting ? 'Running...' : 'Generating...'}
              </Text>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Footer */}
      <div className="ai-chat-footer">
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={messages.length === 0 ? "What data do you want to see?" : "Refine the query..."}
            autoSize={{ minRows: 1, maxRows: isMobile ? 3 : 4 }}
            disabled={!isConnected || isWorking}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!inputValue.trim() || !isConnected || isWorking}
            loading={isWorking}
          />
        </Space.Compact>
        {!isMobile && (
          <Text type="secondary" style={{ fontSize: 11, textAlign: 'center', display: 'block', marginTop: 8 }}>
            Enter to send
          </Text>
        )}
      </div>
    </div>
  );
}
