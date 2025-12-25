'use client';

import { useCallback, useRef } from 'react';
import { App } from 'antd';
import { useConnectionStore } from '@/stores/connectionStore';
import { useAiStore } from '@/stores/aiStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { useAiChatStore } from '@/stores/aiChatStore';
import { useQueryStore, QueryResult } from '@/stores/queryStore';

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
  const { setCurrentQuery, setQueryResults, addToHistory, setIsExecuting } = useQueryStore();

  const {
    messages,
    currentSql,
    isGenerating,
    isAiGenerated,
    addUserMessage,
    addAssistantMessage,
    addSystemMessage,
    setIsGenerating,
    setCurrentSql,
    setIsAiGenerated,
    startNewConversation,
  } = useAiChatStore();

  // Track if we're in an auto-fix loop to prevent infinite loops
  const autoFixAttemptRef = useRef(0);
  const maxAutoFixAttempts = 2;

  // Helper to check if SQL is a SELECT query (safe to auto-run)
  const isSelectQuery = useCallback((sql: string): boolean => {
    const trimmed = sql.trim().toUpperCase();
    return trimmed.startsWith('SELECT') ||
           trimmed.startsWith('WITH') || // CTEs that usually end with SELECT
           trimmed.startsWith('EXPLAIN');
  }, []);

  // Execute a query and return the result
  const executeQueryInternal = useCallback(
    async (sql: string): Promise<{ success: boolean; result?: QueryResult; error?: string }> => {
      if (!connectionString) {
        return { success: false, error: 'No database connection' };
      }

      setIsExecuting(true);

      try {
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionString, sql }),
        });

        const data = await response.json();

        if (!response.ok) {
          return { success: false, error: data.error || 'Query execution failed' };
        }

        const result: QueryResult = {
          rows: data.rows,
          fields: data.fields,
          rowCount: data.rowCount,
          executionTime: data.executionTime,
        };

        setQueryResults(result);
        addToHistory(sql, data.rowCount, data.executionTime);

        return { success: true, result };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Query execution failed';
        return { success: false, error: errorMessage };
      } finally {
        setIsExecuting(false);
      }
    },
    [connectionString, setIsExecuting, setQueryResults, addToHistory]
  );

  // Auto-fix a query error by sending it back to the AI
  const autoFixQuery = useCallback(
    async (sql: string, error: string): Promise<boolean> => {
      if (autoFixAttemptRef.current >= maxAutoFixAttempts) {
        addSystemMessage(`Auto-fix limit reached. Please review the error and try a different approach.`);
        autoFixAttemptRef.current = 0;
        return false;
      }

      autoFixAttemptRef.current++;

      // Build conversation history for API
      const conversationHistory: ConversationMessage[] = messages.map((msg) => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.role === 'assistant'
          ? JSON.stringify({
              sql: msg.sql,
              explanation: msg.explanation,
            })
          : msg.content,
      }));

      // Add the error context as if the user reported it
      const errorPrompt = `The query failed with this error: "${error}". Please fix the SQL query.`;

      setIsGenerating(true);

      try {
        const response = await fetch('/api/ai-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: errorPrompt,
            apiKey,
            schema: tables,
            conversationHistory,
            currentSql: sql,
            isAutoFix: true,
          }),
        });

        const data: AiQueryResponse = await response.json();

        if (!response.ok || !data.sql) {
          addAssistantMessage({
            content: '',
            error: data.error || 'Failed to fix the query',
            isAutoFix: true,
          });
          return false;
        }

        const previousSql = sql;
        addAssistantMessage({
          content: data.explanation || 'Fixed the query based on the error.',
          sql: data.sql,
          previousSql,
          explanation: data.explanation,
          isAutoFix: true,
        });

        // Update the query in the editor
        setCurrentQuery(data.sql);

        // Try to run the fixed query if it's a SELECT
        if (isSelectQuery(data.sql)) {
          const result = await executeQueryInternal(data.sql);
          if (result.success && result.result) {
            addSystemMessage(
              `Query executed successfully`,
              { rowCount: result.result.rowCount, executionTime: result.result.executionTime }
            );
            message.success(`Query fixed and executed (${result.result.executionTime}ms)`);
            autoFixAttemptRef.current = 0;
            return true;
          } else if (result.error) {
            // Try to fix again if we haven't exceeded attempts
            addSystemMessage(`Query still has an error: ${result.error}`);
            return autoFixQuery(data.sql, result.error);
          }
        }

        autoFixAttemptRef.current = 0;
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        addAssistantMessage({
          content: '',
          error: errorMessage,
          isAutoFix: true,
        });
        return false;
      } finally {
        setIsGenerating(false);
      }
    },
    [
      messages,
      apiKey,
      tables,
      addAssistantMessage,
      addSystemMessage,
      setIsGenerating,
      setCurrentQuery,
      isSelectQuery,
      executeQueryInternal,
      message,
    ]
  );

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

      // Reset auto-fix counter for new user messages
      autoFixAttemptRef.current = 0;

      // Add user message to conversation
      addUserMessage(prompt);
      setIsGenerating(true);

      try {
        // Build conversation history for API
        const conversationHistory: ConversationMessage[] = messages.map((msg) => ({
          role: msg.role === 'system' ? 'user' : msg.role,
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
          setIsGenerating(false);

          // Auto-run SELECT queries
          if (isSelectQuery(data.sql)) {
            const result = await executeQueryInternal(data.sql);
            if (result.success && result.result) {
              addSystemMessage(
                `Query executed successfully`,
                { rowCount: result.result.rowCount, executionTime: result.result.executionTime }
              );
              message.success(`Query executed (${result.result.executionTime}ms)`);
            } else if (result.error) {
              // Show error in chat and auto-fix
              addSystemMessage(`Query error: ${result.error}`);
              await autoFixQuery(data.sql, result.error);
            }
          }

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
      addSystemMessage,
      setIsGenerating,
      setCurrentQuery,
      isSelectQuery,
      executeQueryInternal,
      autoFixQuery,
      message,
    ]
  );

  // Manual query execution with error handling
  const runQuery = useCallback(
    async (sql?: string): Promise<boolean> => {
      const queryToRun = sql || currentSql;
      if (!queryToRun) {
        message.warning('No query to run');
        return false;
      }

      const result = await executeQueryInternal(queryToRun);

      if (result.success && result.result) {
        addSystemMessage(
          `Query executed successfully`,
          { rowCount: result.result.rowCount, executionTime: result.result.executionTime }
        );
        message.success(`Query executed (${result.result.executionTime}ms)`);
        return true;
      } else if (result.error) {
        addSystemMessage(`Query error: ${result.error}`);

        // Auto-fix if this was an AI-generated query
        if (isAiGenerated) {
          await autoFixQuery(queryToRun, result.error);
        } else {
          message.error(result.error);
        }
        return false;
      }

      return false;
    },
    [currentSql, isAiGenerated, executeQueryInternal, addSystemMessage, autoFixQuery, message]
  );

  const startNew = useCallback(() => {
    startNewConversation();
    setCurrentQuery('');
    autoFixAttemptRef.current = 0;
  }, [startNewConversation, setCurrentQuery]);

  return {
    messages,
    currentSql,
    isGenerating,
    isAiGenerated,
    sendMessage,
    runQuery,
    startNewConversation: startNew,
    setCurrentSql,
    setIsAiGenerated,
  };
}
