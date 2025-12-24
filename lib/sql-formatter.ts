/**
 * Simple SQL formatter for basic SQL formatting.
 * Handles keyword casing and basic indentation.
 */

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL', 'CROSS', 'ON',
  'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'HAVING', 'LIMIT', 'OFFSET',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE',
  'ALTER', 'DROP', 'INDEX', 'UNIQUE', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
  'NULL', 'IS', 'AS', 'DISTINCT', 'ALL', 'UNION', 'INTERSECT', 'EXCEPT',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CAST', 'COALESCE', 'NULLIF',
  'EXISTS', 'ANY', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'WITH', 'RECURSIVE'
];

const NEWLINE_BEFORE = ['FROM', 'WHERE', 'AND', 'OR', 'ORDER', 'GROUP', 'HAVING', 'LIMIT', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'FULL'];

/**
 * Format SQL query with proper casing and basic line breaks
 */
export function formatSql(sql: string): string {
  if (!sql.trim()) return sql;

  // Preserve string literals and identifiers
  const stringLiterals: string[] = [];
  const identifiers: string[] = [];

  // Replace string literals with placeholders
  let formatted = sql.replace(/'([^']*)'/g, (match) => {
    stringLiterals.push(match);
    return `__STRING_LITERAL_${stringLiterals.length - 1}__`;
  });

  // Replace quoted identifiers with placeholders
  formatted = formatted.replace(/"([^"]*)"/g, (match) => {
    identifiers.push(match);
    return `__IDENTIFIER_${identifiers.length - 1}__`;
  });

  // Uppercase SQL keywords
  SQL_KEYWORDS.forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    formatted = formatted.replace(regex, keyword);
  });

  // Add newlines before major clauses
  NEWLINE_BEFORE.forEach((keyword) => {
    // Only add newline if not already preceded by newline
    const regex = new RegExp(`(?<!\\n)\\s+\\b(${keyword})\\b`, 'g');
    formatted = formatted.replace(regex, `\n$1`);
  });

  // Clean up multiple spaces
  formatted = formatted.replace(/[ \t]+/g, ' ');

  // Clean up multiple newlines
  formatted = formatted.replace(/\n\s*\n/g, '\n');

  // Restore string literals
  stringLiterals.forEach((literal, index) => {
    formatted = formatted.replace(`__STRING_LITERAL_${index}__`, literal);
  });

  // Restore identifiers
  identifiers.forEach((identifier, index) => {
    formatted = formatted.replace(`__IDENTIFIER_${index}__`, identifier);
  });

  // Add basic indentation for subqueries and wrapped lines
  const lines = formatted.split('\n');
  const indentedLines = lines.map((line, index) => {
    const trimmed = line.trim();
    if (index === 0) return trimmed;

    // Indent continuation of SELECT, FROM, etc.
    if (trimmed.startsWith('AND') || trimmed.startsWith('OR')) {
      return '  ' + trimmed;
    }

    return trimmed;
  });

  return indentedLines.join('\n').trim();
}

/**
 * Check if a SQL query needs formatting (has inconsistent casing or spacing)
 */
export function needsFormatting(sql: string): boolean {
  if (!sql.trim()) return false;

  // Check for lowercase keywords
  const hasLowercaseKeywords = SQL_KEYWORDS.some((keyword) => {
    const lowerKeyword = keyword.toLowerCase();
    const regex = new RegExp(`\\b${lowerKeyword}\\b`, 'i');
    const match = sql.match(regex);
    return match && match[0] !== keyword;
  });

  return hasLowercaseKeywords;
}
