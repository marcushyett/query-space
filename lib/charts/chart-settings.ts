/**
 * Global Chart Settings
 *
 * This module provides centralized configuration for all chart visualizations.
 * Settings can be overridden at the chart level when needed.
 */

// =============================================================================
// COLOR PALETTES
// =============================================================================

/**
 * Available color palette names
 */
export type ColorPaletteName =
  | 'default'
  | 'vibrant'
  | 'pastel'
  | 'monochrome'
  | 'warm'
  | 'cool'
  | 'categorical'
  | 'sequential'
  | 'diverging';

/**
 * Color palette definitions
 * Each palette contains colors optimized for different visualization needs
 */
export const COLOR_PALETTES: Record<ColorPaletteName, string[]> = {
  // Default palette - balanced, professional colors for general use
  default: [
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
  ],

  // Vibrant palette - high contrast, vivid colors for emphasis
  vibrant: [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Sky Blue
    '#96CEB4', // Sage
    '#FFEAA7', // Light Yellow
    '#DDA0DD', // Plum
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Lavender
    '#85C1E9', // Light Blue
    '#F8B500', // Amber
    '#00CED1', // Dark Cyan
  ],

  // Pastel palette - soft, muted colors for subtle visualizations
  pastel: [
    '#B5EAD7', // Mint
    '#FFB7B2', // Salmon
    '#FFDAC1', // Peach
    '#E2F0CB', // Light Green
    '#C7CEEA', // Periwinkle
    '#F0E6EF', // Lavender
    '#FFF5BA', // Cream
    '#B4F8C8', // Light Mint
    '#FBE7C6', // Sand
    '#A0E7E5', // Aqua
    '#FFAEBC', // Pink
    '#CDB4DB', // Mauve
  ],

  // Monochrome palette - shades of blue for professional reports
  monochrome: [
    '#1a365d', // Dark Blue
    '#2c5282', // Navy
    '#2b6cb0', // Blue
    '#3182ce', // Medium Blue
    '#4299e1', // Light Blue
    '#63b3ed', // Sky Blue
    '#90cdf4', // Pale Blue
    '#bee3f8', // Very Light Blue
    '#0d47a1', // Deep Blue
    '#1565c0', // Royal Blue
    '#1976d2', // Bright Blue
    '#42a5f5', // Soft Blue
  ],

  // Warm palette - reds, oranges, yellows for heat/intensity
  warm: [
    '#ff4d4f', // Red
    '#ff7a45', // Orange Red
    '#ffa940', // Orange
    '#ffc53d', // Gold
    '#ffec3d', // Yellow
    '#faad14', // Amber
    '#fa8c16', // Dark Orange
    '#fa541c', // Vermilion
    '#f5222d', // Crimson
    '#cf1322', // Dark Red
    '#ff85c0', // Pink
    '#eb2f96', // Magenta
  ],

  // Cool palette - blues, greens, purples for calm visualizations
  cool: [
    '#1890ff', // Blue
    '#13c2c2', // Cyan
    '#52c41a', // Green
    '#722ed1', // Purple
    '#2f54eb', // Indigo
    '#36cfc9', // Teal
    '#73d13d', // Lime
    '#9254de', // Violet
    '#597ef7', // Periwinkle
    '#5cdbd3', // Aqua
    '#95de64', // Light Green
    '#b37feb', // Lavender
  ],

  // Categorical palette - maximally distinct colors for categories
  categorical: [
    '#1f77b4', // Blue
    '#ff7f0e', // Orange
    '#2ca02c', // Green
    '#d62728', // Red
    '#9467bd', // Purple
    '#8c564b', // Brown
    '#e377c2', // Pink
    '#7f7f7f', // Gray
    '#bcbd22', // Olive
    '#17becf', // Cyan
    '#aec7e8', // Light Blue
    '#ffbb78', // Light Orange
  ],

  // Sequential palette - for continuous data (low to high)
  sequential: [
    '#f7fbff', // Lightest
    '#deebf7',
    '#c6dbef',
    '#9ecae1',
    '#6baed6',
    '#4292c6',
    '#2171b5',
    '#08519c',
    '#08306b', // Darkest
  ],

  // Diverging palette - for data with meaningful midpoint
  diverging: [
    '#d73027', // Red (low)
    '#f46d43',
    '#fdae61',
    '#fee08b',
    '#ffffbf', // Middle (neutral)
    '#d9ef8b',
    '#a6d96a',
    '#66bd63',
    '#1a9850', // Green (high)
  ],
};

// =============================================================================
// THEME SETTINGS
// =============================================================================

/**
 * Theme mode for charts
 */
export type ThemeMode = 'dark' | 'light';

/**
 * Theme-specific styling
 */
export interface ChartTheme {
  mode: ThemeMode;
  background: string;
  foreground: string;
  gridColor: string;
  axisColor: string;
  labelColor: string;
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipText: string;
}

/**
 * Predefined themes
 */
