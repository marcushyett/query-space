/**
 * Data Quality Analysis Utilities
 *
 * Provides tools for detecting and analyzing data quality issues in query results,
 * including null values, zero values, infinite values, type mismatches, and more.
 */

export interface DataQualityIssue {
  column: string;
  issueType: 'all_null' | 'high_null_ratio' | 'all_zero' | 'high_zero_ratio' | 'infinite_values' | 'type_mismatch' | 'empty_strings' | 'outliers';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  affectedRows: number;
  percentage: number;
  suggestion?: string;
}

export interface DataQualityReport {
  totalRows: number;
  totalColumns: number;
  issues: DataQualityIssue[];
  columnStats: ColumnStats[];
  overallQuality: 'good' | 'acceptable' | 'poor';
  qualityScore: number; // 0-100
  filteredRowCount?: number;
  filteringApplied: boolean;
}

export interface ColumnStats {
  name: string;
  inferredType: 'numeric' | 'text' | 'boolean' | 'date' | 'json' | 'null' | 'mixed';
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  zeroCount?: number;
  infiniteCount?: number;
  emptyStringCount?: number;
  minValue?: number | string;
  maxValue?: number | string;
}

// Thresholds for data quality detection
const QUALITY_THRESHOLDS = {
  HIGH_NULL_RATIO: 0.5, // 50% nulls = warning
  CRITICAL_NULL_RATIO: 0.9, // 90% nulls = critical
  HIGH_ZERO_RATIO: 0.8, // 80% zeros = warning
  OUTLIER_STD_MULTIPLIER: 3, // Values > 3 std devs from mean
};

/**
 * Check if a value represents infinity
 */
function isInfinite(value: unknown): boolean {
  if (typeof value === 'number') {
    return !isFinite(value) && !isNaN(value);
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'infinity' || lower === '-infinity' || lower === 'inf' || lower === '-inf';
  }
  return false;
}

/**
 * Check if a value is effectively zero
 */
function isZero(value: unknown): boolean {
  if (value === 0) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '0' || trimmed === '0.0' || trimmed === '0.00';
  }
  if (typeof value === 'number') {
    return value === 0;
  }
  return false;
}

/**
 * Infer the type of a column based on sample values
 */
function inferColumnType(values: unknown[]): ColumnStats['inferredType'] {
  const nonNullValues = values.filter(v => v !== null && v !== undefined);

  if (nonNullValues.length === 0) return 'null';

  const types = new Set<string>();

  for (const value of nonNullValues) {
    if (typeof value === 'number') {
      types.add('numeric');
    } else if (typeof value === 'boolean') {
      types.add('boolean');
    } else if (typeof value === 'string') {
      // Try to detect dates
      if (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value)) {
        types.add('date');
      } else if (!isNaN(Number(value)) && value.trim() !== '') {
        // Numeric string
        types.add('numeric');
      } else {
        types.add('text');
      }
    } else if (typeof value === 'object') {
      types.add('json');
    }
  }

  if (types.size === 0) return 'null';
  if (types.size === 1) return types.values().next().value as ColumnStats['inferredType'];
  return 'mixed';
}

/**
 * Calculate statistics for a single column
 */
function calculateColumnStats(columnName: string, values: unknown[]): ColumnStats {
  const totalRows = values.length;
  const nullCount = values.filter(v => v === null || v === undefined).length;
  const nonNullValues = values.filter(v => v !== null && v !== undefined);
  const uniqueValues = new Set(nonNullValues.map(v => JSON.stringify(v)));

  const stats: ColumnStats = {
    name: columnName,
    inferredType: inferColumnType(values),
    nullCount,
    nullPercentage: totalRows > 0 ? (nullCount / totalRows) * 100 : 0,
    uniqueCount: uniqueValues.size,
  };

  // Calculate numeric-specific stats
  const numericValues = nonNullValues
    .map(v => typeof v === 'number' ? v : parseFloat(String(v)))
    .filter(v => !isNaN(v));

  if (numericValues.length > 0) {
    stats.zeroCount = numericValues.filter(v => v === 0).length;
    stats.infiniteCount = numericValues.filter(v => !isFinite(v)).length;
    stats.minValue = Math.min(...numericValues.filter(isFinite));
    stats.maxValue = Math.max(...numericValues.filter(isFinite));
  }

  // Count empty strings
  const stringValues = nonNullValues.filter(v => typeof v === 'string');
  if (stringValues.length > 0) {
    stats.emptyStringCount = stringValues.filter(v => (v as string).trim() === '').length;
  }

  return stats;
}

