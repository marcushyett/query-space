/**
 * Chart Component Types
 *
 * Standard interfaces for all chart components ensuring consistency
 * and easy extensibility.
 */

import type { ChartType, ConfigOption } from './chart-registry';
import type { ColorPaletteName, ThemeMode, GlobalChartSettings } from './chart-settings';

// =============================================================================
// BASE CHART CONFIGURATION
// =============================================================================

/**
 * Base configuration shared by all charts
 */
export interface BaseChartConfig {
  // Chart type
  type: ChartType;

  // Title and description
  title?: string;
  description?: string;

  // Styling
  colorPalette?: ColorPaletteName;
  customColors?: string[];
  theme?: ThemeMode;

  // Dimensions
  width?: number | string;
  height?: number | string;

  // Interactivity
  animated?: boolean;
  interactive?: boolean;
  tooltipEnabled?: boolean;
  legendEnabled?: boolean;

  // Chart-specific options (type-safe overrides in specific configs)
  [key: string]: unknown;
}

/**
 * Extended configuration for specific chart types
 */
export interface ColumnChartConfig extends BaseChartConfig {
  type: 'column' | 'bar';
  xAxis: string;
  yAxes: string[];
  stacked?: boolean;
  showLabels?: boolean;
  barWidth?: number;
  sortOrder?: 'none' | 'ascending' | 'descending';
}

export interface LineChartConfig extends BaseChartConfig {
  type: 'line';
  xAxis: string;
  yAxes: string[];
  curved?: boolean;
  showDots?: boolean;
  strokeWidth?: number;
  showArea?: boolean;
}

export interface AreaChartConfig extends BaseChartConfig {
  type: 'area';
  xAxis: string;
  yAxes: string[];
  stacked?: boolean;
  fillOpacity?: number;
  showLine?: boolean;
}

export interface PieChartConfig extends BaseChartConfig {
  type: 'pie' | 'donut';
  categoryColumn: string;
  valueColumn: string;
  innerRadius?: number;
  showLabels?: boolean;
  labelType?: 'percent' | 'value' | 'name';
  centerLabel?: string;
  showTotal?: boolean;
}

export interface ScatterChartConfig extends BaseChartConfig {
  type: 'scatter';
  xAxis: string;
  yAxis: string;
  sizeColumn?: string;
  colorColumn?: string;
  pointSize?: number;
  showTrendline?: boolean;
}

export interface BubbleChartConfig extends BaseChartConfig {
  type: 'bubble';
  xAxis: string;
  yAxis: string;
  sizeColumn: string;
  colorColumn?: string;
  minSize?: number;
  maxSize?: number;
  opacity?: number;
}

export interface BoxPlotConfig extends BaseChartConfig {
  type: 'boxplot';
  categoryColumn: string;
  valueColumn: string;
  orientation?: 'vertical' | 'horizontal';
  showOutliers?: boolean;
  showMean?: boolean;
  whiskerType?: 'iqr' | 'minmax' | 'stddev';
}

export interface HistogramConfig extends BaseChartConfig {
  type: 'histogram';
  valueColumn: string;
  binCount?: number;
  showNormal?: boolean;
  cumulative?: boolean;
}

export interface TreemapConfig extends BaseChartConfig {
  type: 'treemap';
  pathColumns: string[]; // Hierarchy path
  valueColumn: string;
  colorByValue?: boolean;
  showLabels?: boolean;
  labelMinSize?: number;
  padding?: number;
}

export interface SunburstConfig extends BaseChartConfig {
  type: 'sunburst';
  pathColumns: string[];
  valueColumn: string;
  innerRadius?: number;
  showLabels?: boolean;
  highlightAncestors?: boolean;
}

export interface FunnelChartConfig extends BaseChartConfig {
  type: 'funnel';
  categoryColumn: string;
  valueColumn: string;
  orientation?: 'vertical' | 'horizontal';
  showConversion?: boolean;
  showPercentage?: boolean;
  isInverted?: boolean;
}

export interface SankeyConfig extends BaseChartConfig {
  type: 'sankey';
  sourceColumn: string;
  targetColumn: string;
  valueColumn: string;
  nodeWidth?: number;
  nodePadding?: number;
  linkOpacity?: number;
  colorMode?: 'source' | 'target' | 'gradient';
}

export interface NetworkConfig extends BaseChartConfig {
  type: 'network';
  sourceColumn: string;
  targetColumn: string;
  weightColumn?: string;
  nodeSize?: number;
  sizeByConnections?: boolean;
  showLabels?: boolean;
  layout?: 'force' | 'circular' | 'hierarchical';
  linkDistance?: number;
}

export interface ChordConfig extends BaseChartConfig {
  type: 'chord';
  sourceColumn: string;
  targetColumn: string;
  valueColumn: string;
  padAngle?: number;
  showLabels?: boolean;
  ribbonOpacity?: number;
}

export interface WaterfallConfig extends BaseChartConfig {
  type: 'waterfall';
  categoryColumn: string;
  valueColumn: string;
  showTotal?: boolean;
  showSubtotals?: boolean;
  positiveColor?: string;
  negativeColor?: string;
  totalColor?: string;
}

export interface GaugeConfig extends BaseChartConfig {
  type: 'gauge';
  valueColumn: string;
  min?: number;
  max?: number;
  target?: number;
  thresholds?: Array<{ value: number; color: string }>;
  gaugeType?: 'arc' | 'semicircle' | 'full';
  showValue?: boolean;
}

