/**
 * Default limit to add to queries without an explicit LIMIT clause
 */
export const DEFAULT_LIMIT = 1000;

/**
 * Check if a SQL query has a LIMIT clause
 * Handles common cases including CTEs, subqueries, and various SQL patterns
 */
export function hasLimitClause(sql: string): boolean {
  // Remove comments and string literals to avoid false matches
  const cleanedSql = sql
    .replace(/--[^\n]*/g, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .replace(/'[^']*'/g, "''") // Replace string literals
    .replace(/"[^"]*"/g, '""'); // Replace quoted identifiers

  // Check for LIMIT keyword followed by a number or placeholder
  // Must be at the "top level" (not inside parentheses indicating a subquery)
  // We look for LIMIT at the end of the query or before ORDER BY, OFFSET, FOR UPDATE, etc.
  const limitPattern = /\bLIMIT\s+(\d+|ALL|\$\d+|\?)/i;

  // First check if there's any LIMIT in the query
  if (!limitPattern.test(cleanedSql)) {
    return false;
  }

  // Now we need to check if it's the outermost LIMIT
  // Count parentheses to find if LIMIT appears at level 0
  let depth = 0;
  const tokens = cleanedSql.split(/(\(|\)|\bLIMIT\b)/i);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '(') {
      depth++;
    } else if (token === ')') {
      depth--;
    } else if (token.toUpperCase() === 'LIMIT' && depth === 0) {
      // Found LIMIT at top level
      return true;
    }
  }

  return false;
}

/**
 * Add a LIMIT clause to a SQL query if one doesn't exist
 * Returns the original query if LIMIT is already present
 */
export function addDefaultLimit(sql: string, limit: number = DEFAULT_LIMIT): { sql: string; limitAdded: boolean } {
  const trimmedSql = sql.trim();

  // Skip non-SELECT queries
  if (!isSelectQuery(trimmedSql)) {
    return { sql: trimmedSql, limitAdded: false };
  }

  // Check if already has a limit
  if (hasLimitClause(trimmedSql)) {
    return { sql: trimmedSql, limitAdded: false };
  }

  // Remove trailing semicolon if present
  const sqlWithoutSemicolon = trimmedSql.replace(/;\s*$/, '');

  // Add LIMIT clause
  const newSql = `${sqlWithoutSemicolon} LIMIT ${limit}`;

  return { sql: newSql, limitAdded: true };
}

/**
 * Check if a SQL statement is a SELECT query
 * Handles CTEs (WITH clauses) as well
 */
export function isSelectQuery(sql: string): boolean {
  const cleanedSql = sql
    .replace(/--[^\n]*/g, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
    .trim();

  // Check if it starts with SELECT or WITH (CTE)
  return /^(WITH\s+|SELECT\s+)/i.test(cleanedSql);
}
