'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { App } from 'antd';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { useAiChatStore, ToolCallInfo, ChatChartData, QueryMetadata, AgentTodoItem, ClaudeModelId } from '@/stores/aiChatStore';
import { useQueryStore, QueryResult, saveQueryExecution } from '@/stores/queryStore';
import { useAgentSessionStore, AgentSession } from '@/stores/agentSessionStore';
import { useUiStore } from '@/stores/uiStore';
import type { AgentStreamEvent } from '@/lib/agent';
import type { ChartConfig } from '@/lib/chart-utils';

const MAX_STEPS = 25;
const POLL_INTERVAL = 500; // Poll every 500ms

interface PollResponse {
  events: {
    sequence: number;
    type: string;
    data: AgentStreamEvent;
    timestamp: string;
  }[];
  isRunning: boolean;
  session: {
    status: string;
    currentStep: number;
    currentSql: string | null;
    queryName: string | null;
    lastError: string | null;
    todos: unknown;
  } | null;
  nextSequence: number;
}

/**
 * Hook for using persistent background agents.
 * Agents continue running even when the frontend disconnects.
 */
export function usePersistentAgent() {
  const { message } = App.useApp();
  const { organizationId } = useConnectionStore();
  const tables = useSchemaStore((state) => state.tables);
  const { setCurrentQuery, setQueryName, setQueryResults, addToHistory, setIsExecuting } = useQueryStore();
  const { currentProjectId, currentQueryId, setCurrentQueryId } = useUiStore();

  // Connection state
  const [isConnected, setIsConnected] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Session persistence
  const {
    pauseSession,
    completeSession: completeSessionStore,
    getResumableSessions,
    getSession,
    cleanupOldSessions,
    addChatMessage,
  } = useAgentSessionStore();

  const {
    messages,
    currentSql,
    isGenerating,
    isAiGenerated,
    agentProgress,
    selectedModel,
    addUserMessage,
    addAssistantMessage,
    addSystemMessage,
    addChartMessage,
    addQueryMessage,
    addTodoMessage,
    addThinkingMessage,
    addToolActivityMessage,
    updateLatestToolActivityMessage,
    setCurrentSql,
    setIsAiGenerated,
    startNewConversation,
    startAgent,
    updateAgentStep,
    appendStreamingText,
    addAgentToolCall,
    updateAgentToolCall,
    completeAgent,
    setAgentTodos,
    setOpen,
    setHasShownFinalQuery,
  } = useAiChatStore();

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSequenceRef = useRef<number>(-1);
  const sessionIdRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Cleanup old sessions on mount
  useEffect(() => {
    cleanupOldSessions();
  }, [cleanupOldSessions]);

  // Execute a query
  const executeQuery = useCallback(
    async (sql: string, sessionId?: string, queryName?: string): Promise<{ success: boolean; result?: QueryResult; error?: string }> => {
      if (!organizationId) {
        return { success: false, error: 'No database connection' };
      }

      setIsExecuting(true);

      try {
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId, sql }),
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

        try {
          const savedQuery = await saveQueryExecution({
            organizationId,
            sql,
            source: 'AI',
            success: true,
            rowCount: data.rowCount,
            executionTime: data.executionTime,
            agentSessionId: sessionId,
            queryName,
          });
          addToHistory(savedQuery);
        } catch (saveError) {
          console.error('Failed to save query execution:', saveError);
        }

        return { success: true, result };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Query execution failed';
        return { success: false, error: errorMessage };
      } finally {
        setIsExecuting(false);
      }
    },
    [organizationId, setIsExecuting, setQueryResults, addToHistory]
  );

  // Process an event from the stream
  const processEvent = useCallback(
    (event: AgentStreamEvent, finalSqlRef: { current: string | null }, sessionId: string) => {
      switch (event.type) {
        case 'step': {
          const currentStreamingText = useAiChatStore.getState().agentProgress?.streamingText;
          if (currentStreamingText && currentStreamingText.trim()) {
            addThinkingMessage(currentStreamingText);
          }
          updateAgentStep(event.step);
          break;
        }

        case 'text':
          appendStreamingText(event.text);
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

          const toolLabels: Record<string, string> = {
            get_table_schema: 'Getting database schema...',
            execute_query: 'Running query...',
            validate_query: 'Validating query...',
          };
          if (toolLabels[event.toolName]) {
            addToolActivityMessage(event.toolName, 'running', toolLabels[event.toolName]);
          }
          break;
        }

        case 'tool_call_result': {
          const tc = event.toolCall;
          // Check if error is a non-empty string (not null, undefined, or empty string)
          const errorValue = (tc.result as { error?: unknown })?.error;
          const hasError = typeof errorValue === 'string' && errorValue.length > 0;
          const toolStatus = hasError ? 'error' : 'success';

          updateAgentToolCall(tc.id, {
            result: tc.result,
            status: toolStatus,
          });

          const toolsWithActivity = ['get_table_schema', 'execute_query', 'validate_query'];
          if (toolsWithActivity.includes(tc.toolName)) {
            // Pass error message as result so it's visible to the user
            const errorMessage = hasError ? String(errorValue) : undefined;
            updateLatestToolActivityMessage(tc.toolName, toolStatus, errorMessage);
          }

          // Handle update_query_ui
          if (tc.toolName === 'update_query_ui') {
            const args = tc.args as {
              sql: string;
              explanation: string;
              summary?: string;
              confidence?: string;
              suggestions?: string[];
            };
            finalSqlRef.current = args.sql;

            addAssistantMessage({
              content: args.explanation,
              sql: args.sql,
              previousSql: currentSql || undefined,
              explanation: args.explanation,
              summary: args.summary,
              confidence: args.confidence as 'high' | 'medium' | 'low',
              suggestions: args.suggestions,
            });

            addChatMessage(sessionId, {
              role: 'assistant',
              content: args.explanation,
              timestamp: Date.now(),
              sql: args.sql,
              explanation: args.explanation,
              summary: args.summary,
            });

            setCurrentQuery(args.sql);
            setCurrentSql(args.sql);
            setIsAiGenerated(true);
            setHasShownFinalQuery(true);
          }

          // Handle execute_query results
          if (tc.toolName === 'execute_query') {
            const args = tc.args as { sql: string; title?: string; description?: string };
            const result = tc.result as {
              success: boolean;
              rowCount?: number;
              executionTime?: number;
              rows?: Record<string, unknown>[];
              error?: string;
              title?: string;
              description?: string;
            };

            if (result.success) {
              const queryMetadata: QueryMetadata = {
                sql: args.sql,
                title: result.title || args.title || 'Query Result',
                description: result.description || args.description || '',
                rowCount: result.rowCount || 0,
                executionTime: result.executionTime || 0,
                sampleResults: result.rows?.slice(0, 5),
              };
              addQueryMessage(queryMetadata);
            } else if (result.error) {
              addSystemMessage(`Query error: ${result.error}`);
            }
          }

          // Handle generate_chart
          if (tc.toolName === 'generate_chart') {
            const args = tc.args as { title?: string; description?: string };
            const result = tc.result as {
              success: boolean;
              chartConfig?: ChartConfig;
              chartData?: Record<string, unknown>[];
              xAxisKey?: string;
              yAxisKeys?: string[];
              message?: string;
              title?: string;
              description?: string;
            };

            if (result.success && result.chartConfig && result.chartData) {
              const chartData: ChatChartData = {
                config: result.chartConfig,
                data: result.chartData,
                xAxisKey: result.xAxisKey || '',
                yAxisKeys: result.yAxisKeys || [],
                title: result.title || args.title,
                description: result.description || args.description,
              };
              addChartMessage(chartData, result.message);
            }
          }

          // Handle set_query_name
          if (tc.toolName === 'set_query_name') {
            const result = tc.result as { success: boolean; name?: string };
            if (result.success && result.name) {
              setQueryName(result.name);
            }
          }

          // Handle manage_todo
          if (tc.toolName === 'manage_todo') {
            const result = tc.result as {
              success: boolean;
              action: string;
              items?: { id: string; text: string; status: string }[];
              item_id?: string;
              item?: { id: string; text: string; status: string };
            };

            if (result.success) {
              const currentTodos = useAiChatStore.getState().agentProgress?.todos || [];
              let updatedTodos: AgentTodoItem[] = currentTodos;

              switch (result.action) {
                case 'create':
                  if (result.items) {
                    updatedTodos = result.items.map((item) => ({
                      id: item.id,
                      text: item.text,
                      status: item.status as AgentTodoItem['status'],
                      createdAt: Date.now(),
                    }));
                    setAgentTodos(updatedTodos);
                    addTodoMessage(updatedTodos);
                  }
                  break;
                case 'set_current':
                  if (result.item_id) {
                    updatedTodos = currentTodos.map((t) => ({
                      ...t,
                      status: t.id === result.item_id ? 'in_progress' as const : (t.status === 'in_progress' ? 'pending' as const : t.status),
                    }));
                    setAgentTodos(updatedTodos);
                    addTodoMessage(updatedTodos);
                  }
                  break;
                case 'complete':
                  if (result.item_id) {
                    updatedTodos = currentTodos.map((t) => ({
                      ...t,
                      status: t.id === result.item_id ? 'completed' as const : t.status,
                      completedAt: t.id === result.item_id ? Date.now() : t.completedAt,
                    }));
                    setAgentTodos(updatedTodos);
                    addTodoMessage(updatedTodos);
                  }
                  break;
                case 'skip':
                  if (result.item_id) {
                    updatedTodos = currentTodos.map((t) => ({
                      ...t,
                      status: t.id === result.item_id ? 'skipped' as const : t.status,
                    }));
                    setAgentTodos(updatedTodos);
                    addTodoMessage(updatedTodos);
                  }
                  break;
                case 'add':
                  if (result.item) {
                    const newTodo: AgentTodoItem = {
                      id: `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      text: result.item.text,
                      status: result.item.status as AgentTodoItem['status'],
                      createdAt: Date.now(),
                      addedDuringExecution: true,
                    };
                    updatedTodos = [...currentTodos, newTodo];
                    setAgentTodos(updatedTodos);
                    addTodoMessage(updatedTodos);
                  }
                  break;
              }
            }
          }
          break;
        }

        case 'error':
          addSystemMessage(`Error: ${event.error}`);
          break;

        case 'complete': {
          const state = event.state;
          const reachedLimit = state.reachedStepLimit;
          const hasIncompleteTodos = state.hasIncompleteTodos;
          const stopReason = state.stopReason;

          if (!finalSqlRef.current && state.currentSql) {
            finalSqlRef.current = state.currentSql;
          }

          completeAgent(reachedLimit, stopReason, hasIncompleteTodos);

          // Show appropriate message
          if (stopReason === 'timeout') {
            addSystemMessage('Agent paused due to execution time limit. Click "Continue" to resume.');
          } else if (reachedLimit) {
            addSystemMessage(`Agent reached ${MAX_STEPS} step limit. Click "Continue" to let it keep trying.`);
          } else if (hasIncompleteTodos) {
            const currentTodos = useAiChatStore.getState().agentProgress?.todos || [];
            const incompleteTodos = currentTodos.filter(t => t.status === 'pending' || t.status === 'in_progress');
            const completedCount = currentTodos.filter(t => t.status === 'completed').length;
            addSystemMessage(
              `Agent stopped with ${incompleteTodos.length} task(s) remaining (${completedCount}/${currentTodos.length} completed). Click "Continue" to finish.`
            );
          }
          break;
        }
      }
    },
    [
      currentSql,
      addThinkingMessage,
      updateAgentStep,
      appendStreamingText,
      addAgentToolCall,
      updateAgentToolCall,
      addToolActivityMessage,
      updateLatestToolActivityMessage,
      addAssistantMessage,
      addSystemMessage,
      addQueryMessage,
      addChartMessage,
      addTodoMessage,
      setCurrentQuery,
      setCurrentSql,
      setIsAiGenerated,
      setQueryName,
      setAgentTodos,
      completeAgent,
      addChatMessage,
      setHasShownFinalQuery,
    ]
  );

  // Poll for events from the server
  const startPolling = useCallback(
    (sessionId: string, onComplete?: (finalSql: string | null) => void) => {
      const finalSqlRef = { current: null as string | null };

      // Clear any existing polling
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      const poll = async () => {
        try {
          const response = await fetch(
            `/api/agent-sessions/${sessionId}/events?lastSequence=${lastSequenceRef.current}`
          );

          if (!response.ok) {
            throw new Error('Failed to fetch events');
          }

          setIsConnected(true);

          const data: PollResponse = await response.json();

          // Process each event
          for (const eventWrapper of data.events) {
            processEvent(eventWrapper.data, finalSqlRef, sessionId);
            lastSequenceRef.current = eventWrapper.sequence;
          }

          // Update local sequence
          if (data.nextSequence > lastSequenceRef.current) {
            lastSequenceRef.current = data.nextSequence;
          }

          // Check if we're done
          if (!data.isRunning) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setActiveSessionId(null);

            if (onComplete) {
              onComplete(finalSqlRef.current);
            }
          }
        } catch (error) {
          console.error('Polling error:', error);
          setIsConnected(false);
          // Don't stop polling on network error - agent might still be running
        }
      };

      // Initial poll
      poll();

      // Start interval
      pollIntervalRef.current = setInterval(poll, POLL_INTERVAL);
    },
    [processEvent]
  );

  // Send a message to start a new agent
  const sendMessage = useCallback(
    async (prompt: string): Promise<boolean> => {
      if (!organizationId) {
        message.error('No database connection. Please connect to a database first.');
        return false;
      }

      if (!prompt.trim()) {
        return false;
      }

      // Add user message to UI
      addUserMessage(prompt);
      startAgent(prompt, MAX_STEPS);

      // Reset sequence tracking
      lastSequenceRef.current = -1;

      try {
        // Start the agent via new API
        const response = await fetch('/api/agent-sessions/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            organizationId,
            projectId: currentProjectId || undefined,
            schema: tables,
            previousSql: currentSql,
            model: selectedModel,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to start agent');
        }

        const { sessionId, queryId } = await response.json();

        // If a query was auto-created, update the current query context
        if (queryId && !currentQueryId) {
          setCurrentQueryId(queryId);
        }
        sessionIdRef.current = sessionId;
        setActiveSessionId(sessionId);

        // Add user message to session history
        addChatMessage(sessionId, {
          role: 'user',
          content: prompt,
          timestamp: Date.now(),
        });

        // Start polling for events
        startPolling(sessionId, async (finalSql) => {
          const completedSessionId = sessionIdRef.current;
          sessionIdRef.current = null;

          // Check final status
          const session = await fetch(`/api/agent-sessions/${sessionId}`).then(r => r.json());
          const canContinue = session.status === 'PAUSED';

          if (canContinue) {
            pauseSession(completedSessionId || sessionId, '');
          } else {
            completeSessionStore(completedSessionId || sessionId, true);
          }

          // Execute final SQL if goal complete
          if (finalSql && session.status === 'COMPLETED') {
            const currentQueryName = useQueryStore.getState().queryName;
            const result = await executeQuery(finalSql, completedSessionId || undefined, currentQueryName || undefined);
            if (result.success && result.result) {
              message.success(`Query ready (${result.result.executionTime}ms)`);
            }
          }
        });

        return true;
      } catch (err: unknown) {
        const rawErrorMessage = err instanceof Error ? err.message : 'An error occurred';
        addAssistantMessage({ content: '', error: rawErrorMessage });
        completeAgent(false);
        return false;
      }
    },
    [
      organizationId,
      tables,
      currentSql,
      currentProjectId,
      currentQueryId,
      selectedModel,
      setCurrentQueryId,
      addUserMessage,
      addAssistantMessage,
      startAgent,
      completeAgent,
      message,
      pauseSession,
      completeSessionStore,
      addChatMessage,
      executeQuery,
      startPolling,
    ]
  );

  // Stop the agent
  const stopAgent = useCallback(async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (activeSessionId) {
      try {
        await fetch(`/api/agent-sessions/${activeSessionId}/stop`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('Failed to stop agent:', error);
      }

      pauseSession(activeSessionId, '');
      setActiveSessionId(null);
    }

    sessionIdRef.current = null;
    completeAgent(false);
    addSystemMessage('Agent stopped.');
  }, [activeSessionId, pauseSession, completeAgent, addSystemMessage]);

  // Continue a paused agent
  const continueAgent = useCallback(async (): Promise<boolean> => {
    if (!agentProgress?.canContinue) {
      return false;
    }

    // For persistent agent, we need to resume the session on the server
    const sessionId = sessionIdRef.current || activeSessionId;
    if (!sessionId) {
      return false;
    }

    // Reset sequence tracking for the resumed session
    // Get the last sequence number from the previous events
    lastSequenceRef.current = -1; // Let the server tell us where to resume

    try {
      const response = await fetch(`/api/agent-sessions/${sessionId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: tables,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resume agent');
      }

      addUserMessage('Continue');
      startAgent(agentProgress.goal, MAX_STEPS);
      setActiveSessionId(sessionId);

      // Start polling for events
      startPolling(sessionId, async (finalSql) => {
        const completedSessionId = sessionIdRef.current;
        sessionIdRef.current = null;

        const session = await fetch(`/api/agent-sessions/${sessionId}`).then(r => r.json());
        const canContinue = session.status === 'PAUSED';

        if (canContinue) {
          pauseSession(completedSessionId || sessionId, '');
        } else {
          completeSessionStore(completedSessionId || sessionId, true);
        }

        if (finalSql && session.status === 'COMPLETED') {
          const result = await executeQuery(finalSql);
          if (result.success && result.result) {
            message.success(`Query ready (${result.result.executionTime}ms)`);
          }
        }
      });

      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resume';
      addAssistantMessage({ content: '', error: errorMessage });
      completeAgent(false);
      return false;
    }
  }, [
    agentProgress,
    activeSessionId,
    tables,
    selectedModel,
    addUserMessage,
    addAssistantMessage,
    startAgent,
    completeAgent,
    pauseSession,
    completeSessionStore,
    executeQuery,
    message,
    startPolling,
  ]);

  // Resume a paused session
  const resumeSession = useCallback(
    async (session: AgentSession): Promise<boolean> => {
      if (!organizationId) {
        message.error('No database connection. Please connect to a database first.');
        return false;
      }

      // Reset sequence tracking
      lastSequenceRef.current = -1;

      // Restore todos from session
      if (session.todos.length > 0) {
        setAgentTodos(session.todos);
        addTodoMessage(session.todos);
      }

      addUserMessage('Resume session');
      startAgent(session.goal, MAX_STEPS);
      sessionIdRef.current = session.id;
      setActiveSessionId(session.id);

      try {
        const response = await fetch(`/api/agent-sessions/${session.id}/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schema: tables,
            model: selectedModel,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to resume session');
        }

        // Start polling for events
        startPolling(session.id, async (finalSql) => {
          sessionIdRef.current = null;

          const updatedSession = await fetch(`/api/agent-sessions/${session.id}`).then(r => r.json());
          const canContinue = updatedSession.status === 'PAUSED';

          if (canContinue) {
            pauseSession(session.id, '');
          } else {
            completeSessionStore(session.id, true);
          }

          if (finalSql && updatedSession.status === 'COMPLETED') {
            const result = await executeQuery(finalSql);
            if (result.success && result.result) {
              message.success(`Query ready (${result.result.executionTime}ms)`);
            }
          }
        });

        return true;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to resume session';
        addAssistantMessage({ content: '', error: errorMessage });
        completeAgent(false);
        sessionIdRef.current = null;
        setActiveSessionId(null);
        return false;
      }
    },
    [
      organizationId,
      tables,
      selectedModel,
      addUserMessage,
      addAssistantMessage,
      addTodoMessage,
      startAgent,
      completeAgent,
      setAgentTodos,
      pauseSession,
      completeSessionStore,
      executeQuery,
      message,
      startPolling,
    ]
  );

  // Reconnect to an active session (e.g., after page refresh)
  const reconnectToSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/agent-sessions/${sessionId}`);
        if (!response.ok) {
          return false;
        }

        const session = await response.json();

        if (session.status !== 'RUNNING') {
          return false;
        }

        // Reset and start polling from the beginning to catch all events
        lastSequenceRef.current = -1;
        setActiveSessionId(sessionId);
        sessionIdRef.current = sessionId;

        // Restore UI state
        startAgent(session.goal, MAX_STEPS);

        // Start polling
        startPolling(sessionId, async (finalSql) => {
          sessionIdRef.current = null;
          setActiveSessionId(null);

          if (finalSql && session.status === 'COMPLETED') {
            const result = await executeQuery(finalSql);
            if (result.success && result.result) {
              message.success(`Query ready (${result.result.executionTime}ms)`);
            }
          }
        });

        message.info('Reconnected to running agent session');
        return true;
      } catch (error) {
        console.error('Failed to reconnect:', error);
        return false;
      }
    },
    [startAgent, executeQuery, message, startPolling]
  );

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
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    startNewConversation();
    setCurrentQuery('');
    setActiveSessionId(null);
    sessionIdRef.current = null;
    lastSequenceRef.current = -1;
  }, [startNewConversation, setCurrentQuery]);

  // Load a conversation from a saved query's session
  const loadConversationFromSession = useCallback(async (sessionId: string): Promise<boolean> => {
    // First try local store
    let session = getSession(sessionId);

    // If not found locally, fetch from API
    if (!session) {
      try {
        const response = await fetch(`/api/agent-sessions/${sessionId}`);
        if (!response.ok) {
          message.warning('Session not found');
          return false;
        }
        const data = await response.json();
        // Map the API response to our session format
        // Note: data comes from result.session in the API response
        const sessionData = data.session || data;
        session = {
          id: sessionData.id,
          goal: sessionData.goal,
          status: (sessionData.status?.toLowerCase() || 'completed') as 'running' | 'paused' | 'completed' | 'failed',
          currentStep: sessionData.currentStep || 0,
          maxSteps: sessionData.maxSteps || 25,
          toolCalls: sessionData.toolCalls || [],
          todos: sessionData.todos || [],
          currentSql: sessionData.currentSql,
          previousSql: sessionData.previousSql,
          lastStreamingText: sessionData.lastStreamingText || '',
          lastError: sessionData.lastError,
          resumptionContext: sessionData.resumptionContext || '',
          chatHistory: sessionData.chatHistory || [],
          queryName: sessionData.queryName,
          createdAt: typeof sessionData.createdAt === 'number' ? sessionData.createdAt : new Date(sessionData.createdAt).getTime(),
          updatedAt: typeof sessionData.updatedAt === 'number' ? sessionData.updatedAt : new Date(sessionData.updatedAt).getTime(),
        };
      } catch (error) {
        console.error('Failed to fetch session:', error);
        message.warning('Failed to load session');
        return false;
      }
    }

    startNewConversation();

    // Check if we have chat history to display
    const hasChatHistory = session.chatHistory && session.chatHistory.length > 0;

    if (hasChatHistory) {
      // Use existing chat history
      session.chatHistory.forEach((msg) => {
        if (msg.role === 'user') {
          addUserMessage(msg.content);
        } else if (msg.role === 'assistant') {
          addAssistantMessage({
            content: msg.content,
            sql: msg.sql,
            explanation: msg.explanation,
            summary: msg.summary,
          });
        } else if (msg.role === 'system') {
          addSystemMessage(msg.content);
        }
      });
    } else {
      // Reconstruct chat from session data when chatHistory is empty
      // This handles sessions where chat wasn't persisted to the database

      // Add the original user goal as first message
      if (session.goal) {
        addUserMessage(session.goal);
      }

      // If we have a final SQL, show it as the assistant's response
      if (session.currentSql) {
        addAssistantMessage({
          content: session.queryName
            ? `Here's the query for "${session.queryName}":`
            : 'Here\'s the generated query:',
          sql: session.currentSql,
          explanation: session.queryName
            ? `Query generated for: ${session.goal}`
            : undefined,
        });
      }

      // If there was an error, show it
      if (session.lastError) {
        addSystemMessage(`Error: ${session.lastError}`);
      }

      // Show session status if it's not completed successfully
      if (session.status === 'paused') {
        addSystemMessage('Session was paused. You can continue from where it left off.');
      } else if (session.status === 'failed') {
        addSystemMessage('Session failed to complete.');
      }
    }

    if (session.todos && session.todos.length > 0) {
      setAgentTodos(session.todos);
      addTodoMessage(session.todos);
    }

    if (session.currentSql) {
      setCurrentQuery(session.currentSql);
      setCurrentSql(session.currentSql);
      setIsAiGenerated(true);
    }

    if (session.queryName) {
      setQueryName(session.queryName);
    }

    // Open the AI chat panel so the user can see the loaded session
    setOpen(true);

    message.success('Session loaded');
    return true;
  }, [getSession, startNewConversation, addUserMessage, addAssistantMessage, addSystemMessage, setAgentTodos, addTodoMessage, setCurrentQuery, setCurrentSql, setIsAiGenerated, setQueryName, setOpen, message]);

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
    // Session resumption
    resumeSession,
    resumableSessions: getResumableSessions(),
    // Load conversation from saved query
    loadConversationFromSession,
    // Persistent agent specific
    isConnected,
    activeSessionId,
    reconnectToSession,
  };
}
