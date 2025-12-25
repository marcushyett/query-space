'use client';

import { useState, useCallback } from 'react';
import { App } from 'antd';
import { useConnectionStore } from '@/stores/connectionStore';
import { useAiStore } from '@/stores/aiStore';
import { useSchemaStore } from '@/stores/schemaStore';

interface AiQueryResponse {
  sql?: string;
  error?: string;
}

export function useAiQuery() {
  const { message } = App.useApp();
  const connectionString = useConnectionStore((state) => state.connectionString);
  const apiKey = useAiStore((state) => state.apiKey);
  const tables = useSchemaStore((state) => state.tables);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQuery = useCallback(
    async (prompt: string): Promise<string | null> => {
      // Validation
      if (!connectionString) {
        message.error('No database connection. Please connect to a database first.');
        return null;
      }

      if (!apiKey || apiKey.length === 0) {
        message.error('Please enter your Claude API key');
        return null;
      }

      if (!prompt.trim()) {
        message.warning('Please enter a prompt describing your query');
        return null;
      }

      setIsGenerating(true);
      setError(null);

      try {
        const response = await fetch('/api/ai-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            apiKey,
            schema: tables,
          }),
        });

        const data: AiQueryResponse = await response.json();

        if (!response.ok) {
          const errorMessage = data.error || 'Failed to generate query';
          setError(errorMessage);
          message.error(errorMessage);
          return null;
        }

        if (data.sql) {
          message.success('Query generated successfully');
          return data.sql;
        }

        const errorMessage = 'No SQL returned from AI';
        setError(errorMessage);
        message.error(errorMessage);
        return null;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred while generating query';
        setError(errorMessage);
        message.error(errorMessage);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [connectionString, apiKey, tables, message]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    generateQuery,
    isGenerating,
    error,
    clearError,
  };
}
