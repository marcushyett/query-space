'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Typography, Grid, Space, Spin, Empty } from 'antd';
import {
  SendOutlined,
  CloseOutlined,
  PlusOutlined,
  RobotOutlined,
  KeyOutlined,
  ExpandOutlined,
  CompressOutlined,
} from '@ant-design/icons';
import { useAiChatStore } from '@/stores/aiChatStore';
import { useAiStore } from '@/stores/aiStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore } from '@/stores/queryStore';
import { useAiAgent } from '@/hooks/useAiAgent';
import { ChatMessage } from './ChatMessage';
import { AgentProgress } from './AgentProgress';

const { Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

export function AiChatPanel() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { isOpen, setOpen, messages, isGenerating, agentProgress } = useAiChatStore();
  const { apiKey, setApiKey, setPersistApiKey } = useAiStore();
  const { connectionString } = useConnectionStore();
  const { isExecuting } = useQueryStore();
  const { sendMessage, continueAgent, stopAgent, startNewConversation } = useAiAgent();

  const [inputValue, setInputValue] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState(apiKey || '');
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
    if (apiKeyInput && !apiKey) {
      setApiKey(apiKeyInput);
    }
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

  const handleApiKeySave = () => {
    if (apiKeyInput) {
      setApiKey(apiKeyInput);
      setPersistApiKey(true);
    }
  };

  const isConnected = !!connectionString;
  const isWorking = isGenerating || isExecuting;

  if (!isOpen) return null;

  return (
    <div className={`ai-chat-panel ${isMobile ? 'ai-chat-panel-mobile' : ''} ${isExpanded ? 'ai-chat-panel-expanded' : ''}`}>
      {/* Header */}
      <div className="panel-header">
        <Space>
          <RobotOutlined />
          <Text strong>AI Assistant</Text>
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
        {/* API Key prompt */}
        {!apiKey && (
          <div className="p-4">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space>
                <KeyOutlined />
                <Text>Enter your Claude API key to start</Text>
              </Space>
              <Space.Compact style={{ width: '100%' }}>
                <Input.Password
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-ant-..."
                  onPressEnter={handleApiKeySave}
                  style={{ flex: 1 }}
                />
                <Button type="primary" onClick={handleApiKeySave} disabled={!apiKeyInput}>
                  Save
                </Button>
              </Space.Compact>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Stored locally in your browser
              </Text>
            </Space>
          </div>
        )}

        {/* Not connected */}
        {!isConnected && (
          <div className="p-4 text-center">
            <Text type="secondary">Connect to a database first</Text>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && apiKey && isConnected && (
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
            />
          ))}

          {/* Agent Progress */}
          {agentProgress && agentProgress.isRunning && (
            <AgentProgress
              currentStep={agentProgress.currentStep}
              maxSteps={agentProgress.maxSteps}
              toolCalls={agentProgress.toolCalls}
              streamingText={agentProgress.streamingText}
              onStop={stopAgent}
            />
          )}

          {/* Continue Button when step limit reached */}
          {agentProgress && agentProgress.canContinue && !agentProgress.isRunning && (
            <div className="p-4 text-center">
              <Space direction="vertical" size={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Agent reached {agentProgress.maxSteps} step limit
                </Text>
                <Button
                  type="primary"
                  onClick={continueAgent}
                  icon={<SendOutlined />}
                >
                  Continue
                </Button>
              </Space>
            </div>
          )}

          {isWorking && !agentProgress?.isRunning && (
            <div className="p-4 text-center">
              <Spin size="small" />
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
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
            disabled={!apiKey || !isConnected || isWorking}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!inputValue.trim() || !apiKey || !isConnected || isWorking}
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
