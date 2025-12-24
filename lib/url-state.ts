/**
 * URL state utilities for encoding/decoding SQL queries in URL parameters
 */

/**
 * Encode a SQL query to a URL-safe base64 string
 */
export function encodeQuery(query: string): string {
  if (!query) return '';

  try {
    // Use btoa with UTF-8 encoding to handle special characters
    const utf8Bytes = new TextEncoder().encode(query);
    const binaryString = Array.from(utf8Bytes, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binaryString);
  } catch {
    return '';
  }
}

/**
 * Decode a base64 encoded SQL query
 * Returns null if decoding fails
 */
export function decodeQuery(encoded: string | null | undefined): string | null {
  if (!encoded) return encoded === '' ? '' : null;

  try {
    // Decode base64 and convert back to UTF-8
    const binaryString = atob(encoded);
    const utf8Bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(utf8Bytes);
  } catch {
    return null;
  }
}

/**
 * Check if a string is a valid encoded query
 */
export function isValidEncodedQuery(encoded: string | null | undefined): boolean {
  if (!encoded) return false;

  // Check if it's valid base64
  try {
    const binaryString = atob(encoded);
    // Check if we can decode it back to a string
    const utf8Bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0));
    new TextDecoder().decode(utf8Bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a URL with the encoded query parameter
 */
export function buildQueryUrl(baseUrl: string, query: string): string {
  if (!query) return baseUrl;

  const encoded = encodeQuery(query);
  if (!encoded) return baseUrl;

  const url = new URL(baseUrl);
  url.searchParams.set('q', encoded);
  return url.toString();
}

/**
 * Extract and decode query from URL search params
 */
export function getQueryFromUrl(searchParams: URLSearchParams): string | null {
  const encoded = searchParams.get('q');
  if (!encoded) return null;
  return decodeQuery(encoded);
}
