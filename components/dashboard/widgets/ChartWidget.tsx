'use client';

import { useState, useEffect, useMemo } from 'react';
import { Spin, Empty } from 'antd';
import { ColumnChart } from '@/components/ColumnChart';
import { BarChart } from '@/components/BarChart';
import { LineChart } from '@/components/LineChart';
import { AreaChart } from '@/components/AreaChart';
import { PieChart } from '@/components/PieChart';
import { DonutChart } from '@/components/DonutChart';
import { ScatterChart } from '@/components/ScatterChart';
import { FunnelChart } from '@/components/FunnelChart';
import { WaterfallChart } from '@/components/WaterfallChart';
import { HeatmapChart } from '@/components/HeatmapChart';
import { RadarChart } from '@/components/RadarChart';
import { useDashboardStore, DashboardWidget } from '@/stores/dashboardStore';
import {
  prepareChartData,
  prepareScatterData,
  prepareFunnelData,
  prepareWaterfallData,
  prepareHeatmapData,
  prepareRadarData,
  isDateType,
  type ChartConfig,
  type ChartType,
} from '@/lib/chart-utils';

interface ChartWidgetProps {
  widget: DashboardWidget;
}

export function ChartWidget({ widget }: ChartWidgetProps) {
  const { refreshingWidgets, widgetData, setWidgetData, dashboard } = useDashboardStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRefreshing = refreshingWidgets.has(widget.id);
  const cachedData = widgetData.get(widget.id);

  // Fetch query data on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!widget.chart?.query?.sql) return;
      if (cachedData) return; // Already have data
      if (!dashboard?.organizationId) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: dashboard.organizationId,
            sql: widget.chart.query.sql,
          }),
        });

        if (!response.ok) {
          throw new Error('Query execution failed');
        }

        const result = await response.json();
        setWidgetData(widget.id, {
          rows: result.rows || [],
          fields: result.fields || [],
        });
      } catch (err) {
        console.error('Failed to fetch chart data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [widget.id, widget.chart?.query?.sql, cachedData, setWidgetData, dashboard?.organizationId]);

  // Re-fetch on refresh
  useEffect(() => {
    if (!isRefreshing) return;

    const fetchData = async () => {
      if (!widget.chart?.query?.sql) return;
      if (!dashboard?.organizationId) return;

      try {
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: dashboard.organizationId,
            sql: widget.chart.query.sql,
          }),
        });

        if (!response.ok) {
          throw new Error('Query execution failed');
        }

        const result = await response.json();
        setWidgetData(widget.id, {
          rows: result.rows || [],
          fields: result.fields || [],
        });
      } catch (err) {
        console.error('Failed to refresh chart data:', err);
      }
    };

    fetchData();
  }, [isRefreshing, widget.id, widget.chart?.query?.sql, setWidgetData, dashboard?.organizationId]);

  const chartConfig = useMemo((): ChartConfig | null => {
    if (!widget.chart?.config) return null;
    const config = widget.chart.config as Record<string, unknown>;
    return {
      type: (config.type as ChartType) || 'column',
      xAxis: (config.xAxis as string) || null,
      yAxes: (config.yAxes as string[]) || [],
      stacked: config.stacked as boolean | undefined,
      breakdownBy: config.breakdownBy as string | null | undefined,
    };
  }, [widget.chart?.config]);

  const queryResult = useMemo(() => {
    if (!cachedData) return null;
    return {
      rows: cachedData.rows,
      fields: cachedData.fields,
      rowCount: cachedData.rows.length,
      executionTime: 0,
    };
  }, [cachedData]);

  const isDateXAxis = useMemo(() => {
    if (!queryResult || !chartConfig?.xAxis) return false;
    const field = queryResult.fields.find((f) => f.name === chartConfig.xAxis);
    return field ? isDateType(field.dataTypeID) : false;
  }, [queryResult, chartConfig?.xAxis]);

  if (isLoading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="small" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Empty
          description={<span style={{ color: '#ff4d4f', fontSize: 12 }}>{error}</span>}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  if (!queryResult || !chartConfig) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="No chart configuration" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  // Prepare chart data
  const chartData = prepareChartData(queryResult, chartConfig);

  if (!chartData) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="Unable to render chart" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  // Render chart based on type
  const renderChart = () => {
    const chartType = chartConfig.type || widget.chart?.type?.toLowerCase() || 'column';

    switch (chartType) {
      case 'bar':
        return (
          <BarChart
            data={chartData.data}
            xAxisKey={chartData.xAxisKey}
            yAxisKeys={chartData.yAxisKeys}
            stacked={chartConfig.stacked}
            showLegend={false}
          />
        );

      case 'line':
        return (
          <LineChart
            data={chartData.data}
            xAxisKey={chartData.xAxisKey}
            yAxisKeys={chartData.yAxisKeys}
            isDateXAxis={isDateXAxis}
            showLegend={false}
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
            showLegend={false}
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

      case 'scatter': {
        const scatterData = prepareScatterData(queryResult, chartConfig);
        if (!scatterData) return <Empty description="Invalid scatter config" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
        return (
          <ScatterChart
            data={scatterData.data}
            xAxisKey={scatterData.xKey}
            yAxisKey={scatterData.yKey}
          />
        );
      }

      case 'funnel': {
        const funnelData = prepareFunnelData(queryResult, chartConfig);
        if (!funnelData) return <Empty description="Invalid funnel config" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
        return <FunnelChart data={funnelData.data} />;
      }

      case 'waterfall': {
        const waterfallData = prepareWaterfallData(queryResult, chartConfig);
        if (!waterfallData) return <Empty description="Invalid waterfall config" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
        return <WaterfallChart data={waterfallData.data} />;
      }

      case 'heatmap': {
        const heatmapData = prepareHeatmapData(queryResult, chartConfig);
        if (!heatmapData) return <Empty description="Invalid heatmap config" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
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

      case 'radar': {
        const radarData = prepareRadarData(queryResult, chartConfig);
        if (!radarData) return <Empty description="Invalid radar config" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
        return (
          <RadarChart
            data={radarData.data}
            subjectKey="subject"
            series={radarData.series}
          />
        );
      }

      case 'column':
      default:
        return (
          <ColumnChart
            data={chartData.data}
            xAxisKey={chartData.xAxisKey}
            yAxisKeys={chartData.yAxisKeys}
            stacked={chartConfig.stacked}
            showLegend={false}
          />
        );
    }
  };

  return (
    <div style={{ height: '100%', padding: 8, position: 'relative' }}>
      {isRefreshing && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
          }}
        >
          <Spin size="small" />
        </div>
      )}
      {renderChart()}
    </div>
  );
}
