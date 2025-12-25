import type { QueryResult } from '@/stores/queryStore';

export type ChartType = 'column' | 'line' | 'area' | 'pie' | 'none';

export interface ChartConfig {
  type: ChartType;
  xAxis: string | null;
  yAxes: string[];
  breakdownBy?: string | null;
  stacked?: boolean;
  title?: string;
}

export interface ChartableData {
  data: Record<string, unknown>[];
  xAxisKey: string;
  yAxisKeys: string[];
  chartType: ChartType;
}

// PostgreSQL data type OIDs for reference
// 20 = bigint, 21 = smallint, 23 = integer, 700 = real, 701 = float8
// 1700 = numeric, 1082 = date, 1114 = timestamp, 1184 = timestamptz
// 25 = text, 1043 = varchar
const NUMERIC_TYPE_IDS = new Set([20, 21, 23, 700, 701, 1700]);
const DATE_TYPE_IDS = new Set([1082, 1114, 1184]);
const TEXT_TYPE_IDS = new Set([25, 1043]);

export function isNumericType(dataTypeID: number): boolean {
  return NUMERIC_TYPE_IDS.has(dataTypeID);
}

export function isDateType(dataTypeID: number): boolean {
  return DATE_TYPE_IDS.has(dataTypeID);
}

export function isTextType(dataTypeID: number): boolean {
  return TEXT_TYPE_IDS.has(dataTypeID);
}

export function getColumnType(dataTypeID: number): 'numeric' | 'date' | 'text' | 'unknown' {
  if (isNumericType(dataTypeID)) return 'numeric';
  if (isDateType(dataTypeID)) return 'date';
  if (isTextType(dataTypeID)) return 'text';
  return 'unknown';
}

/**
 * Detect the best chart type based on the query result structure
 */
export function detectChartType(result: QueryResult): ChartType {
  if (!result || result.rows.length === 0 || result.fields.length < 2) {
    return 'none';
  }

  const fields = result.fields;

  // Need at least one potential X-axis and one Y-axis (numeric)
  const numericFields = fields.filter(f => isNumericType(f.dataTypeID));
  const dateFields = fields.filter(f => isDateType(f.dataTypeID));
  const textFields = fields.filter(f => isTextType(f.dataTypeID));

  if (numericFields.length === 0) {
    return 'none'; // No numeric data to chart
  }

  // If we have few categories and one numeric field, pie chart might be good
  if (textFields.length > 0 && numericFields.length === 1 && result.rows.length <= 10) {
    return 'pie';
  }

  // If we have date fields, suggest line chart
  if (dateFields.length > 0) {
    return 'line';
  }

  // If we have text/categorical fields, suggest column chart
  if (textFields.length > 0) {
    return 'column';
  }

  // Default to column chart if we just have numeric data
  return 'column';
}

/**
 * Suggest an X-axis column based on data types
 */
export function suggestXAxis(result: QueryResult): string | null {
  if (!result || result.fields.length === 0) return null;

  const fields = result.fields;

  // Prefer date fields for X-axis
  const dateField = fields.find(f => isDateType(f.dataTypeID));
  if (dateField) return dateField.name;

  // Then prefer text/categorical fields
  const textField = fields.find(f => isTextType(f.dataTypeID));
  if (textField) return textField.name;

  // If no date or text, use the first non-numeric field
  const nonNumericField = fields.find(f => !isNumericType(f.dataTypeID));
  if (nonNumericField) return nonNumericField.name;

  // Last resort: use first field
  return fields[0]?.name || null;
}

/**
 * Suggest Y-axis columns (numeric fields not used as X-axis)
 */
export function suggestYAxes(result: QueryResult, xAxis: string | null): string[] {
  if (!result || result.fields.length === 0) return [];

  return result.fields
    .filter(f => f.name !== xAxis && isNumericType(f.dataTypeID))
    .map(f => f.name);
}

/**
 * Suggest a breakdown column (categorical field not used as X-axis)
 */
export function suggestBreakdown(result: QueryResult, xAxis: string | null): string | null {
  if (!result || result.fields.length < 3) return null;

  const textFields = result.fields.filter(
    f => f.name !== xAxis && isTextType(f.dataTypeID)
  );

  return textFields.length > 0 ? textFields[0].name : null;
}

/**
 * Get available breakdown columns
 */
