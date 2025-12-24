'use client';

import { useEffect, useRef } from 'react';
import { useQueryStore } from '@/stores/queryStore';
import { encodeQuery, decodeQuery } from '@/lib/url-state';

const DEBOUNCE_DELAY = 500;

/**
 * Hook to sync query state with URL parameters
 * - Loads query from URL on mount
 * - Updates URL when query changes (debounced)
 */
export function useUrlState() {
  const { currentQuery, setCurrentQuery } = useQueryStore();
  const isInitialLoad = useRef(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load query from URL on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);
    const encoded = searchParams.get('q');

    if (encoded) {
      const decoded = decodeQuery(encoded);
      if (decoded) {
        setCurrentQuery(decoded);
      }
    }

    isInitialLoad.current = false;
  }, [setCurrentQuery]);

  // Update URL when query changes (debounced)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isInitialLoad.current) return;

    // Clear existing timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the URL update
    debounceRef.current = setTimeout(() => {
      const url = new URL(window.location.href);

      if (currentQuery.trim()) {
        const encoded = encodeQuery(currentQuery);
        url.searchParams.set('q', encoded);
      } else {
        url.searchParams.delete('q');
      }

      // Update URL without navigation
      window.history.replaceState({}, '', url.toString());
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [currentQuery]);
}
