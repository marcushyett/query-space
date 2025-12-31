'use client';

import { useState, useEffect, useMemo } from 'react';
import { Spin, Empty } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { useDashboardStore, DashboardWidget, WidgetConfig } from '@/stores/dashboardStore';

interface KPIWidgetProps {
  widget: DashboardWidget;
}

export function KPIWidget({ widget }: KPIWidgetProps) {
  const { refreshingWidgets, widgetData, setWidgetData } = useDashboardStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRefreshing = refreshingWidgets.has(widget.id);
  const cachedData = widgetData.get(widget.id);

  // Memoize config to avoid unnecessary re-renders
  const config: WidgetConfig = useMemo(() => widget.config || {}, [widget.config]);

  // Fetch query data on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!widget.query?.sql) return;
      if (cachedData) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql: widget.query.sql }),
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
        console.error('Failed to fetch KPI data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [widget.id, widget.query?.sql, cachedData, setWidgetData]);

  // Re-fetch on refresh
  useEffect(() => {
    if (!isRefreshing) return;

    const fetchData = async () => {
      if (!widget.query?.sql) return;

      try {
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql: widget.query.sql }),
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
        console.error('Failed to refresh KPI data:', err);
      }
    };

    fetchData();
  }, [isRefreshing, widget.id, widget.query?.sql, setWidgetData]);

  const { value, trend, trendValue } = useMemo(() => {
    if (!cachedData?.rows?.[0]) {
      return { value: null, trend: null, trendValue: null };
    }

    const row = cachedData.rows[0];
    const valueColumn = config.valueColumn || cachedData.fields?.[0]?.name;
    const rawValue = valueColumn ? row[valueColumn] : Object.values(row)[0];

    let parsedValue = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
    if (isNaN(parsedValue)) parsedValue = 0;

    // Get trend if configured
    let trendVal = null;
    let trendDirection = null;
    if (config.showTrend && config.trendColumn) {
      const trendRaw = row[config.trendColumn];
      trendVal = typeof trendRaw === 'number' ? trendRaw : parseFloat(String(trendRaw));
      if (!isNaN(trendVal)) {
        trendDirection = trendVal > 0 ? 'up' : trendVal < 0 ? 'down' : 'flat';
      }
    }

    return { value: parsedValue, trend: trendDirection, trendValue: trendVal };
  }, [cachedData, config]);

  const formatValue = (val: number | null) => {
    if (val === null) return '-';

    const format = config.format || 'number';
    const prefix = config.prefix || '';
    const suffix = config.suffix || '';

    let formatted: string;
    switch (format) {
      case 'currency':
        formatted = val.toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
        break;
      case 'percentage':
        formatted = `${(val * 100).toFixed(1)}%`;
        break;
      default:
        if (Math.abs(val) >= 1_000_000) {
          formatted = `${(val / 1_000_000).toFixed(1)}M`;
        } else if (Math.abs(val) >= 1_000) {
          formatted = `${(val / 1_000).toFixed(1)}K`;
        } else {
          formatted = val.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          });
        }
    }

    return `${prefix}${formatted}${suffix}`;
  };

  const getThresholdColor = (val: number | null) => {
    if (val === null || !config.thresholds) return '#fff';
    if (val >= config.thresholds.critical) return '#ff4d4f';
    if (val >= config.thresholds.warning) return '#faad14';
    return '#52c41a';
  };

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

  if (value === null) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="No data" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        position: 'relative',
      }}
    >
      {isRefreshing && (
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <Spin size="small" />
        </div>
      )}

      {/* Main Value */}
      <div
        style={{
          fontSize: 'clamp(28px, 5vw, 48px)',
          fontWeight: 700,
          color: config.thresholds ? getThresholdColor(value) : '#fff',
          lineHeight: 1.2,
          textAlign: 'center',
        }}
      >
        {formatValue(value)}
      </div>

      {/* Trend Indicator */}
      {trend && trendValue !== null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 8,
            fontSize: 14,
            color: trend === 'up' ? '#52c41a' : trend === 'down' ? '#ff4d4f' : '#888',
          }}
        >
          {trend === 'up' && <ArrowUpOutlined />}
          {trend === 'down' && <ArrowDownOutlined />}
          {trend === 'flat' && <MinusOutlined />}
          <span>
            {trendValue > 0 ? '+' : ''}
            {trendValue.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}
