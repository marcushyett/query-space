import { describe, it, expect } from 'vitest';
import {
  analyzeDataQuality,
  filterGarbageData,
  summarizeDataQuality,
  type DataQualityReport,
} from '../dataQuality';

describe('Data Quality Analysis', () => {
  describe('analyzeDataQuality', () => {
    it('should return good quality for clean data', () => {
      const rows = [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
        { id: 3, name: 'Charlie', age: 35 },
      ];
      const columns = ['id', 'name', 'age'];

      const report = analyzeDataQuality(rows, columns);

      expect(report.overallQuality).toBe('good');
      expect(report.qualityScore).toBeGreaterThanOrEqual(80);
      expect(report.issues).toHaveLength(0);
      expect(report.totalRows).toBe(3);
      expect(report.totalColumns).toBe(3);
    });

    it('should detect all-null columns', () => {
      const rows = [
        { id: 1, name: 'Alice', status: null },
        { id: 2, name: 'Bob', status: null },
        { id: 3, name: 'Charlie', status: null },
      ];
      const columns = ['id', 'name', 'status'];

      const report = analyzeDataQuality(rows, columns);

      const nullIssue = report.issues.find(
        i => i.column === 'status' && i.issueType === 'all_null'
      );
      expect(nullIssue).toBeDefined();
      expect(nullIssue?.severity).toBe('critical');
      expect(nullIssue?.percentage).toBe(100);
    });

    it('should detect high null ratio', () => {
      const rows = [
        { id: 1, value: null },
        { id: 2, value: null },
        { id: 3, value: null },
        { id: 4, value: null },
        { id: 5, value: 100 },
      ];
      const columns = ['id', 'value'];

      const report = analyzeDataQuality(rows, columns);

      const nullIssue = report.issues.find(
        i => i.column === 'value' && i.issueType === 'high_null_ratio'
      );
      expect(nullIssue).toBeDefined();
      expect(nullIssue?.percentage).toBe(80);
    });

    it('should detect all-zero columns', () => {
      const rows = [
        { id: 1, count: 0 },
        { id: 2, count: 0 },
        { id: 3, count: 0 },
      ];
      const columns = ['id', 'count'];

      const report = analyzeDataQuality(rows, columns);

      const zeroIssue = report.issues.find(
        i => i.column === 'count' && i.issueType === 'all_zero'
      );
      expect(zeroIssue).toBeDefined();
      expect(zeroIssue?.severity).toBe('warning');
    });

    it('should detect infinite values', () => {
      const rows = [
        { id: 1, value: 100 },
        { id: 2, value: Infinity },
        { id: 3, value: -Infinity },
      ];
      const columns = ['id', 'value'];

      const report = analyzeDataQuality(rows, columns);

      const infIssue = report.issues.find(
        i => i.column === 'value' && i.issueType === 'infinite_values'
      );
      expect(infIssue).toBeDefined();
      expect(infIssue?.severity).toBe('critical');
      expect(infIssue?.affectedRows).toBe(2);
    });

    it('should detect mixed types', () => {
      const rows = [
        { id: 1, value: 100 },
        { id: 2, value: 'text' },
        { id: 3, value: true },
      ];
      const columns = ['id', 'value'];

      const report = analyzeDataQuality(rows, columns);

      const mixedIssue = report.issues.find(
        i => i.column === 'value' && i.issueType === 'type_mismatch'
      );
      expect(mixedIssue).toBeDefined();
      expect(mixedIssue?.severity).toBe('warning');
    });

    it('should handle empty data', () => {
      const rows: Record<string, unknown>[] = [];
      const columns = ['id', 'name'];

      const report = analyzeDataQuality(rows, columns);

      expect(report.totalRows).toBe(0);
      expect(report.overallQuality).toBe('good');
      expect(report.qualityScore).toBe(100);
      expect(report.issues).toHaveLength(0);
    });

    it('should calculate column statistics correctly', () => {
      const rows = [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: null },
        { id: 3, name: 'Charlie', age: 35 },
        { id: 4, name: 'Alice', age: 28 },
      ];
      const columns = ['id', 'name', 'age'];

      const report = analyzeDataQuality(rows, columns);

      const nameStats = report.columnStats.find(c => c.name === 'name');
      expect(nameStats?.uniqueCount).toBe(3); // Alice, Bob, Charlie
      expect(nameStats?.nullCount).toBe(0);

      const ageStats = report.columnStats.find(c => c.name === 'age');
      expect(ageStats?.nullCount).toBe(1);
      expect(ageStats?.nullPercentage).toBe(25);
    });

    it('should infer column types correctly', () => {
      const rows = [
        { num: 100, date: '2024-01-15', text: 'hello', bool: true },
        { num: 200, date: '2024-02-20', text: 'world', bool: false },
      ];
      const columns = ['num', 'date', 'text', 'bool'];

      const report = analyzeDataQuality(rows, columns);

      expect(report.columnStats.find(c => c.name === 'num')?.inferredType).toBe('numeric');
      expect(report.columnStats.find(c => c.name === 'date')?.inferredType).toBe('date');
      expect(report.columnStats.find(c => c.name === 'text')?.inferredType).toBe('text');
      expect(report.columnStats.find(c => c.name === 'bool')?.inferredType).toBe('boolean');
    });
  });

  describe('filterGarbageData', () => {
    it('should filter rows with null values', () => {
      const rows = [
        { id: 1, value: 100 },
        { id: 2, value: null },
        { id: 3, value: 200 },
      ];
      const columns = ['id', 'value'];

      const result = filterGarbageData(rows, columns, { removeNulls: ['value'] });

      expect(result.filteredRows).toHaveLength(2);
      expect(result.removedCount).toBe(1);
      expect(result.removedReasons.null).toBe(1);
    });

    it('should filter rows with zero values', () => {
      const rows = [
        { id: 1, count: 10 },
        { id: 2, count: 0 },
        { id: 3, count: 5 },
      ];
      const columns = ['id', 'count'];

      const result = filterGarbageData(rows, columns, { removeZeros: ['count'] });

      expect(result.filteredRows).toHaveLength(2);
      expect(result.removedCount).toBe(1);
      expect(result.removedReasons.zero).toBe(1);
    });

    it('should filter rows with infinite values', () => {
      const rows = [
        { id: 1, value: 100 },
        { id: 2, value: Infinity },
        { id: 3, value: 200 },
      ];
      const columns = ['id', 'value'];

      const result = filterGarbageData(rows, columns, { removeInfinites: ['value'] });

      expect(result.filteredRows).toHaveLength(2);
      expect(result.removedCount).toBe(1);
      expect(result.removedReasons.infinite).toBe(1);
    });

    it('should filter rows with empty strings', () => {
      const rows = [
        { id: 1, name: 'Alice' },
        { id: 2, name: '' },
        { id: 3, name: '  ' },
      ];
      const columns = ['id', 'name'];

      const result = filterGarbageData(rows, columns, { removeEmptyStrings: ['name'] });

      expect(result.filteredRows).toHaveLength(1);
      expect(result.removedCount).toBe(2);
      expect(result.removedReasons.emptyString).toBe(2);
    });

    it('should filter across all columns when true is passed', () => {
      const rows = [
        { id: 1, name: 'Alice', age: 30 },
        { id: null, name: 'Bob', age: 25 },
        { id: 3, name: null, age: 35 },
      ];
      const columns = ['id', 'name', 'age'];

      const result = filterGarbageData(rows, columns, { removeNulls: true });

      expect(result.filteredRows).toHaveLength(1);
      expect(result.removedCount).toBe(2);
    });

    it('should apply multiple filters', () => {
      const rows = [
        { id: 1, value: 100 },
        { id: 2, value: null },
        { id: 3, value: 0 },
        { id: 4, value: 200 },
      ];
      const columns = ['id', 'value'];

      const result = filterGarbageData(rows, columns, {
        removeNulls: ['value'],
        removeZeros: ['value'],
      });

      expect(result.filteredRows).toHaveLength(2);
      expect(result.removedCount).toBe(2);
    });

    it('should return all rows when no filters applied', () => {
      const rows = [
        { id: 1, value: null },
        { id: 2, value: 0 },
      ];
      const columns = ['id', 'value'];

      const result = filterGarbageData(rows, columns, {});

      expect(result.filteredRows).toHaveLength(2);
      expect(result.removedCount).toBe(0);
    });
  });

  describe('summarizeDataQuality', () => {
    it('should summarize good quality data', () => {
      const report: DataQualityReport = {
        totalRows: 100,
        totalColumns: 5,
        issues: [],
        columnStats: [],
        overallQuality: 'good',
        qualityScore: 100,
        filteringApplied: false,
      };

      const summary = summarizeDataQuality(report);

      expect(summary).toContain('good');
      expect(summary).toContain('No significant issues');
    });

    it('should summarize critical issues', () => {
      const report: DataQualityReport = {
        totalRows: 100,
        totalColumns: 5,
        issues: [
          {
            column: 'status',
            issueType: 'all_null',
            severity: 'critical',
            description: 'Column "status" contains only NULL values',
            affectedRows: 100,
            percentage: 100,
          },
        ],
        columnStats: [],
        overallQuality: 'poor',
        qualityScore: 50,
        filteringApplied: false,
      };

      const summary = summarizeDataQuality(report);

      expect(summary).toContain('critical');
      expect(summary).toContain('NULL');
    });

    it('should summarize multiple issues', () => {
      const report: DataQualityReport = {
        totalRows: 100,
        totalColumns: 5,
        issues: [
          {
            column: 'status',
            issueType: 'all_null',
            severity: 'critical',
            description: 'Column "status" contains only NULL values',
            affectedRows: 100,
            percentage: 100,
          },
          {
            column: 'count',
            issueType: 'all_zero',
            severity: 'warning',
            description: 'Column "count" contains only zero values',
            affectedRows: 100,
            percentage: 100,
          },
        ],
        columnStats: [],
        overallQuality: 'poor',
        qualityScore: 30,
        filteringApplied: false,
      };

      const summary = summarizeDataQuality(report);

      expect(summary).toContain('1 critical');
      expect(summary).toContain('1 warning');
    });
  });
});
