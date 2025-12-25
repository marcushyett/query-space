export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber?: number;
}

export interface SqlDiff {
  lines: DiffLine[];
  hasChanges: boolean;
  additions: number;
  deletions: number;
}

/**
 * Compute a simple line-by-line diff between two SQL strings.
 * Uses a basic LCS (Longest Common Subsequence) approach for better accuracy.
 */
export function computeSqlDiff(oldSql: string, newSql: string): SqlDiff {
  if (!oldSql || !newSql) {
    return {
      lines: newSql ? newSql.split('\n').map((content, i) => ({
        type: 'added' as const,
        content,
        lineNumber: i + 1,
      })) : [],
      hasChanges: true,
      additions: newSql ? newSql.split('\n').length : 0,
      deletions: 0,
    };
  }

  const oldLines = oldSql.split('\n');
  const newLines = newSql.split('\n');

  // Build LCS matrix
  const lcs = buildLcsMatrix(oldLines, newLines);

  // Backtrack to find the diff
  const diffLines = backtrackDiff(oldLines, newLines, lcs);

  const additions = diffLines.filter((l) => l.type === 'added').length;
  const deletions = diffLines.filter((l) => l.type === 'removed').length;

  return {
    lines: diffLines,
    hasChanges: additions > 0 || deletions > 0,
    additions,
    deletions,
  };
}

function buildLcsMatrix(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const matrix: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  return matrix;
}

function backtrackDiff(
  oldLines: string[],
  newLines: string[],
  lcs: number[][]
): DiffLine[] {
  const result: DiffLine[] = [];
  let i = oldLines.length;
  let j = newLines.length;
  let newLineNum = newLines.length;

  // Backtrack through the LCS matrix
  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({
        type: 'unchanged',
        content: newLines[j - 1],
        lineNumber: newLineNum--,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      stack.push({
        type: 'added',
        content: newLines[j - 1],
        lineNumber: newLineNum--,
      });
      j--;
    } else if (i > 0) {
      stack.push({
        type: 'removed',
        content: oldLines[i - 1],
      });
      i--;
    }
  }

  // Reverse to get the correct order
  while (stack.length > 0) {
    result.push(stack.pop()!);
  }

  return result;
}

/**
 * Format SQL for display with proper indentation
 */
export function formatSqlForDisplay(sql: string): string {
  if (!sql) return '';

  // Split by common SQL keywords for basic formatting
  const keywords = [
    'SELECT',
    'FROM',
    'WHERE',
    'AND',
    'OR',
    'JOIN',
    'LEFT JOIN',
    'RIGHT JOIN',
    'INNER JOIN',
    'OUTER JOIN',
    'ON',
    'GROUP BY',
    'ORDER BY',
    'HAVING',
    'LIMIT',
    'OFFSET',
    'UNION',
    'INSERT',
    'UPDATE',
    'DELETE',
    'SET',
    'VALUES',
  ];

  let formatted = sql.trim();

  // Add newlines before major keywords
  for (const keyword of keywords) {
    const regex = new RegExp(`\\s+${keyword}\\s+`, 'gi');
    formatted = formatted.replace(regex, `\n${keyword} `);
  }

  return formatted;
}
