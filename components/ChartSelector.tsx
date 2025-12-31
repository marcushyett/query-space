'use client';

import { useMemo } from 'react';
import { Select, Space, Typography, Switch } from 'antd';
import {
  BarChartOutlined,
  LineChartOutlined,
  AreaChartOutlined,
  PieChartOutlined,
  DotChartOutlined,
  FunnelPlotOutlined,
  RadarChartOutlined,
  HeatMapOutlined,
  StockOutlined,
  GlobalOutlined,
  ApartmentOutlined,
  DashboardOutlined,
  FieldTimeOutlined,
  BoxPlotOutlined,
  PartitionOutlined,
  DeploymentUnitOutlined,
  BranchesOutlined,
} from '@ant-design/icons';
import type { ChartConfig, ChartType } from '@/lib/chart-utils';

const { Text } = Typography;

interface ChartSelectorProps {
  config: ChartConfig;
  availableColumns: string[];
  numericColumns: string[];
  breakdownColumns: string[];
  onConfigChange: (config: ChartConfig) => void;
}

export function ChartSelector({
  config,
  availableColumns,
  numericColumns,
  breakdownColumns,
  onConfigChange,
}: ChartSelectorProps) {
  const handleTypeChange = (type: ChartType) => {
    onConfigChange({ ...config, type });
  };

  const handleXAxisChange = (xAxis: string) => {
    onConfigChange({ ...config, xAxis });
  };

  const handleYAxesChange = (yAxes: string[]) => {
    onConfigChange({ ...config, yAxes });
  };

  const handleBreakdownChange = (breakdownBy: string | undefined) => {
    onConfigChange({ ...config, breakdownBy: breakdownBy || null });
  };

  const handleStackedChange = (stacked: boolean) => {
    onConfigChange({ ...config, stacked });
  };

  const isPieOrDonut = config.type === 'pie' || config.type === 'donut';
  const isScatter = config.type === 'scatter';
  const isFunnel = config.type === 'funnel';
  const isWaterfall = config.type === 'waterfall';
  const isHeatmap = config.type === 'heatmap';
  const isRadar = config.type === 'radar';
  const isMap = config.type === 'map';
  const isTreemap = config.type === 'treemap';
  const isSunburst = config.type === 'sunburst';
  const isSankey = config.type === 'sankey';
  const isNetwork = config.type === 'network';
  const isGauge = config.type === 'gauge';
  const isBubble = config.type === 'bubble';
  const isBoxplot = config.type === 'boxplot';
  const isHistogram = config.type === 'histogram';
  const isTimeline = config.type === 'timeline';

  // Charts that don't support breakdowns at all
  const noBreakdownChart = isScatter || isFunnel || isWaterfall || isHeatmap || isMap || isTreemap || isSunburst || isSankey || isNetwork || isGauge || isBubble || isBoxplot || isHistogram || isTimeline;

  // Charts that don't support stacking
  const noStackChart = isScatter || isFunnel || isWaterfall || isHeatmap || isRadar || isMap || isTreemap || isSunburst || isSankey || isNetwork || isGauge || isBubble || isBoxplot || isHistogram || isTimeline;

  // Radar charts support breakdown (creates multiple series)
  const showBreakdown = !isPieOrDonut && !noBreakdownChart && config.yAxes.length === 1 && breakdownColumns.length > 0;
  const showStacked = !isPieOrDonut && !noStackChart && (config.yAxes.length > 1 || config.breakdownBy);

  // Memoize options to prevent dropdown flickering on re-render
  const xAxisOptions = useMemo(() =>
    availableColumns.map((col) => ({
      value: col,
      label: col,
    })),
    [availableColumns]
  );

  const yAxisOptions = useMemo(() =>
    numericColumns.map((col) => ({
      value: col,
      label: col,
    })),
    [numericColumns]
  );

  const breakdownOptions = useMemo(() =>
    breakdownColumns.map((col) => ({
      value: col,
      label: col,
    })),
    [breakdownColumns]
  );

  return (
    <Space size="middle" wrap>
      <Space>
        <Text type="secondary">Chart:</Text>
        <Select
          value={config.type}
          onChange={handleTypeChange}
          style={{ width: 140 }}
          popupMatchSelectWidth={false}
          options={[
            {
              label: 'Basic Charts',
              options: [
                {
                  value: 'column',
                  label: (
                    <span>
                      <BarChartOutlined style={{ marginRight: 8 }} />
                      Column
                    </span>
                  ),
                },
                {
                  value: 'bar',
                  label: (
                    <span>
                      <BarChartOutlined style={{ marginRight: 8, transform: 'rotate(90deg)' }} />
                      Bar
                    </span>
                  ),
                },
                {
                  value: 'line',
                  label: (
                    <span>
                      <LineChartOutlined style={{ marginRight: 8 }} />
                      Line
                    </span>
                  ),
                },
                {
                  value: 'area',
                  label: (
                    <span>
                      <AreaChartOutlined style={{ marginRight: 8 }} />
                      Area
                    </span>
                  ),
                },
                {
                  value: 'pie',
                  label: (
                    <span>
                      <PieChartOutlined style={{ marginRight: 8 }} />
                      Pie
                    </span>
                  ),
                },
                {
                  value: 'donut',
                  label: (
                    <span>
                      <PieChartOutlined style={{ marginRight: 8 }} />
                      Donut
                    </span>
                  ),
                },
              ],
            },
            {
              label: 'Statistical',
              options: [
                {
                  value: 'scatter',
                  label: (
                    <span>
                      <DotChartOutlined style={{ marginRight: 8 }} />
                      Scatter
                    </span>
                  ),
                },
                {
                  value: 'bubble',
                  label: (
                    <span>
                      <DotChartOutlined style={{ marginRight: 8 }} />
                      Bubble
                    </span>
                  ),
                },
                {
                  value: 'histogram',
                  label: (
                    <span>
                      <BarChartOutlined style={{ marginRight: 8 }} />
                      Histogram
                    </span>
                  ),
                },
                {
                  value: 'boxplot',
                  label: (
                    <span>
                      <BoxPlotOutlined style={{ marginRight: 8 }} />
                      Box Plot
                    </span>
                  ),
                },
              ],
            },
            {
              label: 'Hierarchical',
              options: [
                {
                  value: 'treemap',
                  label: (
                    <span>
                      <ApartmentOutlined style={{ marginRight: 8 }} />
                      Treemap
                    </span>
                  ),
                },
                {
                  value: 'sunburst',
                  label: (
                    <span>
                      <PartitionOutlined style={{ marginRight: 8 }} />
                      Sunburst
                    </span>
                  ),
                },
              ],
            },
            {
              label: 'Flow & Relationships',
              options: [
                {
                  value: 'funnel',
                  label: (
                    <span>
                      <FunnelPlotOutlined style={{ marginRight: 8 }} />
                      Funnel
                    </span>
                  ),
                },
                {
                  value: 'waterfall',
                  label: (
                    <span>
                      <StockOutlined style={{ marginRight: 8 }} />
                      Waterfall
                    </span>
                  ),
                },
                {
                  value: 'sankey',
                  label: (
                    <span>
                      <BranchesOutlined style={{ marginRight: 8 }} />
                      Sankey
                    </span>
                  ),
                },
                {
                  value: 'network',
                  label: (
                    <span>
                      <DeploymentUnitOutlined style={{ marginRight: 8 }} />
                      Network
                    </span>
                  ),
                },
              ],
            },
            {
              label: 'Comparison & KPI',
              options: [
                {
                  value: 'radar',
                  label: (
                    <span>
                      <RadarChartOutlined style={{ marginRight: 8 }} />
                      Radar
                    </span>
                  ),
                },
                {
                  value: 'gauge',
                  label: (
                    <span>
                      <DashboardOutlined style={{ marginRight: 8 }} />
                      Gauge
                    </span>
                  ),
                },
              ],
            },
            {
              label: 'Specialized',
              options: [
                {
                  value: 'heatmap',
                  label: (
                    <span>
                      <HeatMapOutlined style={{ marginRight: 8 }} />
                      Heatmap
                    </span>
                  ),
                },
                {
                  value: 'map',
                  label: (
                    <span>
                      <GlobalOutlined style={{ marginRight: 8 }} />
                      Map
                    </span>
                  ),
                },
                {
                  value: 'timeline',
                  label: (
                    <span>
                      <FieldTimeOutlined style={{ marginRight: 8 }} />
                      Timeline
                    </span>
                  ),
                },
              ],
            },
          ]}
        />
      </Space>

      <Space>
        <Text type="secondary">{isPieOrDonut ? 'Category:' : 'X-Axis:'}</Text>
        <Select
          value={config.xAxis}
          onChange={handleXAxisChange}
          style={{ width: 150 }}
          placeholder="Select column"
          options={xAxisOptions}
        />
      </Space>

      <Space>
        <Text type="secondary">{isPieOrDonut || isFunnel ? 'Value:' : 'Y-Axis:'}</Text>
        <Select
          mode={isPieOrDonut || isFunnel ? undefined : 'multiple'}
          value={isPieOrDonut || isFunnel ? config.yAxes[0] : config.yAxes}
          onChange={(value) => {
            const yAxes = isPieOrDonut || isFunnel ? [value as string] : (value as string[]);
            handleYAxesChange(yAxes);
          }}
          style={{ minWidth: 150, maxWidth: 300 }}
          placeholder="Select columns"
          maxTagCount={1}
          options={yAxisOptions}
          popupMatchSelectWidth={false}
        />
      </Space>

      {showBreakdown && (
        <Space>
          <Text type="secondary">Breakdown:</Text>
          <Select
            value={config.breakdownBy || undefined}
            onChange={handleBreakdownChange}
            style={{ width: 150 }}
            placeholder="None"
            allowClear
            options={breakdownOptions}
          />
        </Space>
      )}

      {showStacked && (
        <Space>
          <Text type="secondary">Stacked:</Text>
          <Switch
            checked={config.stacked}
            onChange={handleStackedChange}
            size="small"
          />
        </Space>
      )}
    </Space>
  );
}
