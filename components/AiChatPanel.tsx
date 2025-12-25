'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Typography, Grid, Tooltip } from 'antd';
import {
  SendOutlined,
  CloseOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  KeyOutlined,
  ExpandOutlined,
  CompressOutlined,
} from '@ant-design/icons';
import { useAiChatStore } from '@/stores/aiChatStore';
import { useAiStore } from '@/stores/aiStore';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore } from '@/stores/queryStore';
import { useQuery } from '@/hooks/useQuery';
import { useAiChat } from '@/hooks/useAiChat';
import { ChatMessage } from './ChatMessage';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

export function AiChatPanel() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { isOpen, setOpen, messages, isGenerating } = useAiChatStore();
  const { apiKey, setApiKey, setPersistApiKey } = useAiStore();
  const { connectionString } = useConnectionStore();
  const { currentQuery, isExecuting } = useQueryStore();
  const { executeQuery } = useQuery();
  const { sendMessage, startNewConversation, currentSql } = useAiChat();

  const [inputValue, setInputValue] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState(apiKey || '');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() || isGenerating) return;

    // Save API key if needed
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

  const handleRunQuery = () => {
    if (currentSql || currentQuery) {
      executeQuery(currentSql || currentQuery);
    }
  };

  const handleNewConversation = () => {
    startNewConversation();
    setInputValue('');
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleApiKeySave = () => {
    if (apiKeyInput) {
      setApiKey(apiKeyInput);
      setPersistApiKey(true);
    }
  };

  const isConnected = !!connectionString;

  if (!isOpen) return null;

  return (
    <div className={`ai-chat-panel ${isMobile ? 'ai-chat-panel-mobile' : ''} ${isExpanded ? 'ai-chat-panel-expanded' : ''}`}>
      {/* Header */}
      <div className="ai-chat-header">
        <div className="ai-chat-header-left">
          <RobotOutlined className="ai-chat-header-icon" />
          <Title level={5} className="ai-chat-title">AI Query Assistant</Title>
        </div>
        <div className="ai-chat-header-actions">
          {messages.length > 0 && (
            <Tooltip title="New conversation">
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleNewConversation}
                className="ai-chat-header-btn"
              />
            </Tooltip>
          )}
          {!isMobile && (
            <Tooltip title={isExpanded ? 'Collapse' : 'Expand'}>
              <Button
                type="text"
                size="small"
                icon={isExpanded ? <CompressOutlined /> : <ExpandOutlined />}
                onClick={() => setIsExpanded(!isExpanded)}
                className="ai-chat-header-btn"
              />
            </Tooltip>
          )}
          <Tooltip title="Close">
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={handleClose}
              className="ai-chat-header-btn"
            />
          </Tooltip>
        </div>
      </div>

      {/* Content */}
      <div className="ai-chat-content">
        {/* API Key prompt if needed */}
        {!apiKey && (
          <div className="ai-chat-api-key-section">
            <div className="ai-chat-api-key-header">
              <KeyOutlined />
              <Text>Enter your Claude API key to start</Text>
            </div>
            <div className="ai-chat-api-key-input">
              <Input.Password
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-ant-..."
                onPressEnter={handleApiKeySave}
              />
              <Button
                type="primary"
                onClick={handleApiKeySave}
                disabled={!apiKeyInput}
              >
                Save
              </Button>
            </div>
            <Text type="secondary" className="text-xs">
              Your API key is stored locally in your browser.
            </Text>
          </div>
        )}

        {/* Not connected warning */}
        {!isConnected && (
          <div className="ai-chat-warning">
            <Text type="secondary">Connect to a database to start generating queries.</Text>
          </div>
        )}

        {/* Messages */}
        {messages.length === 0 && apiKey && isConnected && (
          <div className="ai-chat-empty">
            <RobotOutlined className="ai-chat-empty-icon" />
            <Text type="secondary">Describe the query you want to create</Text>
            <Text type="secondary" className="text-xs">
              I&apos;ll help you build and refine SQL queries step by step
            </Text>
          </div>
        )}

        <div className="ai-chat-messages">
          {messages.map((msg, index) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isLatest={index === messages.length - 1}
            />
          ))}

          {isGenerating && (
            <div className="ai-chat-generating">
              <div className="ai-chat-generating-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <Text type="secondary" className="text-xs">Generating...</Text>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Footer with input and actions */}
      <div className="ai-chat-footer">
        {/* Run button when there's a query */}
        {(currentSql || currentQuery) && messages.length > 0 && (
          <div className="ai-chat-run-bar">
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleRunQuery}
              loading={isExecuting}
              className="ai-chat-run-btn"
            >
              Run Query
            </Button>
          </div>
        )}

        <div className="ai-chat-input-container">
          <TextArea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              messages.length === 0
                ? "e.g., 'Show all users who signed up this month'"
                : "e.g., 'Add a filter for active users only'"
            }
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={!apiKey || !isConnected || isGenerating}
            className="ai-chat-input"
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!inputValue.trim() || !apiKey || !isConnected || isGenerating}
            loading={isGenerating}
            className="ai-chat-send-btn"
          />
        </div>
        {!isMobile && (
          <Text type="secondary" className="ai-chat-hint text-xs">
            Press Enter to send, Shift+Enter for new line
          </Text>
        )}
      </div>
    </div>
  );
}
