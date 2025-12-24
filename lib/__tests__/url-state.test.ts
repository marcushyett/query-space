import { describe, it, expect } from 'vitest';
import { encodeQuery, decodeQuery, isValidEncodedQuery } from '../url-state';

describe('url-state', () => {
  describe('encodeQuery', () => {
    it('should encode a simple SQL query', () => {
      const query = 'SELECT * FROM users';
      const encoded = encodeQuery(query);
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
    });

    it('should return base64 encoded string', () => {
      const query = 'SELECT * FROM users';
      const encoded = encodeQuery(query);
      // Base64 should only contain these characters
      expect(encoded).toMatch(/^[A-Za-z0-9+/=]*$/);
    });

    it('should handle empty string', () => {
      const encoded = encodeQuery('');
      expect(encoded).toBe('');
    });

    it('should handle special characters in SQL', () => {
      const query = "SELECT * FROM users WHERE name = 'O''Brien'";
      const encoded = encodeQuery(query);
      expect(encoded).toBeTruthy();
    });

    it('should handle multiline queries', () => {
      const query = `SELECT
        id,
        name
      FROM users
      WHERE active = true`;
      const encoded = encodeQuery(query);
      expect(encoded).toBeTruthy();
    });

    it('should handle unicode characters', () => {
      const query = "SELECT * FROM users WHERE name = 'Muller'";
      const encoded = encodeQuery(query);
      expect(encoded).toBeTruthy();
    });
  });

  describe('decodeQuery', () => {
    it('should decode an encoded query', () => {
      const original = 'SELECT * FROM users';
      const encoded = encodeQuery(original);
      const decoded = decodeQuery(encoded);
      expect(decoded).toBe(original);
    });

    it('should handle empty string', () => {
      const decoded = decodeQuery('');
      expect(decoded).toBe('');
    });

    it('should return null for invalid base64', () => {
      const decoded = decodeQuery('not-valid-base64!!!');
      expect(decoded).toBeNull();
    });

    it('should preserve special characters', () => {
      const original = "SELECT * FROM users WHERE name = 'O''Brien'";
      const encoded = encodeQuery(original);
      const decoded = decodeQuery(encoded);
      expect(decoded).toBe(original);
    });

    it('should preserve multiline queries', () => {
      const original = `SELECT
        id,
        name
      FROM users`;
      const encoded = encodeQuery(original);
      const decoded = decodeQuery(encoded);
      expect(decoded).toBe(original);
    });

    it('should return null for null input', () => {
      const decoded = decodeQuery(null as unknown as string);
      expect(decoded).toBeNull();
    });

    it('should return null for undefined input', () => {
      const decoded = decodeQuery(undefined as unknown as string);
      expect(decoded).toBeNull();
    });
  });

  describe('isValidEncodedQuery', () => {
    it('should return true for valid encoded query', () => {
      const query = 'SELECT * FROM users';
      const encoded = encodeQuery(query);
      expect(isValidEncodedQuery(encoded)).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isValidEncodedQuery('')).toBe(false);
    });

    it('should return false for invalid base64', () => {
      expect(isValidEncodedQuery('not-valid!!!')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidEncodedQuery(null as unknown as string)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidEncodedQuery(undefined as unknown as string)).toBe(false);
    });
  });

  describe('round-trip encoding', () => {
    const testCases = [
      'SELECT * FROM users',
      'SELECT id, name FROM users WHERE id = 1',
      "SELECT * FROM users WHERE name LIKE '%test%'",
      'SELECT COUNT(*) as count FROM orders GROUP BY status',
      `SELECT
        u.id,
        u.name,
        COUNT(o.id) as order_count
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id
      GROUP BY u.id, u.name
      ORDER BY order_count DESC
      LIMIT 10`,
    ];

    testCases.forEach((query, index) => {
      it(`should correctly round-trip test case ${index + 1}`, () => {
        const encoded = encodeQuery(query);
        const decoded = decodeQuery(encoded);
        expect(decoded).toBe(query);
      });
    });
  });
});