/**
 * Detect data quality issues in a column
 */
function detectColumnIssues(stats: ColumnStats, totalRows: number): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  // Check for all null
  if (stats.nullCount === totalRows && totalRows > 0) {
    issues.push({
      column: stats.name,
      issueType: 'all_null',
      severity: 'critical',
      description: `Column "${stats.name}" contains only NULL values`,
      affectedRows: totalRows,
      percentage: 100,
      suggestion: 'This column may have incorrect field name or the data is missing. Verify the column name matches the schema.',
    });
  } else if (stats.nullPercentage >= QUALITY_THRESHOLDS.CRITICAL_NULL_RATIO * 100) {
    issues.push({
      column: stats.name,
      issueType: 'high_null_ratio',
      severity: 'critical',
      description: `Column "${stats.name}" has ${stats.nullPercentage.toFixed(1)}% NULL values`,
      affectedRows: stats.nullCount,
      percentage: stats.nullPercentage,
      suggestion: 'Consider filtering out rows with NULL values or using COALESCE to provide defaults.',
    });
  } else if (stats.nullPercentage >= QUALITY_THRESHOLDS.HIGH_NULL_RATIO * 100) {
    issues.push({
      column: stats.name,
      issueType: 'high_null_ratio',
      severity: 'warning',
      description: `Column "${stats.name}" has ${stats.nullPercentage.toFixed(1)}% NULL values`,
      affectedRows: stats.nullCount,
      percentage: stats.nullPercentage,
      suggestion: 'Many NULL values detected. This may affect aggregation results.',
    });
  }

  // Check for all zeros (for numeric columns)
  if (stats.zeroCount !== undefined && stats.zeroCount > 0) {
    const zeroPercentage = (stats.zeroCount / totalRows) * 100;
    if (stats.zeroCount === totalRows - stats.nullCount && totalRows > 0) {
      issues.push({
        column: stats.name,
        issueType: 'all_zero',
        severity: 'warning',
        description: `Column "${stats.name}" contains only zero values`,
        affectedRows: stats.zeroCount,
        percentage: zeroPercentage,
        suggestion: 'All values are zero. This may indicate missing data or incorrect column selection.',
      });
    } else if (zeroPercentage >= QUALITY_THRESHOLDS.HIGH_ZERO_RATIO * 100) {
      issues.push({
        column: stats.name,
        issueType: 'high_zero_ratio',
        severity: 'info',
        description: `Column "${stats.name}" has ${zeroPercentage.toFixed(1)}% zero values`,
        affectedRows: stats.zeroCount,
        percentage: zeroPercentage,
        suggestion: 'High proportion of zeros. May want to filter these for certain analyses.',
      });
    }
  }

  // Check for infinite values
  if (stats.infiniteCount && stats.infiniteCount > 0) {
    const infPercentage = (stats.infiniteCount / totalRows) * 100;
    issues.push({
      column: stats.name,
      issueType: 'infinite_values',
      severity: 'critical',
      description: `Column "${stats.name}" contains ${stats.infiniteCount} infinite value(s)`,
      affectedRows: stats.infiniteCount,
      percentage: infPercentage,
      suggestion: 'Infinite values detected. Filter these out before aggregation to avoid incorrect results.',
    });
  }

  // Check for type mismatches
  if (stats.inferredType === 'mixed') {
    issues.push({
      column: stats.name,
      issueType: 'type_mismatch',
      severity: 'warning',
      description: `Column "${stats.name}" contains mixed data types`,
      affectedRows: 0, // Can't easily count
      percentage: 0,
      suggestion: 'Consider casting values to a consistent type for reliable calculations.',
    });
  }

  // Check for empty strings
  if (stats.emptyStringCount && stats.emptyStringCount > 0) {
    const emptyPercentage = (stats.emptyStringCount / totalRows) * 100;
    if (emptyPercentage > 20) {
      issues.push({
        column: stats.name,
        issueType: 'empty_strings',
        severity: 'info',
        description: `Column "${stats.name}" has ${emptyPercentage.toFixed(1)}% empty strings`,
        affectedRows: stats.emptyStringCount,
        percentage: emptyPercentage,
        suggestion: 'Consider treating empty strings as NULL or filtering them out.',
      });
    }
  }

  return issues;
}

