'use client';

import { useCallback, useRef } from 'react';
import { App } from 'antd';
import { useConnectionStore } from '@/stores/connectionStore';
import { useAiStore } from '@/stores/aiStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { useAiChatStore, ToolCallInfo } from '@/stores/aiChatStore';
import { useQueryStore, QueryResult } from '@/stores/queryStore';
import type { AgentStreamEvent } from '@/lib/agent';

const MAX_STEPS = 25;

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function useAiAgent() {
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
    agentProgress,
    addUserMessage,
    addAssistantMessage,
    addSystemMessage,
    setIsGenerating,
    setCurrentSql,
    setIsAiGenerated,
    startNewConversation,
    startAgent,
    updateAgentStep,
    addAgentToolCall,
    updateAgentToolCall,
    completeAgent,
  } = useAiChatStore();

  const abortControllerRef = useRef<AbortController | null>(null);

  // Execute a query (for when agent finalizes)
  const executeQuery = useCallback(
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

  // Send a message to the agent
  const sendMessage = useCallback(
    async (prompt: string): Promise<boolean> => {
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

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      addUserMessage(prompt);
      startAgent(prompt, MAX_STEPS);

      // Build conversation history
      const conversationHistory: ConversationMessage[] = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.role === 'assistant'
            ? JSON.stringify({ sql: msg.sql, explanation: msg.explanation })
            : msg.content,
        }));

      try {
        const response = await fetch('/api/ai-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            apiKey,
            connectionString,
            schema: tables,
            conversationHistory,
            previousSql: currentSql,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to start agent');
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response stream');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let finalSql: string | null = null;
        let finalExplanation: string | null = null;
        let reachedLimit = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') {
                continue;
              }

              try {
                const event: AgentStreamEvent = JSON.parse(data);

                switch (event.type) {
                  case 'step':
                    updateAgentStep(event.step);
                    break;

                  case 'tool_call_start': {
                    const toolCall: ToolCallInfo = {
                      id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                      toolName: event.toolName,
                      args: event.args,
                      result: null,
                      timestamp: Date.now(),
                      status: 'running',
                    };
                    addAgentToolCall(toolCall);
                    break;
                  }

                  case 'tool_call_result': {
                    const tc = event.toolCall;

                    // Update the tool call with result
                    updateAgentToolCall(tc.id, {
                      result: tc.result,
                      status: (tc.result as { error?: string })?.error ? 'error' : 'success',
                    });

                    // Handle updateQueryUI specially
                    if (tc.toolName === 'updateQueryUI') {
                      const args = tc.args as {
                        sql: string;
                        explanation: string;
                        changes?: string[];
                        confidence?: string;
                        suggestions?: string[];
                      };
                      finalSql = args.sql;
                      finalExplanation = args.explanation;

                      // Add assistant message with the final query
                      addAssistantMessage({
                        content: args.explanation,
                        sql: args.sql,
                        previousSql: currentSql || undefined,
                        explanation: args.explanation,
                        confidence: args.confidence as 'high' | 'medium' | 'low',
                        suggestions: args.suggestions,
                      });

                      setCurrentQuery(args.sql);
                      setCurrentSql(args.sql);
                      setIsAiGenerated(true);
                    }

                    // Handle executeQuery results for display
                    if (tc.toolName === 'executeQuery') {
                      const result = tc.result as {
                        success: boolean;
                        rowCount?: number;
                        executionTime?: number;
                        rows?: Record<string, unknown>[];
                        error?: string;
                        warning?: string;
                      };

                      if (result.success) {
                        addSystemMessage(
                          `Query executed: ${result.rowCount} rows in ${result.executionTime}ms${result.warning ? ` - ${result.warning}` : ''}`,
                          {
                            rowCount: result.rowCount || 0,
                            executionTime: result.executionTime || 0,
                            sampleResults: result.rows?.slice(0, 3),
                          }
                        );
                      } else if (result.error) {
                        addSystemMessage(`Query error: ${result.error}`);
                      }
                    }
                    break;
                  }

                  case 'error':
                    addSystemMessage(`Error: ${event.error}`);
                    break;

                  case 'complete':
                    reachedLimit = event.state.reachedStepLimit;
                    if (!finalSql && event.state.currentSql) {
                      finalSql = event.state.currentSql;
                    }
                    break;
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }

        completeAgent(reachedLimit);

        // If we got a final SQL, execute it
        if (finalSql) {
          const result = await executeQuery(finalSql);
          if (result.success && result.result) {
            message.success(`Query ready (${result.result.executionTime}ms)`);
          }
        }

        if (reachedLimit) {
          addSystemMessage(
            `Agent reached ${MAX_STEPS} step limit. Click "Continue" to let it keep trying.`
          );
        }

        return true;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          addSystemMessage('Agent stopped.');
          completeAgent(false);
          return false;
        }

        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        addAssistantMessage({
          content: '',
          error: errorMessage,
        });
        completeAgent(false);
        return false;
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
      startAgent,
      updateAgentStep,
      addAgentToolCall,
      updateAgentToolCall,
      completeAgent,
      setCurrentQuery,
      setCurrentSql,
      setIsAiGenerated,
      executeQuery,
      message,
    ]
  );

  // Continue the agent after step limit
  const continueAgent = useCallback(async (): Promise<boolean> => {
    if (!agentProgress?.canContinue) {
      return false;
    }

    return sendMessage(`Continue working on the goal: ${agentProgress.goal}`);
  }, [agentProgress, sendMessage]);

  // Stop the agent
  const stopAgent = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    completeAgent(false);
  }, [completeAgent]);

  // Manual query execution
  const runQuery = useCallback(
    async (sql?: string): Promise<boolean> => {
      const queryToRun = sql || currentSql;
      if (!queryToRun) {
        message.warning('No query to run');
        return false;
      }

      const result = await executeQuery(queryToRun);

      if (result.success && result.result) {
        addSystemMessage(
          `Query executed successfully`,
          {
            rowCount: result.result.rowCount,
            executionTime: result.result.executionTime,
            sampleResults: result.result.rows.slice(0, 3),
          }
        );
        message.success(`Query executed (${result.result.executionTime}ms)`);
        return true;
      } else if (result.error) {
        addSystemMessage(`Query error: ${result.error}`);
        message.error(result.error);
        return false;
      }

      return false;
    },
    [currentSql, executeQuery, addSystemMessage, message]
  );

  const startNew = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    startNewConversation();
    setCurrentQuery('');
  }, [startNewConversation, setCurrentQuery]);

  return {
    messages,
    currentSql,
    isGenerating,
    isAiGenerated,
    agentProgress,
    sendMessage,
    continueAgent,
    stopAgent,
    runQuery,
    startNewConversation: startNew,
    setCurrentSql,
    setIsAiGenerated,
  };
}
