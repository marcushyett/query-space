'use client';

import { useCallback, useRef } from 'react';
import { App } from 'antd';
import { useConnectionStore } from '@/stores/connectionStore';
import { useAiStore } from '@/stores/aiStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { useAiChatStore } from '@/stores/aiChatStore';
import { useQueryStore, QueryResult } from '@/stores/queryStore';

interface TableSample {
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
  jsonFieldSamples?: Record<string, unknown[]>;
}

interface AiQueryResponse {
  sql?: string;
  explanation?: string;
  changes?: string[];
  error?: string;
  validation?: {
    isValid: boolean;
    issues?: string[];
    suggestions?: string[];
  };
  debugInfo?: {
    needsMoreData: boolean;
    suggestedQueries?: string[];
    diagnosis?: string;
  };
  // For clarification and goal confirmation
  clarifyingQuestions?: string[];
  goalSummary?: string;
  needsClarification?: boolean;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface QueryResultInfo {
  rowCount: number;
  executionTime: number;
  sampleRows?: Record<string, unknown>[];
  emptyColumns?: string[];
  error?: string;
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

  // Track auto-fix/debug attempts to prevent infinite loops
  const autoFixAttemptRef = useRef(0);
  const maxAutoFixAttempts = 3;

  // Helper to check if SQL is a SELECT query (safe to auto-run)
  const isSelectQuery = useCallback((sql: string): boolean => {
    const trimmed = sql.trim().toUpperCase();
    return trimmed.startsWith('SELECT') ||
           trimmed.startsWith('WITH') ||
           trimmed.startsWith('EXPLAIN');
  }, []);

  // Fetch sample data for tables with JSON fields
  const fetchSampleData = useCallback(async (): Promise<TableSample[]> => {
    if (!connectionString || !tables || tables.length === 0) return [];

    // Find tables with JSON/JSONB columns
    const tablesWithJson = tables.filter(t =>
      t.columns.some(c => c.type === 'json' || c.type === 'jsonb')
    );

    // Limit to first 5 tables with JSON for context size
    const tablesToSample = tablesWithJson.slice(0, 5).map(t =>
      t.schema === 'public' ? `"${t.name}"` : `"${t.schema}"."${t.name}"`
    );

    if (tablesToSample.length === 0) return [];

    try {
      const response = await fetch('/api/sample-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString,
          tables: tablesToSample,
          sampleSize: 3,
        }),
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.samples || [];
    } catch (error) {
      console.error('Error fetching sample data:', error);
      return [];
    }
  }, [connectionString, tables]);

  // Analyze query results for issues
  const analyzeQueryResult = useCallback((result: QueryResult): QueryResultInfo => {
    const info: QueryResultInfo = {
      rowCount: result.rowCount,
      executionTime: result.executionTime,
    };

    if (result.rows && result.rows.length > 0) {
      // Sample first 3 rows for context
      info.sampleRows = result.rows.slice(0, 3);

      // Find columns that are all NULL
      const emptyColumns: string[] = [];
      for (const field of result.fields) {
        const allNull = result.rows.every(row => row[field.name] === null);
        if (allNull) {
          emptyColumns.push(field.name);
        }
      }
      if (emptyColumns.length > 0) {
        info.emptyColumns = emptyColumns;
      }
    }

    return info;
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

  // Validate query results with AI and fix if issues found
  const validateResults = useCallback(
    async (sql: string, result: QueryResult, sampleData?: TableSample[]): Promise<boolean> => {
      const resultInfo = analyzeQueryResult(result);

      // Build conversation history for API
      const conversationHistory: ConversationMessage[] = messages.map((msg) => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.role === 'assistant'
          ? JSON.stringify({ sql: msg.sql, explanation: msg.explanation })
          : msg.content,
      }));

      try {
        const response = await fetch('/api/ai-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: 'Validate these query results and fix any issues found (like empty columns).',
            apiKey,
            schema: tables,
            sampleData,
            conversationHistory,
            currentSql: sql,
            queryResult: resultInfo,
            mode: 'validate',
          }),
        });

