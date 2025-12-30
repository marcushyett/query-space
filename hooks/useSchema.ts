'use client';

import { useCallback, useEffect } from 'react';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSchemaStore } from '@/stores/schemaStore';
import type { SchemaResponse } from '@/app/api/schema/route';

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

export function useSchema() {
  const { organizationId } = useConnectionStore();
  const { tables, isLoading, error, lastFetched, setTables, setLoading, setError, reset } = useSchemaStore();

  const fetchSchema = useCallback(async (force = false) => {
    // Only require organizationId - connectionString is deprecated
    // The API endpoint fetches the connection string from organization settings
    if (!organizationId) {
      reset();
      return;
    }

    // Skip if we have recent data and not forcing refresh
    if (!force && lastFetched && Date.now() - lastFetched < CACHE_DURATION && tables.length > 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });

      const data: SchemaResponse = await response.json();

      if (!response.ok) {
        throw new Error((data as unknown as { error: string }).error || 'Failed to fetch schema');
      }

      setTables(data.tables);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching schema';
      setError(errorMessage);
      console.error('Schema fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, lastFetched, tables.length, setTables, setLoading, setError, reset]);

  // Fetch schema when organization changes
  useEffect(() => {
    if (organizationId) {
      fetchSchema();
    } else {
      reset();
    }
  }, [organizationId, fetchSchema, reset]);

  return {
    tables,
    isLoading,
    error,
    fetchSchema,
    refreshSchema: () => fetchSchema(true),
  };
}