/**
 * Analyze data quality for query results
 */
export function analyzeDataQuality(
  rows: Record<string, unknown>[],
  columns: string[]
): DataQualityReport {
  if (rows.length === 0) {
    return {
      totalRows: 0,
      totalColumns: columns.length,
      issues: [],
      columnStats: [],
      overallQuality: 'good',
      qualityScore: 100,
      filteringApplied: false,
    };
  }

  const columnStats: ColumnStats[] = [];
  const allIssues: DataQualityIssue[] = [];

  for (const column of columns) {
    const values = rows.map(row => row[column]);
    const stats = calculateColumnStats(column, values);
    columnStats.push(stats);

    const issues = detectColumnIssues(stats, rows.length);
    allIssues.push(...issues);
  }

  // Calculate overall quality score
  let qualityScore = 100;
  for (const issue of allIssues) {
    switch (issue.severity) {
      case 'critical':
        qualityScore -= 25;
        break;
      case 'warning':
        qualityScore -= 10;
        break;
      case 'info':
        qualityScore -= 2;
        break;
    }
  }
  qualityScore = Math.max(0, qualityScore);

  const overallQuality: DataQualityReport['overallQuality'] =
    qualityScore >= 80 ? 'good' :
    qualityScore >= 50 ? 'acceptable' : 'poor';

  return {
    totalRows: rows.length,
    totalColumns: columns.length,
    issues: allIssues,
    columnStats,
    overallQuality,
    qualityScore,
    filteringApplied: false,
  };
}

/**
 * Filter out rows with garbage data based on specified criteria
 */
export function filterGarbageData(
  rows: Record<string, unknown>[],
  columns: string[],
  options: {
    removeNulls?: boolean | string[]; // true = all columns, string[] = specific columns
    removeZeros?: boolean | string[];
    removeInfinites?: boolean | string[];
    removeEmptyStrings?: boolean | string[];
  } = {}
): { filteredRows: Record<string, unknown>[]; removedCount: number; removedReasons: Record<string, number> } {
  const removedReasons: Record<string, number> = {
    null: 0,
    zero: 0,
    infinite: 0,
    emptyString: 0,
  };

  const filteredRows = rows.filter(row => {
    // Determine which columns to check for each filter type
    const nullColumns = options.removeNulls === true ? columns :
                       Array.isArray(options.removeNulls) ? options.removeNulls : [];
    const zeroColumns = options.removeZeros === true ? columns :
                       Array.isArray(options.removeZeros) ? options.removeZeros : [];
    const infiniteColumns = options.removeInfinites === true ? columns :
                           Array.isArray(options.removeInfinites) ? options.removeInfinites : [];
    const emptyStringColumns = options.removeEmptyStrings === true ? columns :
                              Array.isArray(options.removeEmptyStrings) ? options.removeEmptyStrings : [];

    // Check for nulls
    for (const col of nullColumns) {
      if (row[col] === null || row[col] === undefined) {
        removedReasons.null++;
        return false;
      }
    }

    // Check for zeros
    for (const col of zeroColumns) {
      if (isZero(row[col])) {
        removedReasons.zero++;
        return false;
      }
    }

    // Check for infinites
    for (const col of infiniteColumns) {
      if (isInfinite(row[col])) {
        removedReasons.infinite++;
        return false;
      }
    }

    // Check for empty strings
    for (const col of emptyStringColumns) {
      if (typeof row[col] === 'string' && row[col].trim() === '') {
        removedReasons.emptyString++;
        return false;
      }
    }

    return true;
  });

  return {
    filteredRows,
    removedCount: rows.length - filteredRows.length,
    removedReasons,
  };
}

/**
 * Generate a summary of data quality issues for reporting
 */
export function summarizeDataQuality(report: DataQualityReport): string {
  if (report.issues.length === 0) {
    return 'Data quality is good. No significant issues detected.';
  }

  const critical = report.issues.filter(i => i.severity === 'critical');
  const warnings = report.issues.filter(i => i.severity === 'warning');

  const parts: string[] = [];

  if (critical.length > 0) {
    parts.push(`${critical.length} critical issue(s): ${critical.map(i => i.description).join('; ')}`);
  }

  if (warnings.length > 0) {
    parts.push(`${warnings.length} warning(s): ${warnings.map(i => i.description).join('; ')}`);
  }

  return parts.join('. ') + '.';
}
