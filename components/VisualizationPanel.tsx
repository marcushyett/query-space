'use client';

import { useState, useMemo, useCallback } from 'react';
import { Typography, Empty } from 'antd';
import { ColumnChart } from './ColumnChart';
import { LineChart } from './LineChart';
import { ChartSelector } from './ChartSelector';
import {
  isChartable,
  suggestChartConfig,
  prepareChartData,
  isNumericType,
  isDateType,
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
    return { type: 'column', xAxis: null, yAxes: [] };
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
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <Empty
          description={
            <Text type="secondary">
              This query result cannot be visualized. Need at least 2 columns with numeric data.
            </Text>
          }
        />
      </div>
    );
  }

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
          onConfigChange={handleConfigChange}
        />
      </div>

      <div style={{ flex: 1, minHeight: 300, padding: 16 }}>
        {chartData ? (
          chartConfig.type === 'line' ? (
            <LineChart
              data={chartData.data}
              xAxisKey={chartData.xAxisKey}
              yAxisKeys={chartData.yAxisKeys}
              isDateXAxis={isDateXAxis}
            />
          ) : (
            <ColumnChart
              data={chartData.data}
              xAxisKey={chartData.xAxisKey}
              yAxisKeys={chartData.yAxisKeys}
            />
          )
        ) : (
          <Empty
            description={
              <Text type="secondary">
                Select X and Y axes to visualize data
              </Text>
            }
          />
        )}
      </div>
    </div>
  );
}
