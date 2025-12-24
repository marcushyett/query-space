'use client';

import { useState, useCallback } from 'react';
import { message } from 'antd';
import { useConnectionStore } from '@/stores/connectionStore';
import type { TableInfoResponse, ColumnInfo, IndexInfo } from '@/app/api/table-info/route';

export interface TableInfoState {
  tableInfo: TableInfoResponse | null;
  isLoading: boolean;
  error: string | null;
}

export function useTableInfo() {
  const { connectionString } = useConnectionStore();
  const [tableInfo, setTableInfo] = useState<TableInfoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTableInfo = useCallback(async (schema: string, table: string) => {
    if (!connectionString) {
      setError('No database connection');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/table-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString, schema, table }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch table info');
      }

      setTableInfo(data);
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred while fetching table info';
      setError(errorMessage);
      message.error(errorMessage);
      console.error('Table info fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [connectionString]);

  const clearTableInfo = useCallback(() => {
    setTableInfo(null);
    setError(null);
  }, []);

  return {
    tableInfo,
    isLoading,
    error,
    fetchTableInfo,
    clearTableInfo,
  };
}

export type { ColumnInfo, IndexInfo, TableInfoResponse };