export interface BulletConfig extends BaseChartConfig {
  type: 'bullet';
  categoryColumn: string;
  valueColumn: string;
  targetColumn?: string;
  ranges?: number[];
  rangeColors?: string[];
  orientation?: 'horizontal' | 'vertical';
}

export interface HeatmapConfig extends BaseChartConfig {
  type: 'heatmap';
  xColumn: string;
  yColumn: string;
  valueColumn: string;
  colorScale?: 'sequential' | 'diverging' | 'categorical';
  showValues?: boolean;
  cellRadius?: number;
  cellPadding?: number;
}

export interface RadarConfig extends BaseChartConfig {
  type: 'radar';
  categoryColumn: string;
  metricColumns: string[];
  fillOpacity?: number;
  showDots?: boolean;
  gridType?: 'polygon' | 'circle';
  startAngle?: number;
}

export interface TimelineConfig extends BaseChartConfig {
  type: 'timeline';
  labelColumn: string;
  startColumn: string;
  endColumn: string;
  categoryColumn?: string;
  showMilestones?: boolean;
  showProgress?: boolean;
  groupByCategory?: boolean;
  barHeight?: number;
}

export interface MapConfig extends BaseChartConfig {
  type: 'map';
  regionColumn: string;
  valueColumn: string;
  mapType?: 'world' | 'usa' | 'europe' | 'asia';
  displayMode?: 'choropleth' | 'bubble' | 'both';
  showLabels?: boolean;
  colorScale?: 'sequential' | 'diverging';
  latColumn?: string;
  lonColumn?: string;
}

// Union type for all chart configs
export type ChartConfig =
  | ColumnChartConfig
  | LineChartConfig
  | AreaChartConfig
  | PieChartConfig
  | ScatterChartConfig
  | BubbleChartConfig
  | BoxPlotConfig
  | HistogramConfig
  | TreemapConfig
  | SunburstConfig
  | FunnelChartConfig
  | SankeyConfig
  | NetworkConfig
  | ChordConfig
  | WaterfallConfig
  | GaugeConfig
  | BulletConfig
  | HeatmapConfig
  | RadarConfig
  | TimelineConfig
  | MapConfig
  | BaseChartConfig;

// =============================================================================
// CHART COMPONENT PROPS
// =============================================================================

/**
 * Base props for all chart components
 */
export interface BaseChartProps {
  // Data
  data: Record<string, unknown>[];

  // Configuration
  config: ChartConfig;

  // Global settings override
  settings?: Partial<GlobalChartSettings>;

  // Dimensions
  width?: number | string;
  height?: number | string;

  // Event handlers
  onDataPointClick?: (data: Record<string, unknown>, index: number) => void;
  onDataPointHover?: (data: Record<string, unknown> | null, index: number | null) => void;

  // Render options
  className?: string;
  style?: React.CSSProperties;
}

// =============================================================================
// CHART DATA STRUCTURES
// =============================================================================

/**
 * Prepared data for rendering (after transformation)
 */
export interface PreparedChartData {
  chartType: ChartType;
  data: Record<string, unknown>[];
  xAxisKey?: string;
  yAxisKeys?: string[];
  series?: ChartSeries[];
  metadata?: Record<string, unknown>;
}

/**
 * Series configuration for multi-series charts
 */
export interface ChartSeries {
  key: string;
  name: string;
  color?: string;
  data?: unknown[];
}

/**
 * Hierarchical data node for treemap/sunburst
 */
export interface HierarchyNode {
  name: string;
  value?: number;
  children?: HierarchyNode[];
  path?: string[];
  color?: string;
}

/**
 * Network node and link structures
 */
export interface NetworkNode {
  id: string;
  name: string;
  value?: number;
  group?: string;
  x?: number;
  y?: number;
}

export interface NetworkLink {
  source: string;
  target: string;
  value?: number;
}

export interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

/**
 * Sankey flow data
 */
export interface SankeyNode {
  name: string;
  value?: number;
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

/**
 * Timeline event
 */
export interface TimelineEvent {
  id: string;
  label: string;
  start: Date;
  end: Date;
  category?: string;
  progress?: number;
  color?: string;
}

/**
 * Geographic data point
 */
export interface GeoDataPoint {
  region: string;
  value: number;
  lat?: number;
  lon?: number;
  label?: string;
}

// =============================================================================
// CHART COMPONENT REGISTRY TYPE
// =============================================================================

/**
 * Chart component type for registration
 */
export type ChartComponent = React.ComponentType<BaseChartProps>;

/**
 * Chart renderer function type
 */
export type ChartRenderer = (
  data: Record<string, unknown>[],
  config: ChartConfig,
  settings: GlobalChartSettings
) => React.ReactNode;

// =============================================================================
// DATA TRANSFORMATION TYPES
// =============================================================================

/**
 * Column metadata from query result
 */
export interface ColumnMetadata {
  name: string;
  type: 'numeric' | 'date' | 'text' | 'boolean' | 'unknown';
  dataTypeID?: number;
}

/**
 * Query result structure
 */
export interface QueryResultData {
  rows: Record<string, unknown>[];
  fields: ColumnMetadata[];
  rowCount: number;
}

/**
 * Data transformation result
 */
export interface TransformResult {
  success: boolean;
  data?: PreparedChartData;
  error?: string;
  warnings?: string[];
}
