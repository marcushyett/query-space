/**
 * Chart Registry
 *
 * Central registry of all available chart types with metadata,
 * configuration schemas, and usage guidance for AI agents.
 */

import type { ColorPaletteName, ThemeMode } from './chart-settings';

// =============================================================================
// CHART TYPE DEFINITIONS
// =============================================================================

/**
 * All available chart types
 */
export type ChartType =
  // Basic charts
  | 'column'
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  // Statistical charts
  | 'scatter'
  | 'bubble'
  | 'boxplot'
  | 'histogram'
  // Part-to-whole charts
  | 'treemap'
  | 'sunburst'
  // Flow & relationship charts
  | 'funnel'
  | 'sankey'
  | 'network'
  | 'chord'
  // Trend & comparison charts
  | 'waterfall'
  | 'gauge'
  | 'bullet'
  // Specialized charts
  | 'heatmap'
  | 'radar'
  | 'timeline'
  | 'map'
  | 'none';

/**
 * Chart category for organization
 */
export type ChartCategory =
  | 'basic'
  | 'statistical'
  | 'part-to-whole'
  | 'flow'
  | 'comparison'
  | 'specialized';

/**
 * Data structure requirements for a chart
 */
export interface DataRequirements {
  minRows: number;
  maxRows?: number;
  minNumericColumns: number;
  minCategoryColumns: number;
  minDateColumns?: number;
  supportsMultipleSeries: boolean;
  requiresHierarchy?: boolean;
  requiresSourceTarget?: boolean;
}

/**
 * Configuration option definition
 */
export interface ConfigOption {
  name: string;
  type: 'boolean' | 'string' | 'number' | 'select' | 'color' | 'array';
  description: string;
  default: unknown;
  options?: string[]; // For select type
  min?: number; // For number type
  max?: number;
}

/**
 * Chart type metadata
 */
export interface ChartTypeInfo {
  type: ChartType;
  name: string;
  description: string;
  category: ChartCategory;
  icon: string; // Ant Design icon name

  // When to use this chart
  bestFor: string[];
  notFor: string[];

  // Example use cases for AI
  examples: string[];

  // Data requirements
  dataRequirements: DataRequirements;

  // Available configuration options
  configOptions: ConfigOption[];

  // AI prompt hints
  aiHints: string;
}

// =============================================================================
// CHART REGISTRY
// =============================================================================

/**
 * Complete registry of all chart types with metadata
 */
