'use client';

import { useState } from 'react';
import { App } from 'antd';
import { useConnectionStore } from '@/stores/connectionStore';
import { useQueryStore, QueryResult } from '@/stores/queryStore';

export function useQuery() {
  const { message } = App.useApp();
  const { connectionString } = useConnectionStore();
  const { setQueryResults, addToHistory, setIsExecuting } = useQueryStore();
  const [error, setError] = useState<string | null>(null);

  const executeQuery = async (sql: string) => {
    if (!connectionString) {
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
        body: JSON.stringify({ connectionString, sql }),
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
      addToHistory(sql, data.rowCount, data.executionTime);
      message.success(`Query executed successfully (${data.executionTime}ms)`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while executing the query';
      setError(errorMessage);
      message.error(errorMessage);
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
