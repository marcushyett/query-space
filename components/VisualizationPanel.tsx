'use client';

import { useState, useMemo, useCallback } from 'react';
import { Typography, Empty, Button, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useUiStore } from '@/stores/uiStore';
import { ColumnChart } from './ColumnChart';
import { BarChart } from './BarChart';
import { LineChart } from './LineChart';
import { AreaChart } from './AreaChart';
import { PieChart } from './PieChart';
import { DonutChart } from './DonutChart';
import { ScatterChart } from './ScatterChart';
import { FunnelChart } from './FunnelChart';
import { WaterfallChart } from './WaterfallChart';
import { HeatmapChart } from './HeatmapChart';
import { RadarChart } from './RadarChart';
import { ChartSelector } from './ChartSelector';
// Advanced charts
import { MapChart } from './charts/MapChart';
import { TreemapChart } from './charts/TreemapChart';
import { SunburstChart } from './charts/SunburstChart';
import { SankeyChart } from './charts/SankeyChart';
import { NetworkChart } from './charts/NetworkChart';
import { GaugeChart } from './charts/GaugeChart';
import { BubbleChart } from './charts/BubbleChart';
import { HistogramChart } from './charts/HistogramChart';
import { BoxPlotChart } from './charts/BoxPlotChart';
import { TimelineChart } from './charts/TimelineChart';
import {
  isChartable,
  suggestChartConfig,
  prepareChartData,
  prepareScatterData,
  prepareFunnelData,
  prepareWaterfallData,
  prepareHeatmapData,
  prepareRadarData,
  prepareBubbleData,
  prepareHistogramData,
  prepareTreemapData,
  prepareGaugeData,
  prepareMapData,
  isNumericType,
  isDateType,
  isTextType,
  getBreakdownColumns,
  type ChartConfig,
} from '@/lib/chart-utils';
import type { QueryResult } from '@/stores/queryStore';

const { Text } = Typography;

interface VisualizationPanelProps {
  queryResult: QueryResult | null;
}

// Helper to create a stable identity key for a query result
function getResultKey(result: QueryResult | null): string {
  if (!result) return '';
  return `${result.rowCount}-${result.fields.map(f => f.name).join(',')}`;
}

