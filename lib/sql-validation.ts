export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

const DANGEROUS_KEYWORDS = [
  'DROP',
  'DELETE',
  'UPDATE',
  'INSERT',
  'TRUNCATE',
  'ALTER',
  'CREATE',
  'GRANT',
  'REVOKE',
];

export function validateSql(sql: string): ValidationResult {
  if (!sql || sql.trim().length === 0) {
    return {
      valid: false,
      error: 'SQL query cannot be empty',
    };
  }

  const upperSql = sql.toUpperCase();

  // Check for dangerous operations
  for (const keyword of DANGEROUS_KEYWORDS) {
    if (upperSql.includes(keyword)) {
      return {
        valid: true,
        warning: `Warning: Query contains ${keyword} operation. Ensure you have proper permissions and understand the impact.`,
      };
    }
  }

  // Basic check for SQL injection patterns
  const suspiciousPatterns = [
    /;\s*DROP/i,
    /;\s*DELETE/i,
    /UNION\s+SELECT/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sql)) {
      return {
        valid: false,
        error: 'Potentially dangerous SQL pattern detected',
      };
    }
  }

  return { valid: true };
}
