'use client';

import { useState, useEffect, useCallback, RefObject } from 'react';

interface Dimensions {
  width: number;
  height: number;
}

/**
 * Hook to get dimensions of a container element
 * Used for custom SVG charts that need responsive sizing
 */
export function useDimensions(ref: RefObject<HTMLElement | null>): Dimensions {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });

  const updateDimensions = useCallback(() => {
    if (ref.current) {
      const { width, height } = ref.current.getBoundingClientRect();
      setDimensions({ width, height });
    }
  }, [ref]);

  useEffect(() => {
    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (ref.current) {
      resizeObserver.observe(ref.current);
    }

    return () => resizeObserver.disconnect();
  }, [ref, updateDimensions]);

  return dimensions;
}