export function VisualizationPanel({ queryResult }: VisualizationPanelProps) {
  // Track result changes via key to reset user modifications
  const [lastResultKey, setLastResultKey] = useState('');
  const [userModifiedConfig, setUserModifiedConfig] = useState<ChartConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { currentQueryId } = useUiStore();

  // Compute default config from query result
  const defaultConfig = useMemo((): ChartConfig => {
    if (queryResult && isChartable(queryResult)) {
      return suggestChartConfig(queryResult);
    }
    return { type: 'column', xAxis: null, yAxes: [], stacked: false, breakdownBy: null };
  }, [queryResult]);

  // Get current result key
  const currentResultKey = getResultKey(queryResult);

  // Reset user modifications when result changes
  const chartConfig = useMemo(() => {
    if (currentResultKey !== lastResultKey) {
      // Result changed, use default
      return defaultConfig;
    }
    // Use user modified config if available
    return userModifiedConfig ?? defaultConfig;
  }, [currentResultKey, lastResultKey, userModifiedConfig, defaultConfig]);

  // Handle config changes from user
  const handleConfigChange = useCallback((newConfig: ChartConfig) => {
    setLastResultKey(currentResultKey);
    setUserModifiedConfig(newConfig);
  }, [currentResultKey]);

  // Handle saving chart to database
  const handleSaveChart = useCallback(async () => {
    if (!currentQueryId || currentQueryId === 'new') {
      message.warning('Please save the query first before saving a chart');
      return;
    }

    if (!chartConfig.xAxis || chartConfig.yAxes.length === 0) {
      message.warning('Please configure the chart before saving');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/queries/${currentQueryId}/charts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: null, // User can set title later if needed
          type: chartConfig.type,
          config: {
            xAxis: chartConfig.xAxis,
            yAxes: chartConfig.yAxes,
            stacked: chartConfig.stacked,
            breakdownBy: chartConfig.breakdownBy,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save chart');
      }

      message.success('Chart saved! You can now add it to dashboards.');
    } catch (err) {
      console.error('Failed to save chart:', err);
      message.error(err instanceof Error ? err.message : 'Failed to save chart');
    } finally {
      setIsSaving(false);
    }
  }, [currentQueryId, chartConfig]);

  // Get available columns for selectors
  const availableColumns = useMemo(() => {
    if (!queryResult) return [];
    return queryResult.fields.map((f) => f.name);
  }, [queryResult]);

  const numericColumns = useMemo(() => {
    if (!queryResult) return [];
    return queryResult.fields
      .filter((f) => isNumericType(f.dataTypeID))
      .map((f) => f.name);
  }, [queryResult]);

  const textColumns = useMemo(() => {
    if (!queryResult) return [];
    return queryResult.fields
      .filter((f) => isTextType(f.dataTypeID))
      .map((f) => f.name);
  }, [queryResult]);

  const dateColumns = useMemo(() => {
    if (!queryResult) return [];
    return queryResult.fields
      .filter((f) => isDateType(f.dataTypeID))
      .map((f) => f.name);
  }, [queryResult]);

  // Get breakdown columns
  const breakdownColumns = useMemo(() => {
    if (!queryResult) return [];
    return getBreakdownColumns(queryResult, chartConfig.xAxis);
  }, [queryResult, chartConfig.xAxis]);

  // Check if X-axis is a date column
  const isDateXAxis = useMemo(() => {
    if (!queryResult || !chartConfig.xAxis) return false;
    const field = queryResult.fields.find((f) => f.name === chartConfig.xAxis);
    return field ? isDateType(field.dataTypeID) : false;
  }, [queryResult, chartConfig.xAxis]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!queryResult) return null;
    return prepareChartData(queryResult, chartConfig);
  }, [queryResult, chartConfig]);

  // Check if we can show a chart
  const canChart = isChartable(queryResult);

  if (!queryResult) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#666' }}>
        <Text type="secondary">Execute a query to visualize results</Text>
      </div>
    );
  }

  if (!canChart) {
    // Determine specific reason why charting isn't available
    let reason = 'This query result cannot be visualized.';
    let suggestions: string[] = [];

    if (queryResult.rows.length === 0) {
      reason = 'No data to visualize.';
      suggestions = ['Run a query that returns data'];
    } else if (queryResult.fields.length < 2) {
      reason = 'Need at least 2 columns to create a chart.';
      suggestions = [
        'Add more columns to your SELECT statement',
        'Example: SELECT category, COUNT(*) FROM table GROUP BY category'
      ];
    } else {
      const hasNumeric = queryResult.fields.some(f => isNumericType(f.dataTypeID));
      if (!hasNumeric) {
        reason = 'No numeric columns found for chart values.';
        suggestions = [
          'Add a numeric column using COUNT(), SUM(), AVG(), etc.',
          'Example: SELECT name, COUNT(*) as count FROM table GROUP BY name',
          'Or select existing numeric columns (integers, decimals)'
        ];
      }
    }

    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Empty
          description={
            <div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                {reason}
              </Text>
              {suggestions.length > 0 && (
                <div style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Tips:</Text>
                  <ul style={{ paddingLeft: 20, margin: '4px 0 0 0', textAlign: 'left' }}>
                    {suggestions.map((tip, i) => (
                      <li key={i} style={{ color: '#666', fontSize: 12 }}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          }
        />
      </div>
    );
  }

  const renderChart = () => {
    // Handle special chart types that need different data preparation

    // Scatter chart
    if (chartConfig.type === 'scatter' && queryResult) {
      const scatterData = prepareScatterData(queryResult, chartConfig);
      if (!scatterData) {
        return (
          <Empty
            description={
              <Text type="secondary">
                Select X and Y axes (both numeric) for scatter plot
              </Text>
            }
          />
        );
      }
      return (
        <ScatterChart
          data={scatterData.data}
          xAxisKey={scatterData.xKey}
          yAxisKey={scatterData.yKey}
          sizeKey={scatterData.sizeKey}
          colorKey={scatterData.colorKey}
        />
      );
    }

    // Bubble chart
    if (chartConfig.type === 'bubble' && queryResult) {
      const bubbleData = prepareBubbleData(queryResult, chartConfig);
      if (!bubbleData) {
        return (
          <Empty
            description={
              <Text type="secondary">
                Select X, Y, and size columns for bubble chart
              </Text>
            }
          />
        );
      }
      return (
        <BubbleChart
          data={bubbleData.data}
          xColumn={bubbleData.xColumn}
          yColumn={bubbleData.yColumn}
          sizeColumn={bubbleData.sizeColumn}
          colorColumn={bubbleData.colorColumn}
        />
      );
    }

    // Histogram chart
    if (chartConfig.type === 'histogram' && queryResult) {
      const histogramData = prepareHistogramData(queryResult, chartConfig);
      if (!histogramData) {
        return (
          <Empty
            description={
              <Text type="secondary">
                Select a numeric column for histogram
              </Text>
            }
          />
        );
      }
      return (
        <HistogramChart
          data={histogramData.data}
          valueColumn={histogramData.valueColumn}
          binCount={chartConfig.binCount}
          showNormal={chartConfig.showNormal}
          cumulative={chartConfig.cumulative}
        />
      );
    }

    // Box Plot chart
    if (chartConfig.type === 'boxplot' && queryResult) {
      if (!chartConfig.xAxis || chartConfig.yAxes.length === 0) {
        return (
          <Empty
            description={
              <Text type="secondary">
                Select category and value columns for box plot
              </Text>
            }
          />
        );
      }
      return (
        <BoxPlotChart
          data={queryResult.rows}
          categoryColumn={chartConfig.xAxis}
          valueColumn={chartConfig.yAxes[0]}
          showOutliers={chartConfig.showOutliers}
          showMean={chartConfig.showMean}
          whiskerType={chartConfig.whiskerType}
        />
      );
    }

    // Funnel chart
    if (chartConfig.type === 'funnel' && queryResult) {
      const funnelData = prepareFunnelData(queryResult, chartConfig);
      if (!funnelData) {
        return (
          <Empty
            description={
              <Text type="secondary">
                Select category and value columns for funnel chart
              </Text>
            }
          />
        );
      }
      return (
        <FunnelChart
          data={funnelData.data}
          showPercentage={chartConfig.showPercentage}
        />
      );
    }

    // Waterfall chart
    if (chartConfig.type === 'waterfall' && queryResult) {
      const waterfallData = prepareWaterfallData(queryResult, chartConfig);
      if (!waterfallData) {
        return (
          <Empty
            description={
              <Text type="secondary">
                Select category and value columns for waterfall chart
              </Text>
            }
          />
        );
      }
      return <WaterfallChart data={waterfallData.data} />;
    }

    // Heatmap chart
    if (chartConfig.type === 'heatmap' && queryResult) {
      const heatmapData = prepareHeatmapData(queryResult, chartConfig);
      if (!heatmapData) {
        return (
          <Empty
            description={
              <Text type="secondary">
                Select X-axis, Y-axis, and value columns for heatmap
              </Text>
            }
          />
        );
      }
      return (
        <HeatmapChart
          data={heatmapData.data}
          xValues={heatmapData.xValues}
          yValues={heatmapData.yValues}
          minValue={heatmapData.minValue}
          maxValue={heatmapData.maxValue}
        />
      );
    }

    // Radar chart
    if (chartConfig.type === 'radar' && queryResult) {
      const radarData = prepareRadarData(queryResult, chartConfig);
      if (!radarData) {
        return (
          <Empty
            description={
              <Text type="secondary">
                Select subject column and metrics for radar chart
              </Text>
            }
          />
        );
      }
      return (
        <RadarChart
          data={radarData.data}
          subjectKey="subject"
          series={radarData.series}
        />
      );
    }

    // Treemap chart
    if (chartConfig.type === 'treemap' && queryResult) {
      const treemapData = prepareTreemapData(queryResult, chartConfig);
      if (!treemapData) {
        return (
          <Empty
            description={
              <Text type="secondary">
                Select category and value columns for treemap
              </Text>
            }
          />
        );
      }
      return (
        <TreemapChart
          data={treemapData.data}
          pathColumns={treemapData.pathColumns}
          valueColumn={treemapData.valueColumn}
          colorByValue={chartConfig.colorByValue}
          showLabels={chartConfig.showLabels}
          labelMinSize={chartConfig.labelMinSize}
        />
      );
    }

    // Sunburst chart
    if (chartConfig.type === 'sunburst' && queryResult) {
      const sunburstData = prepareTreemapData(queryResult, chartConfig);
      if (!sunburstData) {
        return (
          <Empty
            description={
              <Text type="secondary">
                Select hierarchy columns and value for sunburst
              </Text>
            }
          />
        );
      }
      return (
        <SunburstChart
          data={sunburstData.data}
          pathColumns={sunburstData.pathColumns}
          valueColumn={sunburstData.valueColumn}
          showLabels={chartConfig.showLabels}
          highlightAncestors={chartConfig.highlightAncestors}
        />
      );
    }

    // Sankey chart
    if (chartConfig.type === 'sankey' && queryResult) {
      // Auto-detect source/target columns if not set
      const sourceCol = chartConfig.sourceColumn || textColumns[0];
      const targetCol = chartConfig.targetColumn || textColumns[1];
      const valueCol = chartConfig.yAxes[0] || numericColumns[0];

      if (!sourceCol || !targetCol || !valueCol) {
        return (
          <Empty
            description={
              <Text type="secondary">
                Need source, target, and value columns for Sankey diagram
              </Text>
            }
          />
        );
      }
      return (
        <SankeyChart
          data={queryResult.rows}
          sourceColumn={sourceCol}
          targetColumn={targetCol}
          valueColumn={valueCol}
          nodeWidth={chartConfig.nodeWidth}
          nodePadding={chartConfig.nodePadding}
          linkOpacity={chartConfig.linkOpacity}
          colorMode={chartConfig.colorMode}
        />
      );
    }

    // Network chart
    if (chartConfig.type === 'network' && queryResult) {
      // Auto-detect source/target columns if not set
      const sourceCol = chartConfig.sourceColumn || textColumns[0];
      const targetCol = chartConfig.targetColumn || textColumns[1];

      if (!sourceCol || !targetCol) {
        return (
          <Empty
            description={
              <Text type="secondary">
                Need source and target columns for network graph
              </Text>
            }
          />
        );
      }
      return (
        <NetworkChart
          data={queryResult.rows}
          sourceColumn={sourceCol}
          targetColumn={targetCol}
          weightColumn={chartConfig.weightColumn || (numericColumns.length > 0 ? numericColumns[0] : undefined)}
          nodeSize={chartConfig.nodeSize}
          sizeByConnections={chartConfig.sizeByConnections}
          showLabels={chartConfig.showLabels}
          layout={chartConfig.layout}
          linkDistance={chartConfig.linkDistance}
        />
      );
    }

    // Gauge chart
    if (chartConfig.type === 'gauge' && queryResult) {
      const gaugeData = prepareGaugeData(queryResult, chartConfig);
      if (!gaugeData) {
        return (
          <Empty
            description={
              <Text type="secondary">
                Select a value column for gauge
              </Text>
            }
          />
        );
      }
      return (
        <GaugeChart
          value={gaugeData.value}
          min={gaugeData.min}
          max={gaugeData.max}
          target={gaugeData.target}
          label={gaugeData.label}
          gaugeType={chartConfig.gaugeType}
          thresholds={chartConfig.thresholds}
        />
      );
    }

    // Timeline chart
    if (chartConfig.type === 'timeline' && queryResult) {
      // Auto-detect date columns if not set
      const labelCol = chartConfig.xAxis || textColumns[0];
      const startCol = chartConfig.startColumn || dateColumns[0];
      const endCol = chartConfig.endColumn || dateColumns[1] || dateColumns[0];

      if (!labelCol || !startCol || !endCol) {
        return (
          <Empty
            description={
              <Text type="secondary">
                Need label, start date, and end date columns for timeline
              </Text>
            }
          />
        );
      }
      return (
        <TimelineChart
          data={queryResult.rows}
          labelColumn={labelCol}
          startColumn={startCol}
          endColumn={endCol}
          categoryColumn={chartConfig.categoryColumn || undefined}
          progressColumn={chartConfig.progressColumn || undefined}
          showMilestones={chartConfig.showMilestones}
          showProgress={chartConfig.showProgress}
          groupByCategory={chartConfig.groupByCategory}
          barHeight={chartConfig.barHeight}
        />
      );
    }

    // Map chart
    if (chartConfig.type === 'map' && queryResult) {
      const mapData = prepareMapData(queryResult, chartConfig);
      if (!mapData) {
        return (
          <Empty
            description={
              <Text type="secondary">
                Select region and value columns for map
              </Text>
            }
          />
        );
      }
      return (
        <MapChart
          data={mapData.data}
          regionColumn={mapData.regionColumn}
          valueColumn={mapData.valueColumn}
          mapType={chartConfig.mapType}
          displayMode={chartConfig.displayMode}
          showLabels={chartConfig.showLabels}
          colorScale={chartConfig.colorScale === 'categorical' ? 'sequential' : chartConfig.colorScale}
        />
      );
    }

    // Standard charts use prepareChartData
    if (!chartData) {
      return (
        <Empty
          description={
            <Text type="secondary">
              Select X and Y axes to visualize data
            </Text>
          }
        />
      );
    }

    switch (chartConfig.type) {
      case 'bar':
        return (
          <BarChart
            data={chartData.data}
            xAxisKey={chartData.xAxisKey}
            yAxisKeys={chartData.yAxisKeys}
            stacked={chartConfig.stacked}
          />
        );
      case 'line':
        return (
          <LineChart
            data={chartData.data}
            xAxisKey={chartData.xAxisKey}
            yAxisKeys={chartData.yAxisKeys}
            isDateXAxis={isDateXAxis}
          />
        );
      case 'area':
        return (
          <AreaChart
            data={chartData.data}
            xAxisKey={chartData.xAxisKey}
            yAxisKeys={chartData.yAxisKeys}
            isDateXAxis={isDateXAxis}
            stacked={chartConfig.stacked}
          />
        );
      case 'pie':
        return (
          <PieChart
            data={chartData.data}
            nameKey={chartData.xAxisKey}
            valueKey={chartData.yAxisKeys[0]}
          />
        );
      case 'donut':
        return (
          <DonutChart
            data={chartData.data}
            nameKey={chartData.xAxisKey}
            valueKey={chartData.yAxisKeys[0]}
          />
        );
      case 'column':
      default:
        return (
          <ColumnChart
            data={chartData.data}
            xAxisKey={chartData.xAxisKey}
            yAxisKeys={chartData.yAxisKeys}
            stacked={chartConfig.stacked}
          />
        );
    }
  };

  const canSave = chartConfig.xAxis && chartConfig.yAxes.length > 0;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #333',
          background: '#0a0a0a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <ChartSelector
          config={chartConfig}
          availableColumns={availableColumns}
          numericColumns={numericColumns}
          breakdownColumns={breakdownColumns}
          onConfigChange={handleConfigChange}
        />
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSaveChart}
          loading={isSaving}
          disabled={!canSave}
          size="small"
        >
          Save Chart
        </Button>
      </div>

      <div style={{ flex: 1, minHeight: 300, padding: 16 }}>
        {renderChart()}
      </div>
    </div>
  );
}
