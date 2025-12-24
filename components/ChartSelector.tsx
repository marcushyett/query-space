'use client';

import { Select, Space, Typography } from 'antd';
import { BarChartOutlined, LineChartOutlined } from '@ant-design/icons';
import type { ChartConfig, ChartType } from '@/lib/chart-utils';

const { Text } = Typography;

interface ChartSelectorProps {
  config: ChartConfig;
  availableColumns: string[];
  numericColumns: string[];
  onConfigChange: (config: ChartConfig) => void;
}

export function ChartSelector({
  config,
  availableColumns,
  numericColumns,
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
          ]}
        />
      </Space>

      <Space>
        <Text type="secondary">X-Axis:</Text>
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
        <Text type="secondary">Y-Axis:</Text>
        <Select
          mode="multiple"
          value={config.yAxes}
          onChange={handleYAxesChange}
          style={{ minWidth: 150, maxWidth: 300 }}
          placeholder="Select columns"
          maxTagCount="responsive"
          options={numericColumns.map((col) => ({
            value: col,
            label: col,
          }))}
        />
      </Space>
    </Space>
  );
}