export function getBreakdownColumns(result: QueryResult, xAxis: string | null): string[] {
  if (!result) return [];

  return result.fields
    .filter(f => f.name !== xAxis && (isTextType(f.dataTypeID) || isDateType(f.dataTypeID)))
    .map(f => f.name);
}

/**
 * Get a suggested chart configuration for the query result
 */
export function suggestChartConfig(result: QueryResult): ChartConfig {
  const type = detectChartType(result);
  const xAxis = suggestXAxis(result);
  const yAxes = suggestYAxes(result, xAxis);

  return {
    type,
    xAxis,
    yAxes,
    stacked: false,
    breakdownBy: null,
  };
}

/**
 * Check if the query result can be visualized as a chart
 */
export function isChartable(result: QueryResult | null): boolean {
  if (!result || result.rows.length === 0 || result.fields.length < 2) {
    return false;
  }

  // Must have at least one numeric field for Y-axis
  const hasNumeric = result.fields.some(f => isNumericType(f.dataTypeID));

  return hasNumeric;
}

/**
 * Prepare data for Recharts consumption
 */
export function prepareChartData(
  result: QueryResult,
  config: ChartConfig
): ChartableData | null {
  if (!config.xAxis || config.yAxes.length === 0) {
    return null;
  }

  // Handle breakdown (pivot data by breakdown column)
  if (config.breakdownBy && config.yAxes.length === 1) {
    return prepareBreakdownChartData(result, config);
  }

  // Transform rows to ensure proper typing
  const data = result.rows.map(row => {
    const transformed: Record<string, unknown> = {};

    // Copy X-axis value
    transformed[config.xAxis!] = row[config.xAxis!];

    // Copy Y-axis values and ensure they're numbers
    config.yAxes.forEach(yKey => {
      const value = row[yKey];
      transformed[yKey] = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
    });

    return transformed;
  });

  return {
    data,
    xAxisKey: config.xAxis,
    yAxisKeys: config.yAxes,
    chartType: config.type,
  };
}

/**
 * Prepare data with breakdown (pivot) for charts
 */
export function prepareBreakdownChartData(
  result: QueryResult,
  config: ChartConfig
): ChartableData | null {
  if (!config.xAxis || !config.breakdownBy || config.yAxes.length === 0) {
    return null;
  }

  const xAxis = config.xAxis;
  const breakdownBy = config.breakdownBy;
  const yKey = config.yAxes[0];

  // Get unique breakdown values
  const breakdownValues = [...new Set(result.rows.map(row => String(row[breakdownBy] ?? 'Unknown')))];

  // Group by X-axis value
  const grouped: Record<string, Record<string, unknown>> = {};

  result.rows.forEach(row => {
    const xValue = String(row[xAxis] ?? '');
    const breakdownValue = String(row[breakdownBy] ?? 'Unknown');
    const yValue = typeof row[yKey] === 'number' ? row[yKey] : parseFloat(String(row[yKey])) || 0;

    if (!grouped[xValue]) {
      grouped[xValue] = { [xAxis]: row[xAxis] };
    }

    // Sum values for the same x-axis and breakdown combination
    const currentValue = (grouped[xValue][breakdownValue] as number) || 0;
    grouped[xValue][breakdownValue] = currentValue + yValue;
  });

  const data = Object.values(grouped);

  return {
    data,
    xAxisKey: xAxis,
    yAxisKeys: breakdownValues,
    chartType: config.type,
  };
}

/**
 * Generate chart colors (dark theme compatible)
 */
export function getChartColors(): string[] {
  return [
    '#1890ff', // Blue
    '#52c41a', // Green
    '#faad14', // Gold
    '#722ed1', // Purple
    '#eb2f96', // Magenta
    '#13c2c2', // Cyan
    '#fa541c', // Orange
    '#a0d911', // Lime
    '#36cfc9', // Teal
    '#f759ab', // Pink
    '#ffc53d', // Yellow
    '#73d13d', // Light Green
  ];
}

/**
 * Format numbers for chart display
 */
export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return (value / 1_000_000).toFixed(1) + 'M';
  }
  if (Math.abs(value) >= 1_000) {
    return (value / 1_000).toFixed(1) + 'K';
  }
  return value.toLocaleString();
}

/**
 * Format dates for chart display
 */
export function formatDate(value: unknown): string {
  if (!value) return '';

  const date = new Date(String(value));
  if (isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Truncate a label to a maximum length, adding ellipsis if needed
 */
export function truncateLabel(value: unknown, maxLength: number = 15): string {
  const str = String(value ?? '');
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 1) + '\u2026';
}