        const data: AiQueryResponse = await response.json();

        if (data.validation) {
          if (data.validation.isValid) {
            // Results look good - add a positive message with sample results
            addSystemMessage(
              `${result.rowCount} rows returned. ${data.explanation || 'Results look correct.'}`,
              {
                rowCount: result.rowCount,
                executionTime: result.executionTime,
                sampleResults: result.rows.slice(0, 3),
              }
            );
            return true;
          } else if (data.validation.issues && data.validation.issues.length > 0) {
            // There are issues - check if AI provided a fix
            if (data.sql && data.sql !== sql) {
              // AI provided a fixed query - apply it
              addSystemMessage(
                `⚠️ Found issues: ${data.validation.issues.join('. ')}. Attempting to fix...`,
                { rowCount: result.rowCount, executionTime: result.executionTime }
              );

              const previousSql = sql;
              addAssistantMessage({
                content: data.explanation || 'Fixed the query based on result analysis.',
                sql: data.sql,
                previousSql,
                explanation: data.explanation,
                isAutoFix: true,
              });

              setCurrentQuery(data.sql);

              // Execute the fixed query
              if (isSelectQuery(data.sql)) {
                const fixedResult = await executeQueryInternal(data.sql);
                if (fixedResult.success && fixedResult.result) {
                  if (fixedResult.result.rowCount > 0) {
                    addSystemMessage(
                      `Query fixed! ${fixedResult.result.rowCount} rows returned.`,
                      {
                        rowCount: fixedResult.result.rowCount,
                        executionTime: fixedResult.result.executionTime,
                        sampleResults: fixedResult.result.rows.slice(0, 3),
                      }
                    );
                    message.success(`Query fixed (${fixedResult.result.executionTime}ms)`);
                    return true;
                  } else {
                    // Fixed query still returns no rows
                    addSystemMessage(
                      `Fixed query still returned no rows.`,
                      { rowCount: 0, executionTime: fixedResult.result.executionTime }
                    );
                    return false;
                  }
                } else if (fixedResult.error) {
                  addSystemMessage(`Fixed query error: ${fixedResult.error}`);
                  return false;
                }
              }
            } else {
              // No fix provided - just report the issues
              addSystemMessage(
                `${result.rowCount} rows returned. ⚠️ ${data.validation.issues.join('. ')}`,
                { rowCount: result.rowCount, executionTime: result.executionTime }
              );
            }
            return false;
          }
        }

