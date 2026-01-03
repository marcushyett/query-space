/**
 * SQL Column Parser
 * Extracts column names from SQL SELECT statements, including aliases.
 */

export interface ParsedColumn {
  name: string;
  expression: string;
  isAlias: boolean;
}

/**
 * Extracts column names from a SQL SELECT statement.
 * Handles:
 * - Simple columns: SELECT name, age
 * - Aliased columns: SELECT name AS user_name
 * - Expression aliases: SELECT COUNT(*) AS total
 * - Function results: SELECT MAX(price) AS max_price
 * - Double-quoted identifiers: SELECT "Column Name" AS col
 *
 * @param sql The SQL query string
 * @returns Array of parsed column names
 */
export function extractColumnsFromSQL(sql: string): ParsedColumn[] {
  if (!sql || typeof sql !== 'string') {
    return [];
  }

  // Normalize the SQL - remove extra whitespace and newlines
  const normalizedSql = sql.replace(/\s+/g, ' ').trim();

  // Find the SELECT clause - handle WITH statements (CTEs)
  let selectMatch: RegExpMatchArray | null = null;

  // Check for CTE (WITH ... AS ...)
  if (/^\s*WITH\s+/i.test(normalizedSql)) {
    // Find the final SELECT after the CTE
    // This is a simplified approach - find the last SELECT that's not inside a CTE
    const ctePattern = /WITH\s+(?:RECURSIVE\s+)?[\s\S]*?\)\s*(SELECT)/i;
    const match = normalizedSql.match(ctePattern);
    if (match) {
      const selectIndex = normalizedSql.lastIndexOf(match[1]);
      const afterSelect = normalizedSql.slice(selectIndex);
      selectMatch = afterSelect.match(/^SELECT\s+(DISTINCT\s+)?(.+?)\s+FROM/i);
    }
  } else {
    // Regular SELECT statement
    selectMatch = normalizedSql.match(/^SELECT\s+(DISTINCT\s+)?(.+?)\s+FROM/i);
  }

  if (!selectMatch) {
    // Try without FROM (e.g., SELECT 1 AS one)
    selectMatch = normalizedSql.match(/^SELECT\s+(DISTINCT\s+)?(.+?)(?:;|$)/i);
  }

  if (!selectMatch || !selectMatch[2]) {
    return [];
  }

  const columnsStr = selectMatch[2].trim();

  // Handle SELECT * case
  if (columnsStr === '*') {
    return [{ name: '*', expression: '*', isAlias: false }];
  }

  // Parse individual columns
  return parseColumnList(columnsStr);
}

/**
 * Parse a comma-separated list of column expressions
 */
function parseColumnList(columnsStr: string): ParsedColumn[] {
  const columns: ParsedColumn[] = [];
  const tokens = tokenizeColumns(columnsStr);

  for (const token of tokens) {
    const parsed = parseColumnExpression(token.trim());
    if (parsed) {
      columns.push(parsed);
    }
  }

  return columns;
}

/**
 * Tokenize the column list, respecting parentheses and quotes
 */
function tokenizeColumns(columnsStr: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let parenDepth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let prevChar = '';

  for (let i = 0; i < columnsStr.length; i++) {
    const char = columnsStr[i];

    // Handle quotes
    if (char === "'" && !inDoubleQuote && prevChar !== '\\') {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote && prevChar !== '\\') {
      inDoubleQuote = !inDoubleQuote;
    }

    // Handle parentheses (only when not in quotes)
    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '(') {
        parenDepth++;
      } else if (char === ')') {
        parenDepth--;
      }
    }

    // Handle comma separator (only when not nested and not in quotes)
    if (char === ',' && parenDepth === 0 && !inSingleQuote && !inDoubleQuote) {
      if (current.trim()) {
        tokens.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }

    prevChar = char;
  }

  // Add the last token
  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
}

/**
 * Parse a single column expression to extract the column name
 */
function parseColumnExpression(expr: string): ParsedColumn | null {
  if (!expr) return null;

  const trimmed = expr.trim();

  // Check for AS alias (case insensitive)
  // Pattern: expression AS alias or expression AS "quoted alias"
  const asMatch = trimmed.match(/^(.+?)\s+AS\s+("[^"]+"|'[^']+'|[^\s,]+)\s*$/i);
  if (asMatch) {
    let aliasName = asMatch[2].trim();
    // Remove quotes from alias if present
    if ((aliasName.startsWith('"') && aliasName.endsWith('"')) ||
        (aliasName.startsWith("'") && aliasName.endsWith("'"))) {
      aliasName = aliasName.slice(1, -1);
    }
    return {
      name: aliasName,
      expression: asMatch[1].trim(),
      isAlias: true,
    };
  }

  // Check for implicit alias (expression followed by identifier without AS)
  // Pattern: expression identifier (e.g., "table.column col_alias")
  // But be careful not to match things like "MAX(column)"
  const implicitMatch = trimmed.match(/^(.+)\s+("[^"]+"|[a-zA-Z_][a-zA-Z0-9_]*)\s*$/);
  if (implicitMatch) {
    const possibleAlias = implicitMatch[2].trim();
    const expression = implicitMatch[1].trim();

    // Make sure the expression ends with ) or a word, and the alias is a valid identifier
    // Also check it's not a SQL keyword
    const sqlKeywords = new Set([
      'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'TRUE', 'FALSE',
      'LIKE', 'BETWEEN', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
      'UNION', 'INTERSECT', 'EXCEPT', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
      'ON', 'USING', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'OVER', 'PARTITION',
      'AS', 'DISTINCT', 'ALL', 'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST'
    ]);

    const unquotedAlias = possibleAlias.startsWith('"')
      ? possibleAlias.slice(1, -1)
      : possibleAlias;

    if (!sqlKeywords.has(unquotedAlias.toUpperCase()) &&
        (expression.endsWith(')') || /[a-zA-Z0-9_]$/.test(expression))) {
      return {
        name: unquotedAlias,
        expression: expression,
        isAlias: true,
      };
    }
  }

  // No alias - extract the column name from the expression
  // Handle table.column notation
  const tableColumnMatch = trimmed.match(/^(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?("[^"]+"|[a-zA-Z_][a-zA-Z0-9_]*)$/);
  if (tableColumnMatch) {
    let colName = tableColumnMatch[1];
    if (colName.startsWith('"') && colName.endsWith('"')) {
      colName = colName.slice(1, -1);
    }
    return {
      name: colName,
      expression: trimmed,
      isAlias: false,
    };
  }

  // For functions/expressions without alias, try to derive a sensible name
  // e.g., COUNT(*) -> count, SUM(price) -> sum
  const funcMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/i);
  if (funcMatch) {
    return {
      name: funcMatch[1].toLowerCase(),
      expression: trimmed,
      isAlias: false,
    };
  }

  // For complex expressions, use a sanitized version
  // Remove special characters and truncate
  const sanitized = trimmed
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
    .slice(0, 30);

  return {
    name: sanitized || 'column',
    expression: trimmed,
    isAlias: false,
  };
}

/**
 * Get column names only (for use in dropdowns)
 */
export function getColumnNames(sql: string): string[] {
  const columns = extractColumnsFromSQL(sql);
  return columns
    .map(col => col.name)
    .filter(name => name && name !== '*');
}

/**
 * Validate if a column name exists in the SQL query
 */
export function isValidColumn(sql: string, columnName: string): boolean {
  const columns = getColumnNames(sql);
  // Case-insensitive comparison
  return columns.some(col => col.toLowerCase() === columnName.toLowerCase());
}
