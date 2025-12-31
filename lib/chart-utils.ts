import type { QueryResult } from '@/stores/queryStore';

export type ChartType =
  // Basic charts
  | 'column'
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  // Correlation & Distribution
  | 'scatter'
  | 'bubble'
  | 'histogram'
  | 'boxplot'
  // Hierarchical & Flow
  | 'treemap'
  | 'sunburst'
  | 'sankey'
  | 'funnel'
  // Comparison & KPI
  | 'radar'
  | 'gauge'
  | 'bullet'
  | 'waterfall'
  // Relationship & Network
  | 'network'
  | 'chord'
  | 'heatmap'
  // Geographic & Time
  | 'map'
  | 'timeline'
  // Utility
  | 'none';

export interface ChartConfig {
  type: ChartType;
  xAxis: string | null;
  yAxes: string[];
  breakdownBy?: string | null;
  stacked?: boolean;
  title?: string;

  // Common options
  showLabels?: boolean;
  showLegend?: boolean;

  // Scatter/Bubble chart options
  sizeColumn?: string | null;
  colorColumn?: string | null;
  minSize?: number;
  maxSize?: number;

  // Heatmap options
  valueColumn?: string | null;

  // Radar chart options
  categoryColumn?: string | null;
  fillOpacity?: number;

  // Funnel options
  showPercentage?: boolean;
  orientation?: 'vertical' | 'horizontal';

  // Waterfall options
  showTotal?: boolean;
  positiveColor?: string;
  negativeColor?: string;

  // Hierarchical chart options (treemap, sunburst)
  pathColumns?: string[] | null;
  colorByValue?: boolean;
  labelMinSize?: number;
  highlightAncestors?: boolean;

  // Flow chart options (sankey, network, chord)
  sourceColumn?: string | null;
  targetColumn?: string | null;
  nodeWidth?: number;
  nodePadding?: number;
  linkOpacity?: number;
  colorMode?: 'source' | 'target' | 'gradient';

  // Network/Force graph options
  weightColumn?: string | null;
  nodeSize?: number;
  sizeByConnections?: boolean;
  layout?: 'force' | 'circular' | 'hierarchical';
  linkDistance?: number;

  // Statistical chart options (boxplot, histogram)
  binCount?: number;
  showNormal?: boolean;
  cumulative?: boolean;
  showOutliers?: boolean;
  showMean?: boolean;
  whiskerType?: 'iqr' | 'minmax' | 'stddev';

  // Gauge options
  gaugeMin?: number;
  gaugeMax?: number;
  gaugeTarget?: number;
  gaugeType?: 'arc' | 'semicircle' | 'full';
  thresholds?: Array<{ value: number; color: string }>;

  // Timeline/Gantt options
  startColumn?: string | null;
  endColumn?: string | null;
  progressColumn?: string | null;
  showMilestones?: boolean;
  showProgress?: boolean;
  groupByCategory?: boolean;
  barHeight?: number;

  // Map options
  regionColumn?: string | null;
  mapType?: 'world' | 'usa' | 'europe' | 'asia';
  displayMode?: 'choropleth' | 'bubble' | 'both';
  colorScale?: 'sequential' | 'diverging' | 'categorical';
  latColumn?: string | null;
  lonColumn?: string | null;
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

  // If we have 2+ numeric fields and no text/date, suggest scatter plot
  if (numericFields.length >= 2 && textFields.length === 0 && dateFields.length === 0) {
    return 'scatter';
  }