export const CHART_THEMES: Record<ThemeMode, ChartTheme> = {
  dark: {
    mode: 'dark',
    background: 'transparent',
    foreground: '#ffffff',
    gridColor: '#333333',
    axisColor: '#555555',
    labelColor: '#888888',
    tooltipBackground: '#1f1f1f',
    tooltipBorder: '#333333',
    tooltipText: '#ffffff',
  },
  light: {
    mode: 'light',
    background: 'transparent',
    foreground: '#000000',
    gridColor: '#e0e0e0',
    axisColor: '#cccccc',
    labelColor: '#666666',
    tooltipBackground: '#ffffff',
    tooltipBorder: '#e0e0e0',
    tooltipText: '#333333',
  },
};

// =============================================================================
// GLOBAL CHART SETTINGS
// =============================================================================

/**
 * Global chart configuration settings
 */
export interface GlobalChartSettings {
  // Color settings
  colorPalette: ColorPaletteName;
  customColors?: string[];

  // Theme
  theme: ThemeMode;

  // Typography
  fontFamily: string;
  fontSize: {
    label: number;
    axis: number;
    title: number;
    tooltip: number;
    legend: number;
  };

  // Animation
  animationEnabled: boolean;
  animationDuration: number;

  // Interaction
  tooltipEnabled: boolean;
  legendEnabled: boolean;
  zoomEnabled: boolean;

  // Formatting
  numberFormat: {
    locale: string;
    notation: 'standard' | 'compact' | 'scientific';
    minimumFractionDigits: number;
    maximumFractionDigits: number;
  };
  dateFormat: {
    locale: string;
    style: 'short' | 'medium' | 'long';
  };

  // Layout
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/**
 * Default global settings
 */
export const DEFAULT_CHART_SETTINGS: GlobalChartSettings = {
  colorPalette: 'default',
  theme: 'dark',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: {
    label: 12,
    axis: 11,
    title: 14,
    tooltip: 11,
    legend: 11,
  },
  animationEnabled: true,
  animationDuration: 300,
  tooltipEnabled: true,
  legendEnabled: true,
  zoomEnabled: false,
  numberFormat: {
    locale: 'en-US',
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  },
  dateFormat: {
    locale: 'en-US',
    style: 'short',
  },
  margin: {
    top: 20,
    right: 30,
    bottom: 60,
    left: 60,
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get colors from a palette
 */
export function getColors(
  palette: ColorPaletteName = 'default',
  customColors?: string[]
): string[] {
  if (customColors && customColors.length > 0) {
    return customColors;
  }
  return COLOR_PALETTES[palette] || COLOR_PALETTES.default;
}

/**
 * Get a specific color from palette by index
 */
export function getColor(
  index: number,
  palette: ColorPaletteName = 'default',
  customColors?: string[]
): string {
  const colors = getColors(palette, customColors);
  return colors[index % colors.length];
}

/**
 * Get theme settings
 */
export function getTheme(mode: ThemeMode = 'dark'): ChartTheme {
  return CHART_THEMES[mode];
}

/**
 * Interpolate color for sequential/continuous data
 */
export function interpolateColor(
  value: number,
  min: number,
  max: number,
  palette: ColorPaletteName = 'sequential'
): string {
  const colors = COLOR_PALETTES[palette];
  if (max === min) return colors[Math.floor(colors.length / 2)];

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const index = ratio * (colors.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.min(lowerIndex + 1, colors.length - 1);

  // Simple color interpolation
  if (lowerIndex === upperIndex) return colors[lowerIndex];

  const t = index - lowerIndex;
  const c1 = hexToRgb(colors[lowerIndex]);
  const c2 = hexToRgb(colors[upperIndex]);

  if (!c1 || !c2) return colors[lowerIndex];

  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Get contrasting text color for a background
 */
export function getContrastColor(backgroundColor: string): string {
  const rgb = hexToRgb(backgroundColor);
  if (!rgb) return '#ffffff';

  // Calculate luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Format number according to settings
 */
export function formatChartNumber(
  value: number,
  settings: GlobalChartSettings = DEFAULT_CHART_SETTINGS
): string {
  const { locale, notation, minimumFractionDigits, maximumFractionDigits } = settings.numberFormat;

  return new Intl.NumberFormat(locale, {
    notation,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

/**
 * Format date according to settings
 */
export function formatChartDate(
  value: Date | string | number,
  settings: GlobalChartSettings = DEFAULT_CHART_SETTINGS
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);

  const { locale, style } = settings.dateFormat;

  const options: Intl.DateTimeFormatOptions =
    style === 'short' ? { month: 'short', day: 'numeric' } :
    style === 'medium' ? { month: 'short', day: 'numeric', year: 'numeric' } :
    { month: 'long', day: 'numeric', year: 'numeric' };

  return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * Truncate label to max length
 */
export function truncateChartLabel(value: unknown, maxLength: number = 15): string {
  const str = String(value ?? '');
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 1) + '…';
}