export const CHART_REGISTRY: Record<ChartType, ChartTypeInfo> = {
  // ---------------------------------------------------------------------------
  // BASIC CHARTS
  // ---------------------------------------------------------------------------

  column: {
    type: 'column',
    name: 'Column Chart',
    description: 'Vertical bars comparing values across categories',
    category: 'basic',
    icon: 'BarChartOutlined',
    bestFor: [
      'Comparing values across categories',
      'Showing rankings or ordered data',
      'Displaying counts or frequencies',
    ],
    notFor: [
      'Time series data (use line instead)',
      'Parts of a whole (use pie/donut)',
      'More than 15 categories',
    ],
    examples: [
      'Sales by region',
      'Product counts by category',
      'Revenue by department',
    ],
    dataRequirements: {
      minRows: 2,
      maxRows: 50,
      minNumericColumns: 1,
      minCategoryColumns: 1,
      supportsMultipleSeries: true,
    },
    configOptions: [
      { name: 'stacked', type: 'boolean', description: 'Stack multiple series', default: false },
      { name: 'showLabels', type: 'boolean', description: 'Show value labels on bars', default: false },
      { name: 'barWidth', type: 'number', description: 'Width of bars (0-1)', default: 0.8, min: 0.1, max: 1 },
      { name: 'sortOrder', type: 'select', description: 'Sort bars', default: 'none', options: ['none', 'ascending', 'descending'] },
    ],
    aiHints: 'Use for category comparisons. Stacked for part-to-whole within categories.',
  },

  bar: {
    type: 'bar',
    name: 'Bar Chart',
    description: 'Horizontal bars for easier label reading with many categories',
    category: 'basic',
    icon: 'BarChartOutlined',
    bestFor: [
      'Long category labels',
      'Ranking comparisons',
      'Mobile-friendly layouts',
    ],
    notFor: [
      'Time series',
      'Few categories (use column)',
    ],
    examples: [
      'Top 10 products by sales',
      'Employee satisfaction by department',
      'Feature usage ranking',
    ],
    dataRequirements: {
      minRows: 2,
      maxRows: 30,
      minNumericColumns: 1,
      minCategoryColumns: 1,
      supportsMultipleSeries: true,
    },
    configOptions: [
      { name: 'stacked', type: 'boolean', description: 'Stack multiple series', default: false },
      { name: 'showLabels', type: 'boolean', description: 'Show value labels', default: true },
      { name: 'barHeight', type: 'number', description: 'Height of bars', default: 20, min: 10, max: 50 },
    ],
    aiHints: 'Prefer over column when labels are long or there are many categories.',
  },

  line: {
    type: 'line',
    name: 'Line Chart',
    description: 'Connected points showing trends over continuous dimension',
    category: 'basic',
    icon: 'LineChartOutlined',
    bestFor: [
      'Time series and trends',
      'Continuous data progression',
      'Comparing multiple trends',
    ],
    notFor: [
      'Categorical comparisons',
      'Single data points',
      'Unordered data',
    ],
    examples: [
      'Daily revenue over time',
      'Monthly user growth',
      'Stock price history',
    ],
    dataRequirements: {
      minRows: 3,
      minNumericColumns: 1,
      minCategoryColumns: 0,
      minDateColumns: 1,
      supportsMultipleSeries: true,
    },
    configOptions: [
      { name: 'curved', type: 'boolean', description: 'Use curved lines', default: true },
      { name: 'showDots', type: 'boolean', description: 'Show data points', default: true },
      { name: 'strokeWidth', type: 'number', description: 'Line thickness', default: 2, min: 1, max: 5 },
      { name: 'showArea', type: 'boolean', description: 'Fill area under line', default: false },
    ],
    aiHints: 'Default choice for any time-based data. Multiple lines for comparison.',
  },

  area: {
    type: 'area',
    name: 'Area Chart',
    description: 'Filled area showing volume or magnitude over time',
    category: 'basic',
    icon: 'AreaChartOutlined',
    bestFor: [
      'Showing volume/magnitude over time',
      'Cumulative totals',
      'Part-to-whole over time (stacked)',
    ],
    notFor: [
      'Precise value reading',
      'Many overlapping series',
    ],
    examples: [
      'Revenue by product over time',
      'Traffic sources breakdown',
      'Cumulative sales',
    ],
    dataRequirements: {
      minRows: 3,
      minNumericColumns: 1,
      minCategoryColumns: 0,
      minDateColumns: 1,
      supportsMultipleSeries: true,
    },
    configOptions: [
      { name: 'stacked', type: 'boolean', description: 'Stack areas', default: true },
      { name: 'fillOpacity', type: 'number', description: 'Area transparency', default: 0.3, min: 0, max: 1 },
      { name: 'showLine', type: 'boolean', description: 'Show line on top', default: true },
    ],
    aiHints: 'Use stacked for composition over time. Single area for emphasis on volume.',
  },

  pie: {
    type: 'pie',
    name: 'Pie Chart',
    description: 'Circular chart showing parts of a whole',
    category: 'basic',
    icon: 'PieChartOutlined',
    bestFor: [
      'Simple part-to-whole relationships',
      'Few categories (2-6)',
      'Percentage breakdowns',
    ],
    notFor: [
      'Many categories',
      'Comparing similar values',
      'Showing changes over time',
    ],
    examples: [
      'Market share distribution',
      'Budget allocation',
      'Survey response breakdown',
    ],
    dataRequirements: {
      minRows: 2,
      maxRows: 10,
      minNumericColumns: 1,
      minCategoryColumns: 1,
      supportsMultipleSeries: false,
    },
    configOptions: [
      { name: 'showLabels', type: 'boolean', description: 'Show percentage labels', default: true },
      { name: 'labelType', type: 'select', description: 'Label format', default: 'percent', options: ['percent', 'value', 'name'] },
      { name: 'startAngle', type: 'number', description: 'Starting angle', default: 90, min: 0, max: 360 },
    ],
    aiHints: 'Only use with few categories. Consider donut for better aesthetics.',
  },

  donut: {
    type: 'donut',
    name: 'Donut Chart',
    description: 'Pie chart with center cutout for additional info',
    category: 'basic',
    icon: 'PieChartOutlined',
    bestFor: [
      'Part-to-whole with center metric',
      'Modern aesthetic preference',
      'Dashboard KPIs with breakdown',
    ],
    notFor: [
      'Many categories',
      'Precise comparisons',
    ],
    examples: [
      'Completion percentage with breakdown',
      'Portfolio allocation',
      'Status distribution',
    ],
    dataRequirements: {
      minRows: 2,
      maxRows: 10,
      minNumericColumns: 1,
      minCategoryColumns: 1,
      supportsMultipleSeries: false,
    },
    configOptions: [
      { name: 'innerRadius', type: 'number', description: 'Inner radius (0-1)', default: 0.5, min: 0.2, max: 0.8 },
      { name: 'centerLabel', type: 'string', description: 'Center label text', default: '' },
      { name: 'showTotal', type: 'boolean', description: 'Show total in center', default: true },
    ],
    aiHints: 'Preferred over pie for modern dashboards. Use center for key metric.',
  },

  // ---------------------------------------------------------------------------
  // STATISTICAL CHARTS
  // ---------------------------------------------------------------------------

  scatter: {
    type: 'scatter',
    name: 'Scatter Plot',
    description: 'Points showing relationship between two numeric variables',
    category: 'statistical',
    icon: 'DotChartOutlined',
    bestFor: [
      'Correlation analysis',
      'Identifying clusters or outliers',
      'Relationship between two metrics',
    ],
    notFor: [
      'Categorical data',
      'Time series',
      'Few data points',
    ],
    examples: [
      'Price vs quantity correlation',
      'Height vs weight distribution',
      'Performance vs experience',
    ],
    dataRequirements: {
      minRows: 10,
      minNumericColumns: 2,
      minCategoryColumns: 0,
      supportsMultipleSeries: true,
    },
    configOptions: [
      { name: 'pointSize', type: 'number', description: 'Point radius', default: 6, min: 2, max: 20 },
      { name: 'showTrendline', type: 'boolean', description: 'Show regression line', default: false },
      { name: 'colorByCategory', type: 'boolean', description: 'Color points by category', default: false },
    ],
    aiHints: 'Use when looking for correlation. Add trendline for regression analysis.',
  },

  bubble: {
    type: 'bubble',
    name: 'Bubble Chart',
    description: 'Scatter plot with size encoding for third dimension',
    category: 'statistical',
    icon: 'DotChartOutlined',
    bestFor: [
      'Three-dimensional comparisons',
      'Market positioning analysis',
      'Adding magnitude to correlations',
    ],
    notFor: [
      'Precise size comparisons',
      'Few data points',
      'Two-variable relationships',
    ],
    examples: [
      'Revenue vs profit with market size',
      'Risk vs return with investment amount',
      'Product price, rating, and sales volume',
    ],
    dataRequirements: {
      minRows: 5,
      minNumericColumns: 3,
      minCategoryColumns: 0,
      supportsMultipleSeries: true,
    },
    configOptions: [
      { name: 'sizeColumn', type: 'string', description: 'Column for bubble size', default: '' },
      { name: 'minSize', type: 'number', description: 'Minimum bubble radius', default: 10, min: 5, max: 30 },
      { name: 'maxSize', type: 'number', description: 'Maximum bubble radius', default: 50, min: 20, max: 100 },
      { name: 'opacity', type: 'number', description: 'Bubble opacity', default: 0.7, min: 0.1, max: 1 },
    ],
    aiHints: 'Extends scatter with size dimension. Ensure size column is meaningful.',
  },

  boxplot: {
    type: 'boxplot',
    name: 'Box Plot',
    description: 'Statistical distribution showing quartiles and outliers',
    category: 'statistical',
    icon: 'BoxPlotOutlined',
    bestFor: [
      'Comparing distributions across groups',
      'Identifying outliers',
      'Statistical summary visualization',
    ],
    notFor: [
      'Small datasets',
      'Non-numeric data',
      'Precise value reading',
    ],
    examples: [
      'Salary distribution by department',
      'Test scores by class',
      'Response times by server',
    ],
    dataRequirements: {
      minRows: 20,
      minNumericColumns: 1,
      minCategoryColumns: 1,
      supportsMultipleSeries: false,
    },
    configOptions: [
      { name: 'orientation', type: 'select', description: 'Chart orientation', default: 'vertical', options: ['vertical', 'horizontal'] },
      { name: 'showOutliers', type: 'boolean', description: 'Display outlier points', default: true },
      { name: 'showMean', type: 'boolean', description: 'Show mean marker', default: false },
      { name: 'whiskerType', type: 'select', description: 'Whisker calculation', default: 'iqr', options: ['iqr', 'minmax', 'stddev'] },
    ],
    aiHints: 'Requires raw data for statistical calculation. Pre-aggregated data won\'t work.',
  },

  histogram: {
    type: 'histogram',
    name: 'Histogram',
    description: 'Distribution of a single numeric variable in bins',
    category: 'statistical',
    icon: 'BarChartOutlined',
    bestFor: [
      'Understanding data distribution',
      'Identifying patterns and skewness',
      'Frequency analysis',
    ],
    notFor: [
      'Categorical data',
      'Comparing across groups',
      'Small datasets',
    ],
    examples: [
      'Age distribution of users',
      'Transaction amount distribution',
      'Response time histogram',
    ],
    dataRequirements: {
      minRows: 30,
      minNumericColumns: 1,
      minCategoryColumns: 0,
      supportsMultipleSeries: false,
    },
    configOptions: [
      { name: 'binCount', type: 'number', description: 'Number of bins', default: 10, min: 5, max: 50 },
      { name: 'showNormal', type: 'boolean', description: 'Overlay normal curve', default: false },
      { name: 'cumulative', type: 'boolean', description: 'Show cumulative distribution', default: false },
    ],
    aiHints: 'Auto-calculates bins from raw data. Adjust binCount based on data range.',
  },

  // ---------------------------------------------------------------------------
  // PART-TO-WHOLE CHARTS
  // ---------------------------------------------------------------------------

  treemap: {
    type: 'treemap',
    name: 'Treemap',
    description: 'Nested rectangles showing hierarchical part-to-whole',
    category: 'part-to-whole',
    icon: 'AppstoreOutlined',
    bestFor: [
      'Hierarchical data with sizes',
      'Space-efficient category display',
      'Budget/portfolio breakdowns',
    ],
    notFor: [
      'Non-hierarchical data',
      'Precise comparisons',
      'Few categories',
    ],
    examples: [
      'Disk space by folder',
      'Revenue by region and product',
      'Organizational budget breakdown',
    ],
    dataRequirements: {
      minRows: 5,
      minNumericColumns: 1,
      minCategoryColumns: 1,
      supportsMultipleSeries: false,
      requiresHierarchy: true,
    },
    configOptions: [
      { name: 'colorByValue', type: 'boolean', description: 'Color by value intensity', default: false },
      { name: 'showLabels', type: 'boolean', description: 'Show category labels', default: true },
      { name: 'labelMinSize', type: 'number', description: 'Min size for label display', default: 30, min: 10, max: 100 },
      { name: 'padding', type: 'number', description: 'Padding between cells', default: 2, min: 0, max: 10 },
    ],
    aiHints: 'Data needs parent-child hierarchy or nested categories. Size = area.',
  },

  sunburst: {
    type: 'sunburst',
    name: 'Sunburst Chart',
    description: 'Radial hierarchical visualization with drill-down',
    category: 'part-to-whole',
    icon: 'PieChartOutlined',
    bestFor: [
      'Multi-level hierarchies',
      'Interactive drill-down analysis',
      'Showing nested proportions',
    ],
    notFor: [
      'Flat data',
      'Many levels (>4)',
      'Precise comparisons',
    ],
    examples: [
      'File system visualization',
      'Organizational structure',
      'Category > subcategory > product',
    ],
    dataRequirements: {
      minRows: 5,
      minNumericColumns: 1,
      minCategoryColumns: 2,
      supportsMultipleSeries: false,
      requiresHierarchy: true,
    },
    configOptions: [
      { name: 'innerRadius', type: 'number', description: 'Center hole size', default: 0.2, min: 0, max: 0.5 },
      { name: 'showLabels', type: 'boolean', description: 'Show segment labels', default: true },
      { name: 'highlightAncestors', type: 'boolean', description: 'Highlight path on hover', default: true },
    ],
    aiHints: 'Needs hierarchical path columns (parent → child). Interactive by default.',
  },

  // ---------------------------------------------------------------------------
  // FLOW & RELATIONSHIP CHARTS
  // ---------------------------------------------------------------------------

  funnel: {
    type: 'funnel',
    name: 'Funnel Chart',
    description: 'Stages showing conversion or drop-off progression',
    category: 'flow',
    icon: 'FunnelPlotOutlined',
    bestFor: [
      'Conversion funnel analysis',
      'Sales pipeline stages',
      'Process drop-off visualization',
    ],
    notFor: [
      'Non-sequential data',
      'Categories without natural order',
      'Many stages (>8)',
    ],
    examples: [
      'Website conversion funnel',
      'Sales pipeline stages',
      'Recruitment process',
    ],
    dataRequirements: {
      minRows: 3,
      maxRows: 10,
      minNumericColumns: 1,
      minCategoryColumns: 1,
      supportsMultipleSeries: false,
    },
    configOptions: [
      { name: 'orientation', type: 'select', description: 'Funnel orientation', default: 'vertical', options: ['vertical', 'horizontal'] },
      { name: 'showConversion', type: 'boolean', description: 'Show conversion rates', default: true },
      { name: 'showPercentage', type: 'boolean', description: 'Show percentage labels', default: true },
      { name: 'isInverted', type: 'boolean', description: 'Pyramid style (inverted)', default: false },
    ],
    aiHints: 'Data should be ordered by stage. Values should decrease (or increase for pyramid).',
  },

  sankey: {
    type: 'sankey',
    name: 'Sankey Diagram',
    description: 'Flow between nodes with width proportional to quantity',
    category: 'flow',
    icon: 'BranchesOutlined',
    bestFor: [
      'Flow analysis between categories',
      'Energy/resource transfers',
      'User journey mapping',
    ],
    notFor: [
      'Circular flows',
      'Simple two-category comparisons',
      'Non-flow data',
    ],
    examples: [
      'Traffic source to conversion path',
      'Budget allocation flow',
      'Material flow in manufacturing',
    ],
    dataRequirements: {
      minRows: 3,
      minNumericColumns: 1,
      minCategoryColumns: 2,
      supportsMultipleSeries: false,
      requiresSourceTarget: true,
    },
    configOptions: [
      { name: 'nodeWidth', type: 'number', description: 'Width of nodes', default: 15, min: 5, max: 30 },
      { name: 'nodePadding', type: 'number', description: 'Vertical padding', default: 10, min: 0, max: 30 },
      { name: 'linkOpacity', type: 'number', description: 'Flow transparency', default: 0.5, min: 0.1, max: 1 },
      { name: 'colorMode', type: 'select', description: 'Coloring mode', default: 'source', options: ['source', 'target', 'gradient'] },
    ],
    aiHints: 'Needs source, target, and value columns. Multi-level flows supported.',
  },

  network: {
    type: 'network',
    name: 'Network Graph',
    description: 'Nodes and edges showing relationships',
    category: 'flow',
    icon: 'DeploymentUnitOutlined',
    bestFor: [
      'Relationship networks',
      'Social connections',
      'System dependencies',
    ],
    notFor: [
      'Sequential data',
      'Large networks (>100 nodes)',
      'Non-relational data',
    ],
    examples: [
      'Social network connections',
      'API dependency graph',
      'Knowledge graph visualization',
    ],
    dataRequirements: {
      minRows: 3,
      minNumericColumns: 0,
      minCategoryColumns: 2,
      supportsMultipleSeries: false,
      requiresSourceTarget: true,
    },
    configOptions: [
      { name: 'nodeSize', type: 'number', description: 'Default node size', default: 10, min: 5, max: 30 },
      { name: 'sizeByConnections', type: 'boolean', description: 'Size nodes by connections', default: true },
      { name: 'showLabels', type: 'boolean', description: 'Show node labels', default: true },
      { name: 'layout', type: 'select', description: 'Layout algorithm', default: 'force', options: ['force', 'circular', 'hierarchical'] },
      { name: 'linkDistance', type: 'number', description: 'Target link distance', default: 100, min: 30, max: 300 },
    ],
    aiHints: 'Needs source-target pairs. Optional value for edge weight.',
  },

  chord: {
    type: 'chord',
    name: 'Chord Diagram',
    description: 'Circular layout showing inter-relationships',
    category: 'flow',
    icon: 'RadarChartOutlined',
    bestFor: [
      'Matrix-style relationships',
      'Bidirectional flows',
      'Comparing relative connections',
    ],
    notFor: [
      'Unidirectional flows',
      'Large matrices',
      'Hierarchical data',
    ],
    examples: [
      'Trade between countries',
      'Communication patterns',
      'Skill overlap between teams',
    ],
    dataRequirements: {
      minRows: 3,
      minNumericColumns: 1,
      minCategoryColumns: 2,
      supportsMultipleSeries: false,
      requiresSourceTarget: true,
    },
    configOptions: [
      { name: 'padAngle', type: 'number', description: 'Gap between segments', default: 0.02, min: 0, max: 0.1 },
      { name: 'showLabels', type: 'boolean', description: 'Show segment labels', default: true },
      { name: 'ribbonOpacity', type: 'number', description: 'Ribbon transparency', default: 0.7, min: 0.1, max: 1 },
    ],
    aiHints: 'Matrix-format data (source, target, value). Best for 5-15 categories.',
  },

  // ---------------------------------------------------------------------------
  // COMPARISON CHARTS
  // ---------------------------------------------------------------------------

  waterfall: {
    type: 'waterfall',
    name: 'Waterfall Chart',
    description: 'Cumulative effect of sequential positive and negative values',
    category: 'comparison',
    icon: 'StockOutlined',
    bestFor: [
      'Financial breakdowns',
      'Variance analysis',
      'Sequential changes',
    ],
    notFor: [
      'Non-sequential data',
      'All positive/negative values',
      'Trend visualization',
    ],
    examples: [
      'Profit and loss breakdown',
      'Budget variance analysis',
      'Inventory changes',
    ],
    dataRequirements: {
      minRows: 3,
      maxRows: 15,
      minNumericColumns: 1,
      minCategoryColumns: 1,
      supportsMultipleSeries: false,
    },
    configOptions: [
      { name: 'showTotal', type: 'boolean', description: 'Show final total bar', default: true },
      { name: 'showSubtotals', type: 'boolean', description: 'Show intermediate totals', default: false },
      { name: 'positiveColor', type: 'color', description: 'Color for increases', default: '#52c41a' },
      { name: 'negativeColor', type: 'color', description: 'Color for decreases', default: '#ff4d4f' },
      { name: 'totalColor', type: 'color', description: 'Color for total bars', default: '#1890ff' },
    ],
    aiHints: 'Values are incremental changes, not cumulative. System calculates running total.',
  },

  gauge: {
    type: 'gauge',
    name: 'Gauge Chart',
    description: 'Single metric against a scale with optional target',
    category: 'comparison',
    icon: 'DashboardOutlined',
    bestFor: [
      'KPI dashboards',
      'Progress indicators',
      'Performance vs target',
    ],
    notFor: [
      'Multiple values',
      'Trend data',
      'Detailed analysis',
    ],
    examples: [
      'Sales quota completion',
      'System health score',
      'Customer satisfaction index',
    ],
    dataRequirements: {
      minRows: 1,
      maxRows: 1,
      minNumericColumns: 1,
      minCategoryColumns: 0,
      supportsMultipleSeries: false,
    },
    configOptions: [
      { name: 'min', type: 'number', description: 'Minimum scale value', default: 0 },
      { name: 'max', type: 'number', description: 'Maximum scale value', default: 100 },
      { name: 'target', type: 'number', description: 'Target value to show', default: null },
      { name: 'thresholds', type: 'array', description: 'Color zones [value, color]', default: [] },
      { name: 'gaugeType', type: 'select', description: 'Gauge style', default: 'arc', options: ['arc', 'semicircle', 'full'] },
      { name: 'showValue', type: 'boolean', description: 'Display current value', default: true },
    ],
    aiHints: 'Single value only. Set thresholds for red/yellow/green zones.',
  },

  bullet: {
    type: 'bullet',
    name: 'Bullet Chart',
    description: 'Compact KPI with qualitative ranges and target',
    category: 'comparison',
    icon: 'AimOutlined',
    bestFor: [
      'Compact KPI display',
      'Performance vs benchmark',
      'Space-constrained dashboards',
    ],
    notFor: [
      'Detailed data',
      'Multiple metrics without grouping',
      'Trend visualization',
    ],
    examples: [
      'Revenue vs target with ranges',
      'Performance score with thresholds',
      'Multiple KPIs comparison',
    ],
    dataRequirements: {
      minRows: 1,
      maxRows: 10,
      minNumericColumns: 1,
      minCategoryColumns: 1,
      supportsMultipleSeries: true,
    },
    configOptions: [
      { name: 'targetColumn', type: 'string', description: 'Column for target value', default: '' },
      { name: 'ranges', type: 'array', description: 'Qualitative ranges', default: [0.6, 0.8, 1] },
      { name: 'rangeColors', type: 'array', description: 'Range colors', default: ['#e0e0e0', '#c0c0c0', '#a0a0a0'] },
      { name: 'orientation', type: 'select', description: 'Layout direction', default: 'horizontal', options: ['horizontal', 'vertical'] },
    ],
    aiHints: 'Need value column, optional target column. Ranges as percentages of max.',
  },

  // ---------------------------------------------------------------------------
  // SPECIALIZED CHARTS
  // ---------------------------------------------------------------------------

  heatmap: {
    type: 'heatmap',
    name: 'Heatmap',
    description: 'Color-coded matrix showing value intensity',
    category: 'specialized',
    icon: 'HeatMapOutlined',
    bestFor: [
      'Correlation matrices',
      'Time-based patterns (day/hour)',
      'Two-dimensional comparisons',
    ],
    notFor: [
      'Single dimension data',
      'Precise value reading',
      'Many categories',
    ],
    examples: [
      'Activity by day and hour',
      'Sales by region and product',
      'Feature correlation matrix',
    ],
    dataRequirements: {
      minRows: 4,
      minNumericColumns: 1,
      minCategoryColumns: 2,
      supportsMultipleSeries: false,
    },
    configOptions: [
      { name: 'colorScale', type: 'select', description: 'Color palette', default: 'sequential', options: ['sequential', 'diverging', 'categorical'] },
      { name: 'showValues', type: 'boolean', description: 'Display values in cells', default: false },
      { name: 'cellRadius', type: 'number', description: 'Cell corner radius', default: 2, min: 0, max: 10 },
      { name: 'cellPadding', type: 'number', description: 'Gap between cells', default: 1, min: 0, max: 5 },
    ],
    aiHints: 'Needs X category, Y category, and value. Use diverging scale for +/- data.',
  },

  radar: {
    type: 'radar',
    name: 'Radar Chart',
    description: 'Multi-dimensional comparison on radial axes',
    category: 'specialized',
    icon: 'RadarChartOutlined',
    bestFor: [
      'Multi-attribute comparison',
      'Performance profiles',
      'Skill assessments',
    ],
    notFor: [
      'Many items (>10)',
      'Precise comparisons',
      'Sequential data',
    ],
    examples: [
      'Product feature comparison',
      'Employee skill profile',
      'Team performance metrics',
    ],
    dataRequirements: {
      minRows: 3,
      maxRows: 15,
      minNumericColumns: 3,
      minCategoryColumns: 1,
      supportsMultipleSeries: true,
    },
    configOptions: [
      { name: 'fillOpacity', type: 'number', description: 'Area fill transparency', default: 0.3, min: 0, max: 1 },
      { name: 'showDots', type: 'boolean', description: 'Show data points', default: true },
      { name: 'gridType', type: 'select', description: 'Grid line style', default: 'polygon', options: ['polygon', 'circle'] },
      { name: 'startAngle', type: 'number', description: 'Starting angle', default: 90, min: 0, max: 360 },
    ],
    aiHints: 'Metrics as columns, subjects as rows. Normalize values to same scale.',
  },

  timeline: {
    type: 'timeline',
    name: 'Timeline / Gantt',
    description: 'Events or tasks over time with duration',
    category: 'specialized',
    icon: 'CalendarOutlined',
    bestFor: [
      'Project schedules',
      'Event sequences',
      'Process timelines',
    ],
    notFor: [
      'Point-in-time data',
      'Non-temporal sequences',
      'Precise value comparisons',
    ],
    examples: [
      'Project task schedule',
      'Event timeline',
      'Process stages over time',
    ],
    dataRequirements: {
      minRows: 2,
      minNumericColumns: 0,
      minCategoryColumns: 1,
      minDateColumns: 2,
      supportsMultipleSeries: true,
    },
    configOptions: [
      { name: 'showMilestones', type: 'boolean', description: 'Highlight milestones', default: true },
      { name: 'showProgress', type: 'boolean', description: 'Show completion %', default: false },
      { name: 'groupByCategory', type: 'boolean', description: 'Group rows by category', default: true },
      { name: 'barHeight', type: 'number', description: 'Height of bars', default: 20, min: 10, max: 40 },
    ],
    aiHints: 'Need start date, end date, and label. Optional category for grouping.',
  },

  map: {
    type: 'map',
    name: 'Geographic Map',
    description: 'Choropleth or bubble map for geographic data',
    category: 'specialized',
    icon: 'GlobalOutlined',
    bestFor: [
      'Regional comparisons',
      'Geographic distributions',
      'Location-based metrics',
    ],
    notFor: [
      'Non-geographic data',
      'Detailed local areas',
      'Precise value comparisons',
    ],
    examples: [
      'Sales by country',
      'Population by state',
      'Store locations with revenue',
    ],
    dataRequirements: {
      minRows: 3,
      minNumericColumns: 1,
      minCategoryColumns: 1,
      supportsMultipleSeries: false,
    },
    configOptions: [
      { name: 'mapType', type: 'select', description: 'Map projection', default: 'world', options: ['world', 'usa', 'europe', 'asia'] },
      { name: 'displayMode', type: 'select', description: 'Visualization type', default: 'choropleth', options: ['choropleth', 'bubble', 'both'] },
      { name: 'showLabels', type: 'boolean', description: 'Show region labels', default: false },
      { name: 'colorScale', type: 'select', description: 'Color scheme', default: 'sequential', options: ['sequential', 'diverging'] },
    ],
    aiHints: 'Need region name (country/state) and value. Use ISO codes for best matching.',
  },

  none: {
    type: 'none',
    name: 'No Chart',
    description: 'Data cannot be visualized as a chart',
    category: 'basic',
    icon: 'CloseCircleOutlined',
    bestFor: [],
    notFor: ['Any visualization'],
    examples: [],
    dataRequirements: {
      minRows: 0,
      minNumericColumns: 0,
      minCategoryColumns: 0,
      supportsMultipleSeries: false,
    },
    configOptions: [],
    aiHints: 'Return this when data is not suitable for visualization.',
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get chart info by type
 */
export function getChartInfo(type: ChartType): ChartTypeInfo {
  return CHART_REGISTRY[type] || CHART_REGISTRY.none;
}

/**
 * Get charts by category
 */
export function getChartsByCategory(category: ChartCategory): ChartTypeInfo[] {
  return Object.values(CHART_REGISTRY).filter(c => c.category === category);
}

/**
 * Get all chart types
 */
export function getAllChartTypes(): ChartType[] {
  return Object.keys(CHART_REGISTRY).filter(t => t !== 'none') as ChartType[];
}

/**
 * Check if data meets chart requirements
 */
export function meetsRequirements(
  type: ChartType,
  rowCount: number,
  numericColumns: number,
  categoryColumns: number,
  dateColumns: number = 0
): boolean {
  const info = CHART_REGISTRY[type];
  if (!info) return false;

  const { dataRequirements: req } = info;

  if (rowCount < req.minRows) return false;
  if (req.maxRows && rowCount > req.maxRows) return false;
  if (numericColumns < req.minNumericColumns) return false;
  if (categoryColumns < req.minCategoryColumns) return false;
  if (req.minDateColumns && dateColumns < req.minDateColumns) return false;

  return true;
}

/**
 * Suggest best chart type for data
 */
export function suggestChartType(
  rowCount: number,
  numericColumns: number,
  categoryColumns: number,
  dateColumns: number,
  hasHierarchy: boolean = false,
  hasSourceTarget: boolean = false
): ChartType {
  // Hierarchical data
  if (hasHierarchy && categoryColumns >= 2) {
    return rowCount > 20 ? 'treemap' : 'sunburst';
  }

  // Flow/network data
  if (hasSourceTarget) {
    if (numericColumns >= 1) return 'sankey';
    return 'network';
  }

  // Scatter/bubble: multiple numeric, no categories
  if (numericColumns >= 2 && categoryColumns === 0 && dateColumns === 0) {
    return numericColumns >= 3 ? 'bubble' : 'scatter';
  }

  // Time series
  if (dateColumns >= 1 && numericColumns >= 1) {
    return 'line';
  }

  // Single value
  if (rowCount === 1 && numericColumns >= 1) {
    return 'gauge';
  }

  // Heatmap: 2 categories + numeric
  if (categoryColumns >= 2 && numericColumns >= 1 && rowCount >= 4) {
    return 'heatmap';
  }

  // Few categories with value: pie/donut
  if (categoryColumns === 1 && numericColumns === 1 && rowCount <= 10) {
    return 'donut';
  }

  // Default: column chart
  return 'column';
}

/**
 * Generate AI prompt hints for chart selection
 */
export function generateChartSelectionPrompt(): string {
  const categories = ['basic', 'statistical', 'part-to-whole', 'flow', 'comparison', 'specialized'] as const;

  let prompt = '## Chart Type Selection Guide\n\n';

  for (const category of categories) {
    const charts = getChartsByCategory(category);
    prompt += `### ${category.charAt(0).toUpperCase() + category.slice(1)} Charts\n\n`;

    for (const chart of charts) {
      if (chart.type === 'none') continue;
      prompt += `**${chart.name}** (\`${chart.type}\`)\n`;
      prompt += `- Best for: ${chart.bestFor.slice(0, 2).join(', ')}\n`;
      prompt += `- ${chart.aiHints}\n\n`;
    }
  }

  return prompt;
}
