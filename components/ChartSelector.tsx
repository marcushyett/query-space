'use client';

import { Select, Space, Typography, Switch } from 'antd';
import {
  BarChartOutlined,
  LineChartOutlined,
  AreaChartOutlined,
  PieChartOutlined,
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

  const isPieChart = config.type === 'pie';
  const showBreakdown = !isPieChart && config.yAxes.length === 1 && breakdownColumns.length > 0;
  const showStacked = !isPieChart && (config.yAxes.length > 1 || config.breakdownBy);

  return (
    <Space size="middle" wrap>
      <Space>
        <Text type="secondary">Chart:</Text>
        <Select
          value={config.type}
          onChange={handleTypeChange}
          style={{ width: 120 }}
          options={[
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
          ]}
        />
      </Space>

      <Space>
        <Text type="secondary">{isPieChart ? 'Category:' : 'X-Axis:'}</Text>
        <Select
          value={config.xAxis}
          onChange={handleXAxisChange}
          style={{ width: 150 }}
          placeholder="Select column"
          options={availableColumns.map((col) => ({
            value: col,
            label: col,
          }))}
        />
      </Space>

      <Space>
        <Text type="secondary">{isPieChart ? 'Value:' : 'Y-Axis:'}</Text>
        <Select
          mode={isPieChart ? undefined : 'multiple'}
          value={isPieChart ? config.yAxes[0] : config.yAxes}
          onChange={(value) => {
            const yAxes = isPieChart ? [value as string] : (value as string[]);
            handleYAxesChange(yAxes);
          }}
          style={{ minWidth: 150, maxWidth: 300 }}
          placeholder="Select columns"
          maxTagCount="responsive"
          options={numericColumns.map((col) => ({
            value: col,
            label: col,
          }))}
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
            options={breakdownColumns.map((col) => ({
              value: col,
              label: col,
            }))}
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
