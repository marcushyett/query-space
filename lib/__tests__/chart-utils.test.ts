import { describe, it, expect } from 'vitest';
import {
  isNumericType,
  isDateType,
  isTextType,
  getColumnType,
  detectChartType,
  suggestXAxis,
  suggestYAxes,
  suggestChartConfig,
  isChartable,
  prepareChartData,
  getChartColors,
  formatNumber,
  formatDate,
} from '../chart-utils';
import type { QueryResult } from '@/stores/queryStore';

// PostgreSQL type OIDs
const INT_TYPE = 23;
const BIGINT_TYPE = 20;
const FLOAT_TYPE = 701;
const NUMERIC_TYPE = 1700;
const TEXT_TYPE = 25;
const VARCHAR_TYPE = 1043;
const DATE_TYPE = 1082;
const TIMESTAMP_TYPE = 1114;

describe('chart-utils', () => {
  describe('isNumericType', () => {
    it('should return true for integer type', () => {
      expect(isNumericType(INT_TYPE)).toBe(true);
    });

    it('should return true for bigint type', () => {
      expect(isNumericType(BIGINT_TYPE)).toBe(true);
    });

    it('should return true for float type', () => {
      expect(isNumericType(FLOAT_TYPE)).toBe(true);
    });

    it('should return true for numeric type', () => {
      expect(isNumericType(NUMERIC_TYPE)).toBe(true);
    });

    it('should return false for text type', () => {
      expect(isNumericType(TEXT_TYPE)).toBe(false);
    });

    it('should return false for date type', () => {
      expect(isNumericType(DATE_TYPE)).toBe(false);
    });
  });

  describe('isDateType', () => {
    it('should return true for date type', () => {
      expect(isDateType(DATE_TYPE)).toBe(true);
    });

    it('should return true for timestamp type', () => {
      expect(isDateType(TIMESTAMP_TYPE)).toBe(true);
    });

    it('should return false for integer type', () => {
      expect(isDateType(INT_TYPE)).toBe(false);
    });
  });

  describe('isTextType', () => {
    it('should return true for text type', () => {
      expect(isTextType(TEXT_TYPE)).toBe(true);
    });

    it('should return true for varchar type', () => {
      expect(isTextType(VARCHAR_TYPE)).toBe(true);
    });

    it('should return false for integer type', () => {
      expect(isTextType(INT_TYPE)).toBe(false);
    });
  });

  describe('getColumnType', () => {
    it('should return numeric for integer', () => {
      expect(getColumnType(INT_TYPE)).toBe('numeric');
    });

    it('should return date for date type', () => {
      expect(getColumnType(DATE_TYPE)).toBe('date');
    });

    it('should return text for varchar', () => {
      expect(getColumnType(VARCHAR_TYPE)).toBe('text');
    });

    it('should return unknown for unrecognized type', () => {
      expect(getColumnType(9999)).toBe('unknown');
    });
  });

  describe('detectChartType', () => {
    it('should return none for null result', () => {
      expect(detectChartType(null as unknown as QueryResult)).toBe('none');
    });

    it('should return none for empty rows', () => {
      const result: QueryResult = {
        rows: [],
        fields: [{ name: 'x', dataTypeID: TEXT_TYPE }],
        rowCount: 0,
        executionTime: 10,
      };
      expect(detectChartType(result)).toBe('none');
    });

    it('should return none for single field', () => {
      const result: QueryResult = {
        rows: [{ x: 1 }],
        fields: [{ name: 'x', dataTypeID: INT_TYPE }],
        rowCount: 1,
        executionTime: 10,
      };
      expect(detectChartType(result)).toBe('none');
    });

    it('should return none for no numeric fields', () => {
      const result: QueryResult = {
        rows: [{ x: 'a', y: 'b' }],
        fields: [
          { name: 'x', dataTypeID: TEXT_TYPE },
          { name: 'y', dataTypeID: TEXT_TYPE },
        ],
        rowCount: 1,
        executionTime: 10,
      };
      expect(detectChartType(result)).toBe('none');
    });

    it('should return line for date + numeric fields', () => {
      const result: QueryResult = {
        rows: [{ date: '2024-01-01', value: 100 }],
        fields: [
          { name: 'date', dataTypeID: DATE_TYPE },
          { name: 'value', dataTypeID: INT_TYPE },
        ],
        rowCount: 1,
        executionTime: 10,
      };
      expect(detectChartType(result)).toBe('line');
    });

    it('should return column for text + numeric fields', () => {
      const result: QueryResult = {
        rows: [{ category: 'A', value: 100 }],
        fields: [
          { name: 'category', dataTypeID: TEXT_TYPE },
          { name: 'value', dataTypeID: INT_TYPE },
        ],
        rowCount: 1,
        executionTime: 10,
      };
      expect(detectChartType(result)).toBe('column');
    });

    it('should return column for only numeric fields', () => {
      const result: QueryResult = {
        rows: [{ x: 1, y: 100 }],
        fields: [
          { name: 'x', dataTypeID: INT_TYPE },
          { name: 'y', dataTypeID: INT_TYPE },
        ],
        rowCount: 1,
        executionTime: 10,
      };
      expect(detectChartType(result)).toBe('column');
    });
  });

  describe('suggestXAxis', () => {
    it('should return null for empty result', () => {
      expect(suggestXAxis(null as unknown as QueryResult)).toBe(null);
    });

    it('should prefer date field for X-axis', () => {
      const result: QueryResult = {
        rows: [{ date: '2024-01-01', name: 'A', value: 100 }],
        fields: [
          { name: 'date', dataTypeID: DATE_TYPE },
          { name: 'name', dataTypeID: TEXT_TYPE },
          { name: 'value', dataTypeID: INT_TYPE },
        ],
        rowCount: 1,
        executionTime: 10,
      };
      expect(suggestXAxis(result)).toBe('date');
    });

    it('should prefer text field when no date field', () => {
      const result: QueryResult = {
        rows: [{ name: 'A', value: 100 }],
        fields: [
          { name: 'name', dataTypeID: TEXT_TYPE },
          { name: 'value', dataTypeID: INT_TYPE },
        ],
        rowCount: 1,
        executionTime: 10,
      };
      expect(suggestXAxis(result)).toBe('name');
    });

    it('should use first field as fallback', () => {
      const result: QueryResult = {
        rows: [{ x: 1, y: 100 }],
        fields: [
          { name: 'x', dataTypeID: INT_TYPE },
          { name: 'y', dataTypeID: INT_TYPE },
        ],
        rowCount: 1,
        executionTime: 10,
      };
      expect(suggestXAxis(result)).toBe('x');
    });
  });

  describe('suggestYAxes', () => {
    it('should return empty array for empty result', () => {
      expect(suggestYAxes(null as unknown as QueryResult, null)).toEqual([]);
    });

    it('should return numeric fields not used as X-axis', () => {
      const result: QueryResult = {
        rows: [{ name: 'A', value1: 100, value2: 200 }],
        fields: [
          { name: 'name', dataTypeID: TEXT_TYPE },
          { name: 'value1', dataTypeID: INT_TYPE },
          { name: 'value2', dataTypeID: INT_TYPE },
        ],
        rowCount: 1,
        executionTime: 10,
      };
      expect(suggestYAxes(result, 'name')).toEqual(['value1', 'value2']);
    });

    it('should exclude X-axis field from suggestions', () => {
      const result: QueryResult = {
        rows: [{ x: 1, y: 100 }],
        fields: [
          { name: 'x', dataTypeID: INT_TYPE },
          { name: 'y', dataTypeID: INT_TYPE },
        ],
        rowCount: 1,
        executionTime: 10,
      };
      expect(suggestYAxes(result, 'x')).toEqual(['y']);
    });
  });

  describe('suggestChartConfig', () => {
    it('should return complete config for chartable data', () => {
      const result: QueryResult = {
        rows: [{ category: 'A', value: 100 }],
        fields: [
          { name: 'category', dataTypeID: TEXT_TYPE },
          { name: 'value', dataTypeID: INT_TYPE },
        ],
        rowCount: 1,
        executionTime: 10,
      };

      const config = suggestChartConfig(result);

      expect(config.type).toBe('column');
      expect(config.xAxis).toBe('category');
      expect(config.yAxes).toEqual(['value']);
    });
  });

  describe('isChartable', () => {
    it('should return false for null result', () => {
      expect(isChartable(null)).toBe(false);
    });

    it('should return false for empty rows', () => {
      const result: QueryResult = {
        rows: [],
        fields: [{ name: 'x', dataTypeID: INT_TYPE }],
        rowCount: 0,
        executionTime: 10,
      };
      expect(isChartable(result)).toBe(false);
    });

    it('should return false for single field', () => {
      const result: QueryResult = {
        rows: [{ x: 1 }],
        fields: [{ name: 'x', dataTypeID: INT_TYPE }],
        rowCount: 1,
        executionTime: 10,
      };
      expect(isChartable(result)).toBe(false);
    });

    it('should return false for no numeric fields', () => {
      const result: QueryResult = {
        rows: [{ x: 'a', y: 'b' }],
        fields: [
          { name: 'x', dataTypeID: TEXT_TYPE },
          { name: 'y', dataTypeID: TEXT_TYPE },
        ],
        rowCount: 1,
        executionTime: 10,
      };
      expect(isChartable(result)).toBe(false);
    });

    it('should return true for chartable data', () => {
      const result: QueryResult = {
        rows: [{ name: 'A', value: 100 }],
        fields: [
          { name: 'name', dataTypeID: TEXT_TYPE },
          { name: 'value', dataTypeID: INT_TYPE },
        ],
        rowCount: 1,
        executionTime: 10,
      };
      expect(isChartable(result)).toBe(true);
    });
  });

  describe('prepareChartData', () => {
    it('should return null for invalid config', () => {
      const result: QueryResult = {
        rows: [{ name: 'A', value: 100 }],
        fields: [
          { name: 'name', dataTypeID: TEXT_TYPE },
          { name: 'value', dataTypeID: INT_TYPE },
        ],
        rowCount: 1,
        executionTime: 10,
      };

      expect(prepareChartData(result, { type: 'column', xAxis: null, yAxes: [] })).toBe(null);
    });

    it('should prepare data correctly', () => {
      const result: QueryResult = {
        rows: [
          { name: 'A', value: 100 },
          { name: 'B', value: 200 },
        ],
        fields: [
          { name: 'name', dataTypeID: TEXT_TYPE },
          { name: 'value', dataTypeID: INT_TYPE },
        ],
        rowCount: 2,
        executionTime: 10,
      };

      const config = { type: 'column' as const, xAxis: 'name', yAxes: ['value'] };
      const chartData = prepareChartData(result, config);

      expect(chartData).not.toBe(null);
      expect(chartData?.data).toHaveLength(2);
      expect(chartData?.xAxisKey).toBe('name');
      expect(chartData?.yAxisKeys).toEqual(['value']);
      expect(chartData?.data[0]).toEqual({ name: 'A', value: 100 });
    });

    it('should convert string numbers to numbers', () => {
      const result: QueryResult = {
        rows: [{ name: 'A', value: '100.5' }],
        fields: [
          { name: 'name', dataTypeID: TEXT_TYPE },
          { name: 'value', dataTypeID: INT_TYPE },
        ],
        rowCount: 1,
        executionTime: 10,
      };

      const config = { type: 'column' as const, xAxis: 'name', yAxes: ['value'] };
      const chartData = prepareChartData(result, config);

      expect(chartData?.data[0].value).toBe(100.5);
    });
  });

  describe('getChartColors', () => {
    it('should return array of colors', () => {
      const colors = getChartColors();
      expect(Array.isArray(colors)).toBe(true);
      expect(colors.length).toBeGreaterThan(0);
      expect(colors[0]).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('formatNumber', () => {
    it('should format millions', () => {
      expect(formatNumber(1500000)).toBe('1.5M');
    });

    it('should format thousands', () => {
      expect(formatNumber(1500)).toBe('1.5K');
    });

    it('should format small numbers', () => {
      expect(formatNumber(150)).toMatch(/150/);
    });

    it('should handle negative numbers', () => {
      expect(formatNumber(-1500000)).toBe('-1.5M');
    });
  });

  describe('formatDate', () => {
    it('should format valid date string', () => {
      const formatted = formatDate('2024-01-15');
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
    });

    it('should handle empty value', () => {
      expect(formatDate('')).toBe('');
    });

    it('should handle null value', () => {
      expect(formatDate(null)).toBe('');
    });

    it('should return original string for invalid date', () => {
      expect(formatDate('not-a-date')).toBe('not-a-date');
    });
  });
});
