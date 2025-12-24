import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUrlState } from '../useUrlState';
import { encodeQuery } from '@/lib/url-state';

// Mock useQueryStore
const mockSetCurrentQuery = vi.fn();
const mockCurrentQuery = { value: '' };

vi.mock('@/stores/queryStore', () => ({
  useQueryStore: () => ({
    currentQuery: mockCurrentQuery.value,
    setCurrentQuery: mockSetCurrentQuery,
  }),
}));

describe('useUrlState', () => {
  let originalLocation: Location;
  let mockSearch = '';

  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentQuery.value = '';
    mockSearch = '';

    // Save original location
    originalLocation = window.location;

    // Mock window.location using Object.defineProperty
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        get search() {
          return mockSearch;
        },
        set search(value: string) {
          mockSearch = value;
        },
        href: 'http://localhost:3000',
      },
      writable: true,
      configurable: true,
    });

    // Mock history.replaceState
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('should load query from URL on mount', () => {
    const query = 'SELECT * FROM users';
    const encoded = encodeQuery(query);
    mockSearch = `?q=${encoded}`;

    renderHook(() => useUrlState());

    expect(mockSetCurrentQuery).toHaveBeenCalledWith(query);
  });

  it('should not set query if URL has no query param', () => {
    mockSearch = '';

    renderHook(() => useUrlState());

    expect(mockSetCurrentQuery).not.toHaveBeenCalled();
  });

  it('should not set query if URL has invalid encoded query', () => {
    mockSearch = '?q=invalid!!!';

    renderHook(() => useUrlState());

    expect(mockSetCurrentQuery).not.toHaveBeenCalled();
  });

  it('should update URL when query changes', async () => {
    vi.useFakeTimers();

    mockCurrentQuery.value = 'SELECT * FROM orders';

    const { rerender } = renderHook(() => useUrlState());

    // Trigger the debounced update
    act(() => {
      vi.advanceTimersByTime(500);
    });

    rerender();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(window.history.replaceState).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
