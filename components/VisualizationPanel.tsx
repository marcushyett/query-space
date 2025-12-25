'use client';

import { useState, useMemo, useCallback } from 'react';
import { Typography, Empty } from 'antd';
import { ColumnChart } from './ColumnChart';
import { LineChart } from './LineChart';
import { AreaChart } from './AreaChart';
import { PieChart } from './PieChart';
import { ChartSelector } from './ChartSelector';
import {
  isChartable,
  suggestChartConfig,
  prepareChartData,
  isNumericType,
  isDateType,
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #333',
          background: '#0a0a0a',
        }}
      >
        <ChartSelector
          config={chartConfig}
          availableColumns={availableColumns}
          numericColumns={numericColumns}
          breakdownColumns={breakdownColumns}
          onConfigChange={handleConfigChange}
        />
      </div>

      <div style={{ flex: 1, minHeight: 300, padding: 16 }}>
        {renderChart()}
      </div>
    </div>
  );
}
