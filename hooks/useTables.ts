'use client';

import { useState, useCallback } from 'react';
import { App } from 'antd';
import { useConnectionStore } from '@/stores/connectionStore';
import type { TableInfo } from '@/app/api/tables/route';

export interface TablesState {
  tables: TableInfo[];
  isLoading: boolean;
  error: string | null;
}

export function useTables() {
  const { message } = App.useApp();
  const { connectionString } = useConnectionStore();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTables = useCallback(async () => {
    if (!connectionString) {
      setError('No database connection');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tables');
      }

      setTables(data.tables);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching tables';
      setError(errorMessage);
      message.error(errorMessage);
      console.error('Tables fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [connectionString, message]);

  const refreshTables = useCallback(() => {
    fetchTables();
  }, [fetchTables]);

  return {
    tables,
    isLoading,
    error,
    fetchTables,
    refreshTables,
  };
}
