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

export interface LintError {
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Lint SQL query for common errors before execution
 */
export function lintSql(sql: string): LintError[] {
  const errors: LintError[] = [];
  const trimmed = sql.trim();

  if (!trimmed) {
    errors.push({ message: 'Query is empty', severity: 'error' });
    return errors;
  }

  // Remove string literals and quoted identifiers for analysis
  const cleanedSql = trimmed
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""');

  // Check for unclosed parentheses
  const openParens = (cleanedSql.match(/\(/g) || []).length;
  const closeParens = (cleanedSql.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push({
      message: `Mismatched parentheses: ${openParens} opening, ${closeParens} closing`,
      severity: 'error'
    });
  }

  // Check for unclosed quotes (simple check)
  const singleQuotes = (trimmed.match(/'/g) || []).length;
  if (singleQuotes % 2 !== 0) {
    errors.push({ message: 'Unclosed string literal (single quote)', severity: 'error' });
  }

  const doubleQuotes = (trimmed.match(/"/g) || []).length;
  if (doubleQuotes % 2 !== 0) {
    errors.push({ message: 'Unclosed identifier (double quote)', severity: 'error' });
  }

  // Check for SELECT without FROM (except for simple expressions)
  const hasSelect = /\bSELECT\b/i.test(cleanedSql);
  const hasFrom = /\bFROM\b/i.test(cleanedSql);
  const isSimpleExpression = /^\s*SELECT\s+[\d\s+\-*\/().,'"]+;?\s*$/i.test(trimmed);
  const hasFunction = /\bSELECT\s+\w+\s*\(/i.test(cleanedSql); // e.g., SELECT NOW()

  if (hasSelect && !hasFrom && !isSimpleExpression && !hasFunction) {
    // Check if it's a function call like SELECT NOW() or SELECT 1+1
    if (!/^\s*SELECT\s+(\w+\s*\(|[\d])/i.test(trimmed)) {
      errors.push({
        message: 'SELECT statement appears to be missing FROM clause',
        severity: 'warning'
      });
    }
  }

  // Check for trailing comma in SELECT
  if (/SELECT[^]*,\s*FROM/i.test(cleanedSql)) {
    errors.push({
      message: 'Trailing comma before FROM clause',
      severity: 'error'
    });
  }

  // Check for common typos
  if (/\bFROM\s+WHERE\b/i.test(cleanedSql)) {
    errors.push({ message: 'Missing table name between FROM and WHERE', severity: 'error' });
  }

  if (/\bWHERE\s+AND\b/i.test(cleanedSql)) {
    errors.push({ message: 'Missing condition after WHERE (found AND immediately)', severity: 'error' });
  }

  if (/\bWHERE\s+OR\b/i.test(cleanedSql)) {
    errors.push({ message: 'Missing condition after WHERE (found OR immediately)', severity: 'error' });
  }

  // Check for GROUP BY without aggregate
  const hasGroupBy = /\bGROUP\s+BY\b/i.test(cleanedSql);
  const hasAggregate = /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(cleanedSql);
  if (hasGroupBy && !hasAggregate) {
    errors.push({
      message: 'GROUP BY without aggregate function (COUNT, SUM, AVG, etc.)',
      severity: 'warning'
    });
  }

  // Check for ORDER BY with LIMIT before OFFSET
  if (/\bLIMIT\b[^]*\bOFFSET\b/i.test(cleanedSql)) {
    // This is fine, LIMIT before OFFSET
  } else if (/\bOFFSET\b[^]*\bLIMIT\b/i.test(cleanedSql)) {
    errors.push({
      message: 'OFFSET should come after LIMIT in PostgreSQL',
      severity: 'warning'
    });
  }

  return errors;
}
