'use client';

import { useCallback } from 'react';
import { App } from 'antd';
import { useConnectionStore } from '@/stores/connectionStore';
import { useAiStore } from '@/stores/aiStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { useAiChatStore } from '@/stores/aiChatStore';
import { useQueryStore } from '@/stores/queryStore';

interface AiQueryResponse {
  sql?: string;
  explanation?: string;
  changes?: string[];
  error?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function useAiChat() {
  const { message } = App.useApp();
  const connectionString = useConnectionStore((state) => state.connectionString);
  const apiKey = useAiStore((state) => state.apiKey);
  const tables = useSchemaStore((state) => state.tables);
  const { setCurrentQuery } = useQueryStore();

  const {
    messages,
    currentSql,
    isGenerating,
    addUserMessage,
    addAssistantMessage,
    setIsGenerating,
    setCurrentSql,
    startNewConversation,
  } = useAiChatStore();

  const sendMessage = useCallback(
    async (prompt: string): Promise<boolean> => {
      // Validation
      if (!connectionString) {
        message.error('No database connection. Please connect to a database first.');
        return false;
      }

      if (!apiKey || apiKey.length === 0) {
        message.error('Please enter your Claude API key');
        return false;
      }

      if (!prompt.trim()) {
        return false;
      }

      // Add user message to conversation
      addUserMessage(prompt);
      setIsGenerating(true);

      try {
        // Build conversation history for API
        const conversationHistory: ConversationMessage[] = messages.map((msg) => ({
          role: msg.role,
          content: msg.role === 'assistant'
            ? JSON.stringify({
                sql: msg.sql,
                explanation: msg.explanation,
              })
            : msg.content,
        }));

        const response = await fetch('/api/ai-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            apiKey,
            schema: tables,
            conversationHistory,
            currentSql,
          }),
        });

        const data: AiQueryResponse = await response.json();

        if (!response.ok) {
          const errorMessage = data.error || 'Failed to generate query';
          addAssistantMessage({
            content: '',
            error: errorMessage,
          });
          return false;
        }

        if (data.sql) {
          const previousSql = currentSql;
          addAssistantMessage({
            content: data.explanation || '',
            sql: data.sql,
            previousSql: previousSql || undefined,
            explanation: data.explanation,
          });

          // Update the query in the editor
          setCurrentQuery(data.sql);
          return true;
        }

        addAssistantMessage({
          content: '',
          error: 'No SQL returned from AI',
        });
        return false;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        addAssistantMessage({
          content: '',
          error: errorMessage,
        });
        return false;
      } finally {
        setIsGenerating(false);
      }
    },
    [
      connectionString,
      apiKey,
      tables,
      messages,
      currentSql,
      addUserMessage,
      addAssistantMessage,
      setIsGenerating,
      setCurrentQuery,
      message,
    ]
  );

  const startNew = useCallback(() => {
    startNewConversation();
    setCurrentQuery('');
  }, [startNewConversation, setCurrentQuery]);

  return {
    messages,
    currentSql,
    isGenerating,
    sendMessage,
    startNewConversation: startNew,
    setCurrentSql,
  };
}