  // If we have few categories and one numeric field, suggest donut chart (enhanced pie)
  if (textFields.length > 0 && numericFields.length === 1 && result.rows.length <= 10) {
    return 'donut';
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
 * Check if data is suitable for scatter chart
 */
export function isSuitableForScatter(result: QueryResult): boolean {
  if (!result || result.rows.length < 2) return false;
  const numericFields = result.fields.filter(f => isNumericType(f.dataTypeID));
  return numericFields.length >= 2;
}

/**
 * Check if data is suitable for funnel chart
 */
export function isSuitableForFunnel(result: QueryResult): boolean {
  if (!result || result.rows.length < 2 || result.rows.length > 10) return false;
  const numericFields = result.fields.filter(f => isNumericType(f.dataTypeID));
  const textFields = result.fields.filter(f => isTextType(f.dataTypeID));
  return numericFields.length >= 1 && textFields.length >= 1;
}

/**
 * Check if data is suitable for heatmap
 */
export function isSuitableForHeatmap(result: QueryResult): boolean {
  if (!result || result.rows.length < 4) return false;
  const numericFields = result.fields.filter(f => isNumericType(f.dataTypeID));
  const textFields = result.fields.filter(f => isTextType(f.dataTypeID));
  return numericFields.length >= 1 && textFields.length >= 2;
}

/**
 * Check if data is suitable for radar chart
 */
export function isSuitableForRadar(result: QueryResult): boolean {
  if (!result || result.rows.length < 3 || result.rows.length > 15) return false;
  const numericFields = result.fields.filter(f => isNumericType(f.dataTypeID));
  return numericFields.length >= 1;
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
    sizeColumn: null,
    colorColumn: null,
    valueColumn: null,
    categoryColumn: null,
    showPercentage: true,
    showTotal: true,
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

/**
 * Prepare data for scatter chart
 */
export function prepareScatterData(
  result: QueryResult,
  config: ChartConfig
): { data: Record<string, unknown>[]; xKey: string; yKey: string; sizeKey?: string; colorKey?: string } | null {
  if (!config.xAxis || config.yAxes.length === 0) return null;

  const xKey = config.xAxis;
  const yKey = config.yAxes[0];
  const sizeKey = config.sizeColumn || undefined;
  const colorKey = config.colorColumn || undefined;

  const data = result.rows.map((row) => {
    const point: Record<string, unknown> = {
      [xKey]: typeof row[xKey] === 'number' ? row[xKey] : parseFloat(String(row[xKey])) || 0,
      [yKey]: typeof row[yKey] === 'number' ? row[yKey] : parseFloat(String(row[yKey])) || 0,
    };
    if (sizeKey && row[sizeKey] !== undefined) {
      point[sizeKey] = typeof row[sizeKey] === 'number' ? row[sizeKey] : parseFloat(String(row[sizeKey])) || 10;
    }
    if (colorKey && row[colorKey] !== undefined) {
      point[colorKey] = row[colorKey];
    }
    return point;
  });

  return { data, xKey, yKey, sizeKey, colorKey };
}

/**
 * Prepare data for funnel chart
 */
export function prepareFunnelData(
  result: QueryResult,
  config: ChartConfig
): { data: { name: string; value: number; percentage?: number }[] } | null {
  if (!config.xAxis || config.yAxes.length === 0) return null;

  const nameKey = config.xAxis;
  const valueKey = config.yAxes[0];

  const rawData = result.rows.map((row) => ({
    name: String(row[nameKey] ?? ''),
    value: typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(String(row[valueKey])) || 0,
  }));

  // Sort by value descending for proper funnel appearance
  rawData.sort((a, b) => (b.value as number) - (a.value as number));

  // Calculate percentages relative to the first (largest) value
  const maxValue = rawData[0]?.value || 1;
  const data = rawData.map((item) => ({
    ...item,
    percentage: ((item.value as number) / maxValue) * 100,
  }));

  return { data };
}

/**
 * Prepare data for waterfall chart
 */
export function prepareWaterfallData(
  result: QueryResult,
  config: ChartConfig
): { data: { name: string; value: number; isTotal?: boolean; start: number; end: number; fill: string }[] } | null {
  if (!config.xAxis || config.yAxes.length === 0) return null;

  const nameKey = config.xAxis;
  const valueKey = config.yAxes[0];

  let cumulative = 0;
  const data: { name: string; value: number; isTotal?: boolean; start: number; end: number; fill: string }[] = [];

  result.rows.forEach((row) => {
    const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(String(row[valueKey])) || 0;
    const name = String(row[nameKey] ?? '');
    const start = cumulative;
    cumulative += value;

    data.push({
      name,
      value,
      start,
      end: cumulative,
      fill: value >= 0 ? '#52c41a' : '#ff4d4f', // Green for positive, red for negative
    });
  });

  // Add total bar if configured
  if (config.showTotal !== false) {
    data.push({
      name: 'Total',
      value: cumulative,
      isTotal: true,
      start: 0,
      end: cumulative,
      fill: '#1890ff', // Blue for total
    });
  }

  return { data };
}

/**
 * Prepare data for heatmap chart
 */
export function prepareHeatmapData(
  result: QueryResult,
  config: ChartConfig
): { data: { x: string; y: string; value: number }[]; xValues: string[]; yValues: string[]; minValue: number; maxValue: number } | null {
  if (!config.xAxis || config.yAxes.length === 0) return null;

  const xKey = config.xAxis;
  const yKey = config.yAxes[0];
  const valueKey = config.valueColumn || config.yAxes[1] || config.yAxes[0];

  const data: { x: string; y: string; value: number }[] = [];
  const xValuesSet = new Set<string>();
  const yValuesSet = new Set<string>();
  let minValue = Infinity;
  let maxValue = -Infinity;

  result.rows.forEach((row) => {
    const x = String(row[xKey] ?? '');
    const y = String(row[yKey] ?? '');
    const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(String(row[valueKey])) || 0;

    xValuesSet.add(x);
    yValuesSet.add(y);
    minValue = Math.min(minValue, value);
    maxValue = Math.max(maxValue, value);

    data.push({ x, y, value });
  });

  return {
    data,
    xValues: Array.from(xValuesSet),
    yValues: Array.from(yValuesSet),
    minValue: minValue === Infinity ? 0 : minValue,
    maxValue: maxValue === -Infinity ? 0 : maxValue,
  };
}

/**
 * Prepare data for radar chart
 */
export function prepareRadarData(
  result: QueryResult,
  config: ChartConfig
): { data: Record<string, unknown>[]; subjects: string[]; series: string[] } | null {
  if (!config.xAxis || config.yAxes.length === 0) return null;

  const subjectKey = config.xAxis;
  const seriesKey = config.categoryColumn || config.breakdownBy;

  if (seriesKey) {
    // Multiple series - pivot data
    const subjects = [...new Set(result.rows.map((row) => String(row[subjectKey] ?? '')))];
    const seriesValues = [...new Set(result.rows.map((row) => String(row[seriesKey] ?? '')))];
    const valueKey = config.yAxes[0];

    const grouped: Record<string, Record<string, number>> = {};
    subjects.forEach((s) => {
      grouped[s] = {};
      seriesValues.forEach((sv) => {
        grouped[s][sv] = 0;
      });
    });

    result.rows.forEach((row) => {
      const subject = String(row[subjectKey] ?? '');
      const series = String(row[seriesKey] ?? '');
      const value = typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(String(row[valueKey])) || 0;
      if (grouped[subject]) {
        grouped[subject][series] = value;
      }
    });

    const data = subjects.map((subject) => ({
      subject,
      ...grouped[subject],
    }));

    return { data, subjects, series: seriesValues };
  } else {
    // Single series - use yAxes as different metrics
    const data = result.rows.map((row) => {
      const point: Record<string, unknown> = {
        subject: String(row[subjectKey] ?? ''),
      };
      config.yAxes.forEach((yKey) => {
        point[yKey] = typeof row[yKey] === 'number' ? row[yKey] : parseFloat(String(row[yKey])) || 0;
      });
      return point;
    });

    return { data, subjects: data.map((d) => String(d.subject)), series: config.yAxes };
  }
}

/**
 * Get available size columns for bubble/scatter charts
 */
export function getSizeColumns(result: QueryResult, xAxis: string | null, yAxes: string[]): string[] {
  if (!result) return [];
  return result.fields
    .filter((f) => f.name !== xAxis && !yAxes.includes(f.name) && isNumericType(f.dataTypeID))
    .map((f) => f.name);
}

/**
 * Get color scale for heatmap
 */
export function getHeatmapColorScale(value: number, min: number, max: number): string {
  if (max === min) return '#1890ff';
  const ratio = (value - min) / (max - min);
  // Interpolate from light blue to dark blue
  const r = Math.round(24 + (144 - 24) * (1 - ratio));
  const g = Math.round(144 + (238 - 144) * (1 - ratio));
  const b = Math.round(255);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Prepare data for bar chart (horizontal bars)
 */
export function prepareBarData(
  result: QueryResult,
  config: ChartConfig
): ChartableData | null {
  // Bar chart uses the same data structure as column chart
  return prepareChartData(result, config);
}

/**
 * Prepare data for bubble chart
 */
export function prepareBubbleData(
  result: QueryResult,
  config: ChartConfig
): { data: Record<string, unknown>[]; xColumn: string; yColumn: string; sizeColumn: string; colorColumn?: string } | null {
  if (!config.xAxis || config.yAxes.length === 0) return null;

  const xColumn = config.xAxis;
  const yColumn = config.yAxes[0];
  const sizeColumn = config.sizeColumn || config.yAxes[1] || config.yAxes[0];
  const colorColumn = config.colorColumn || undefined;

  const data = result.rows.map((row) => {
    const point: Record<string, unknown> = {};
    // Copy all relevant columns
    point[xColumn] = typeof row[xColumn] === 'number' ? row[xColumn] : parseFloat(String(row[xColumn])) || 0;
    point[yColumn] = typeof row[yColumn] === 'number' ? row[yColumn] : parseFloat(String(row[yColumn])) || 0;
    point[sizeColumn] = typeof row[sizeColumn] === 'number' ? row[sizeColumn] : parseFloat(String(row[sizeColumn])) || 10;
    if (colorColumn) {
      point[colorColumn] = row[colorColumn];
    }
    return point;
  });

  return { data, xColumn, yColumn, sizeColumn, colorColumn };
}

/**
 * Prepare data for histogram chart
 */
export function prepareHistogramData(
  result: QueryResult,
  config: ChartConfig
): { data: Record<string, unknown>[]; valueColumn: string } | null {
  if (config.yAxes.length === 0) return null;

  const valueColumn = config.yAxes[0];
  const data = result.rows.map((row) => ({
    [valueColumn]: typeof row[valueColumn] === 'number' ? row[valueColumn] : parseFloat(String(row[valueColumn])) || 0,
  }));

  return { data, valueColumn };
}

/**
 * Prepare data for treemap chart
 */
export function prepareTreemapData(
  result: QueryResult,
  config: ChartConfig
): { data: Record<string, unknown>[]; pathColumns: string[]; valueColumn: string } | null {
  if (!config.xAxis || config.yAxes.length === 0) return null;

  // Use xAxis and any additional categorical columns as path columns
  const pathColumns = config.pathColumns || [config.xAxis];
  const valueColumn = config.yAxes[0];

  const data = result.rows.map((row) => {
    const point: Record<string, unknown> = {};
    pathColumns.forEach((col) => {
      point[col] = row[col];
    });
    point[valueColumn] = typeof row[valueColumn] === 'number' ? row[valueColumn] : parseFloat(String(row[valueColumn])) || 0;
    return point;
  });

  return { data, pathColumns, valueColumn };
}

/**
 * Prepare data for sunburst chart
 */
export function prepareSunburstData(
  result: QueryResult,
  config: ChartConfig
): { data: Record<string, unknown>[]; pathColumns: string[]; valueColumn: string } | null {
  // Sunburst uses the same data structure as treemap
  return prepareTreemapData(result, config);
}

/**
 * Prepare data for sankey chart
 */
export function prepareSankeyData(
  result: QueryResult,
  config: ChartConfig
): { data: Record<string, unknown>[]; sourceColumn: string; targetColumn: string; valueColumn: string } | null {
  if (!config.sourceColumn || !config.targetColumn || config.yAxes.length === 0) return null;

  const sourceColumn = config.sourceColumn;
  const targetColumn = config.targetColumn;
  const valueColumn = config.yAxes[0];

  const data = result.rows.map((row) => ({
    [sourceColumn]: row[sourceColumn],
    [targetColumn]: row[targetColumn],
    [valueColumn]: typeof row[valueColumn] === 'number' ? row[valueColumn] : parseFloat(String(row[valueColumn])) || 0,
  }));

  return { data, sourceColumn, targetColumn, valueColumn };
}

/**
 * Prepare data for network chart
 */
export function prepareNetworkData(
  result: QueryResult,
  config: ChartConfig
): { data: Record<string, unknown>[]; sourceColumn: string; targetColumn: string; weightColumn?: string } | null {
  if (!config.sourceColumn || !config.targetColumn) return null;

  const sourceColumn = config.sourceColumn;
  const targetColumn = config.targetColumn;
  const weightColumn = config.weightColumn || (config.yAxes.length > 0 ? config.yAxes[0] : undefined);

  const data = result.rows.map((row) => {
    const point: Record<string, unknown> = {
      [sourceColumn]: row[sourceColumn],
      [targetColumn]: row[targetColumn],
    };
    if (weightColumn) {
      point[weightColumn] = typeof row[weightColumn] === 'number' ? row[weightColumn] : parseFloat(String(row[weightColumn])) || 1;
    }
    return point;
  });

  return { data, sourceColumn, targetColumn, weightColumn };
}

/**
 * Prepare data for gauge chart
 */
export function prepareGaugeData(
  result: QueryResult,
  config: ChartConfig
): { value: number; min?: number; max?: number; target?: number; label?: string } | null {
  if (config.yAxes.length === 0 || result.rows.length === 0) return null;

  const valueColumn = config.yAxes[0];
  const value = typeof result.rows[0][valueColumn] === 'number'
    ? result.rows[0][valueColumn]
    : parseFloat(String(result.rows[0][valueColumn])) || 0;

  // Use config for min/max/target if provided
  const label = config.xAxis ? String(result.rows[0][config.xAxis] || '') : undefined;

  return {
    value,
    min: config.gaugeMin,
    max: config.gaugeMax,
    target: config.gaugeTarget,
    label,
  };
}

/**
 * Prepare data for timeline chart
 */
export function prepareTimelineData(
  result: QueryResult,
  config: ChartConfig
): { data: Record<string, unknown>[]; labelColumn: string; startColumn: string; endColumn: string; categoryColumn?: string; progressColumn?: string } | null {
  if (!config.xAxis || !config.startColumn || !config.endColumn) return null;

  const labelColumn = config.xAxis;
  const startColumn = config.startColumn;
  const endColumn = config.endColumn;
  const categoryColumn = config.categoryColumn || undefined;
  const progressColumn = config.progressColumn || undefined;

  const data = result.rows.map((row) => {
    const point: Record<string, unknown> = {
      [labelColumn]: row[labelColumn],
      [startColumn]: row[startColumn],
      [endColumn]: row[endColumn],
    };
    if (categoryColumn) {
      point[categoryColumn] = row[categoryColumn];
    }
    if (progressColumn) {
      point[progressColumn] = row[progressColumn];
    }
    return point;
  });

  return { data, labelColumn, startColumn, endColumn, categoryColumn, progressColumn };
}

/**
 * Prepare data for map chart
 */
export function prepareMapData(
  result: QueryResult,
  config: ChartConfig
): { data: Record<string, unknown>[]; regionColumn: string; valueColumn: string } | null {
  if (!config.xAxis || config.yAxes.length === 0) return null;

  const regionColumn = config.regionColumn || config.xAxis;
  const valueColumn = config.yAxes[0];

  const data = result.rows.map((row) => ({
    [regionColumn]: row[regionColumn],
    [valueColumn]: typeof row[valueColumn] === 'number' ? row[valueColumn] : parseFloat(String(row[valueColumn])) || 0,
  }));

  return { data, regionColumn, valueColumn };
}

/**
 * Get source/target columns for flow charts
 */
export function getFlowColumns(result: QueryResult): { sourceColumns: string[]; targetColumns: string[] } {
  if (!result) return { sourceColumns: [], targetColumns: [] };

  // Look for columns that might be source/target
  const textColumns = result.fields
    .filter((f) => isTextType(f.dataTypeID))
    .map((f) => f.name);

  return {
    sourceColumns: textColumns,
    targetColumns: textColumns,
  };
}

/**
 * Get path columns for hierarchical charts
 */
export function getPathColumns(result: QueryResult): string[] {
  if (!result) return [];

  return result.fields
    .filter((f) => isTextType(f.dataTypeID))
    .map((f) => f.name);
}

/**
 * Get date columns for timeline charts
 */
export function getDateColumns(result: QueryResult): string[] {
  if (!result) return [];

  return result.fields
    .filter((f) => isDateType(f.dataTypeID))
    .map((f) => f.name);
}
