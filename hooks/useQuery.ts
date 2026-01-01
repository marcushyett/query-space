'use client';

import { useState } from 'react';
import { App } from 'antd';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore, QueryResult, saveQueryExecution } from '@/stores/queryStore';

export function useQuery() {
  const { message } = App.useApp();
  const { organizationId } = useConnectionStore();
  const { setQueryResults, addToHistory, setIsExecuting } = useQueryStore();
  const [error, setError] = useState<string | null>(null);

  const executeQuery = async (sql: string) => {
    // Only require organizationId - connectionString is deprecated
    if (!organizationId) {
      message.error('No database connection. Please connect to a database first.');
      return;
    }

    if (!sql.trim()) {
      message.warning('Please enter a SQL query');
      return;
    }

    setError(null);
    setIsExecuting(true);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, sql }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Query execution failed');
      }

      // Show warning if present
      if (data.warning) {
        message.warning(data.warning);
      }

      // Update results
      const result: QueryResult = {
        rows: data.rows,
        fields: data.fields,
        rowCount: data.rowCount,
        executionTime: data.executionTime,
      };

      setQueryResults(result);

      // Save to database and add to local state
      try {
        const savedQuery = await saveQueryExecution({
          organizationId,
          sql,
          source: 'MANUAL',
          success: true,
          rowCount: data.rowCount,
          executionTime: data.executionTime,
        });
        addToHistory(savedQuery);
      } catch (saveError) {
        // Log but don't fail the query execution
        console.error('Failed to save query execution:', saveError);
      }

      message.success(`Query executed successfully (${data.executionTime}ms)`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while executing the query';
      setError(errorMessage);
      message.error(errorMessage);

      // Save failed query to database
      try {
        const savedQuery = await saveQueryExecution({
          organizationId,
          sql,
          source: 'MANUAL',
          success: false,
          error: errorMessage,
        });
        addToHistory(savedQuery);
      } catch (saveError) {
        console.error('Failed to save query execution:', saveError);
      }

      console.error('Query execution error:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  return {
    executeQuery,
    error,
  };
}
