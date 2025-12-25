'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Typography, Grid } from 'antd';
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
  const { isExecuting } = useQueryStore();
  const { sendMessage, startNewConversation } = useAiChat();

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
    if (!inputValue.trim() || isGenerating || isExecuting) return;

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
  const isWorking = isGenerating || isExecuting;

  if (!isOpen) return null;

  return (
    <div className={`ai-chat-panel ${isMobile ? 'ai-chat-panel-mobile' : ''} ${isExpanded ? 'ai-chat-panel-expanded' : ''}`}>
      {/* Header */}
      <div className="ai-chat-header">
        <div className="ai-chat-header-left">
          <RobotOutlined className="ai-chat-header-icon" />
          <Title level={5} className="ai-chat-title">AI Assistant</Title>
        </div>
        <div className="ai-chat-header-actions">
          {messages.length > 0 && (
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleNewConversation}
              className="ai-chat-header-btn"
              aria-label="New conversation"
            />
          )}
          {!isMobile && (
            <Button
              type="text"
              size="small"
              icon={isExpanded ? <CompressOutlined /> : <ExpandOutlined />}
              onClick={() => setIsExpanded(!isExpanded)}
              className="ai-chat-header-btn"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            />
          )}
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={handleClose}
            className="ai-chat-header-btn"
            aria-label="Close"
          />
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
                size={isMobile ? 'large' : 'middle'}
              />
              <Button
                type="primary"
                onClick={handleApiKeySave}
                disabled={!apiKeyInput}
                size={isMobile ? 'large' : 'middle'}
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

        {/* Empty state */}
        {messages.length === 0 && apiKey && isConnected && (
          <div className="ai-chat-empty">
            <RobotOutlined className="ai-chat-empty-icon" />
            <Text type="secondary" className="ai-chat-empty-title">
              Ask me to create a query
            </Text>
            <Text type="secondary" className="text-xs ai-chat-empty-subtitle">
              I&apos;ll run it automatically and fix any errors
            </Text>
            {/* Quick suggestions for mobile */}
            {isMobile && (
              <div className="ai-chat-suggestions">
                <Button
                  size="small"
                  onClick={() => setInputValue('Show me all tables')}
                  className="ai-chat-suggestion-btn"
                >
                  Show all tables
                </Button>
                <Button
                  size="small"
                  onClick={() => setInputValue('Count rows in each table')}
                  className="ai-chat-suggestion-btn"
                >
                  Count rows
                </Button>
              </div>
            )}
          </div>
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

          {isWorking && (
            <div className="ai-chat-generating">
              <div className="ai-chat-generating-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <Text type="secondary" className="text-xs">
                {isExecuting ? 'Running query...' : 'Generating...'}
              </Text>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Footer with input */}
      <div className="ai-chat-footer">
        <div className="ai-chat-input-container">
          <TextArea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              messages.length === 0
                ? "What data do you want to see?"
                : "Refine the query..."
            }
            autoSize={{ minRows: 1, maxRows: isMobile ? 3 : 4 }}
            disabled={!apiKey || !isConnected || isWorking}
            className="ai-chat-input"
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!inputValue.trim() || !apiKey || !isConnected || isWorking}
            loading={isWorking}
            className="ai-chat-send-btn"
          />
        </div>
        {!isMobile && (
          <Text type="secondary" className="ai-chat-hint text-xs">
            Press Enter to send
          </Text>
        )}
      </div>
    </div>
  );
}