        // Fallback to simple message
        addSystemMessage(
          `Query executed successfully`,
          { rowCount: result.rowCount, executionTime: result.executionTime }
        );
        return true;
      } catch {
        // On validation error, just show basic success message
        addSystemMessage(
          `Query executed successfully`,
          { rowCount: result.rowCount, executionTime: result.executionTime }
        );
        return true;
      }
    },
    [apiKey, tables, messages, analyzeQueryResult, addSystemMessage, addAssistantMessage, setCurrentQuery, isSelectQuery, executeQueryInternal, message]
  );

  // Debug query when no rows returned
  const debugNoRows = useCallback(
    async (sql: string, sampleData: TableSample[]): Promise<boolean> => {
      if (autoFixAttemptRef.current >= maxAutoFixAttempts) {
        addSystemMessage(`Auto-debug limit reached. The query may need manual adjustment based on your data.`);
        autoFixAttemptRef.current = 0;
        return false;
      }

      autoFixAttemptRef.current++;
      addSystemMessage(`No rows returned. Analyzing query to find the issue...`);

      const conversationHistory: ConversationMessage[] = messages.map((msg) => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.role === 'assistant'
          ? JSON.stringify({ sql: msg.sql, explanation: msg.explanation })
          : msg.content,
      }));

      setIsGenerating(true);

      try {
        const response = await fetch('/api/ai-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: 'The query returned no rows. Please analyze and fix the query. Check JOIN conditions, WHERE clauses, and JSON field access.',
            apiKey,
            schema: tables,
            sampleData,
            conversationHistory,
            currentSql: sql,
            queryResult: { rowCount: 0, executionTime: 0 },
            mode: 'debug',
            isDebugMode: true,
          }),
        });

        const data: AiQueryResponse = await response.json();

        if (!response.ok || !data.sql) {
          addAssistantMessage({
            content: '',
            error: data.error || 'Failed to debug the query',
            isAutoFix: true,
          });
          return false;
        }

        // Check if AI needs to run diagnostic queries
        if (data.debugInfo?.needsMoreData && data.debugInfo.suggestedQueries) {
          // Run diagnostic queries to gather more information
          const diagnosticResults: string[] = [];
          for (const diagQuery of data.debugInfo.suggestedQueries.slice(0, 3)) {
            try {
              const diagResult = await executeQueryInternal(diagQuery);
              if (diagResult.success && diagResult.result) {
                diagnosticResults.push(
                  `Query: ${diagQuery}\nRows: ${diagResult.result.rowCount}`
                );
              }
            } catch {
              // Ignore diagnostic query failures
            }
          }

          // If we got diagnostic results, try again with that context
          if (diagnosticResults.length > 0) {
            addSystemMessage(`Running diagnostic queries to understand the data...`);
            // Could recursively debug here with diagnostic results
          }
        }

        const previousSql = sql;
        addAssistantMessage({
          content: data.debugInfo?.diagnosis || data.explanation || 'Adjusted the query based on data analysis.',
          sql: data.sql,
          previousSql,
          explanation: data.explanation,
          isAutoFix: true,
        });

        setCurrentQuery(data.sql);

        // Try to run the fixed query
        if (isSelectQuery(data.sql)) {
          const result = await executeQueryInternal(data.sql);
          if (result.success && result.result) {
            if (result.result.rowCount > 0) {
              await validateResults(data.sql, result.result, sampleData);
              message.success(`Query fixed! ${result.result.rowCount} rows returned.`);
              autoFixAttemptRef.current = 0;
              return true;
            } else {
              // Still no rows, try debugging again if we haven't hit the limit
              return debugNoRows(data.sql, sampleData);
            }
          } else if (result.error) {
            addSystemMessage(`Query still has an error: ${result.error}`);
            // Try to fix the error
            return autoFixQuery(data.sql, result.error, sampleData);
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
      validateResults,
      message,
    ]
  );

  // Auto-fix a query error
  const autoFixQuery = useCallback(
    async (sql: string, error: string, sampleData?: TableSample[]): Promise<boolean> => {
      if (autoFixAttemptRef.current >= maxAutoFixAttempts) {
        addSystemMessage(`Auto-fix limit reached. Please review the error and try a different approach.`);
        autoFixAttemptRef.current = 0;
        return false;
      }

      autoFixAttemptRef.current++;

      const conversationHistory: ConversationMessage[] = messages.map((msg) => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.role === 'assistant'
          ? JSON.stringify({ sql: msg.sql, explanation: msg.explanation })
          : msg.content,
      }));

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
            sampleData,
            conversationHistory,
            currentSql: sql,
            isAutoFix: true,
            queryResult: { rowCount: 0, executionTime: 0, error },
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

        setCurrentQuery(data.sql);

        // Try to run the fixed query
        if (isSelectQuery(data.sql)) {
          const result = await executeQueryInternal(data.sql);
          if (result.success && result.result) {
            if (result.result.rowCount > 0) {
              await validateResults(data.sql, result.result, sampleData);
            } else {
              addSystemMessage(
                `Query executed but returned no rows.`,
                { rowCount: 0, executionTime: result.result.executionTime }
              );
              // Auto-debug empty results
              return debugNoRows(data.sql, sampleData || []);
            }
            message.success(`Query fixed and executed (${result.result.executionTime}ms)`);
            autoFixAttemptRef.current = 0;
            return true;
          } else if (result.error) {
            addSystemMessage(`Query still has an error: ${result.error}`);
            return autoFixQuery(data.sql, result.error, sampleData);
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
      validateResults,
      debugNoRows,
      message,
    ]
  );

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

      // Reset auto-fix counter for new user messages
      autoFixAttemptRef.current = 0;

      addUserMessage(prompt);
      setIsGenerating(true);

      try {
        // Fetch sample data for JSON fields
        const sampleData = await fetchSampleData();

        // Build conversation history
        const conversationHistory: ConversationMessage[] = messages.map((msg) => ({
          role: msg.role === 'system' ? 'user' : msg.role,
          content: msg.role === 'assistant'
            ? JSON.stringify({ sql: msg.sql, explanation: msg.explanation })
            : msg.content,
        }));

        const response = await fetch('/api/ai-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            apiKey,
            schema: tables,
            sampleData,
            conversationHistory,
            currentSql,
            mode: 'generate',
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

        // Handle clarification requests
        if (data.needsClarification && data.clarifyingQuestions && data.clarifyingQuestions.length > 0) {
          addAssistantMessage({
            content: data.explanation || 'I need more information to generate the right query.',
            clarifyingQuestions: data.clarifyingQuestions,
            goalSummary: data.goalSummary,
            needsClarification: true,
          });
          return true;
        }

        if (data.sql) {
          const previousSql = currentSql;
          addAssistantMessage({
            content: data.explanation || '',
            sql: data.sql,
            previousSql: previousSql || undefined,
            explanation: data.explanation,
            goalSummary: data.goalSummary,
            clarifyingQuestions: data.clarifyingQuestions,
          });

          setCurrentQuery(data.sql);
          setIsGenerating(false);

          // Auto-run SELECT queries
          if (isSelectQuery(data.sql)) {
            const result = await executeQueryInternal(data.sql);
            if (result.success && result.result) {
              if (result.result.rowCount > 0) {
                // Validate results with AI
                await validateResults(data.sql, result.result, sampleData);
              } else {
                // No rows returned - auto-debug
                addSystemMessage(
                  `Query executed but returned no rows.`,
                  { rowCount: 0, executionTime: result.result.executionTime }
                );
                await debugNoRows(data.sql, sampleData);
              }
              message.success(`Query executed (${result.result.executionTime}ms)`);
            } else if (result.error) {
              addSystemMessage(`Query error: ${result.error}`);
              await autoFixQuery(data.sql, result.error, sampleData);
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
      validateResults,
      autoFixQuery,
      debugNoRows,
      fetchSampleData,
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
        if (result.result.rowCount > 0) {
          // For manual runs, also validate if AI-generated
          if (isAiGenerated) {
            const sampleData = await fetchSampleData();
            await validateResults(queryToRun, result.result, sampleData);
          } else {
            addSystemMessage(
              `Query executed successfully`,
              {
                rowCount: result.result.rowCount,
                executionTime: result.result.executionTime,
                sampleResults: result.result.rows.slice(0, 3),
              }
            );
          }
        } else {
          addSystemMessage(
            `Query executed but returned no rows.`,
            { rowCount: 0, executionTime: result.result.executionTime }
          );
        }
        message.success(`Query executed (${result.result.executionTime}ms)`);
        return true;
      } else if (result.error) {
        addSystemMessage(`Query error: ${result.error}`);

        // Auto-fix if this was an AI-generated query
        if (isAiGenerated) {
          const sampleData = await fetchSampleData();
          await autoFixQuery(queryToRun, result.error, sampleData);
        } else {
          message.error(result.error);
        }
        return false;
      }

      return false;
    },
    [currentSql, isAiGenerated, executeQueryInternal, addSystemMessage, autoFixQuery, validateResults, fetchSampleData, message]
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
