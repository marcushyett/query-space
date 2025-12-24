'use client';

import { useRef, useCallback } from 'react';
import { Editor, type Monaco } from '@monaco-editor/react';
import type { editor, Position, IRange } from 'monaco-editor';
import { Button, Grid } from 'antd';
import { FormatPainterOutlined } from '@ant-design/icons';
import { useQueryStore } from '@/stores/queryStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { useUrlState } from '@/hooks/useUrlState';
import { formatSql } from '@/lib/sql-formatter';

const { useBreakpoint } = Grid;

// SQL keywords for autocomplete
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL', 'CROSS', 'ON',
  'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE',
  'ALTER', 'DROP', 'INDEX', 'VIEW', 'AS', 'DISTINCT', 'ALL', 'UNION',
  'INTERSECT', 'EXCEPT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'NULL',
  'TRUE', 'FALSE', 'IS', 'EXISTS', 'ANY', 'SOME', 'COUNT', 'SUM', 'AVG',
  'MIN', 'MAX', 'COALESCE', 'NULLIF', 'CAST', 'EXTRACT', 'DATE', 'TIME',
  'TIMESTAMP', 'INTERVAL', 'WITH', 'RECURSIVE', 'OVER', 'PARTITION',
  'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'FIRST_VALUE', 'LAST_VALUE', 'LAG', 'LEAD',
];

// PostgreSQL functions for autocomplete
const PG_FUNCTIONS = [
  'NOW()', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
  'DATE_TRUNC', 'DATE_PART', 'AGE', 'TO_CHAR', 'TO_DATE', 'TO_TIMESTAMP',
  'LOWER', 'UPPER', 'INITCAP', 'TRIM', 'LTRIM', 'RTRIM', 'CONCAT', 'LENGTH',
  'SUBSTRING', 'REPLACE', 'SPLIT_PART', 'REGEXP_REPLACE', 'REGEXP_MATCHES',
  'ROUND', 'FLOOR', 'CEIL', 'ABS', 'POWER', 'SQRT', 'MOD', 'RANDOM',
  'GENERATE_SERIES', 'ARRAY_AGG', 'STRING_AGG', 'JSON_AGG', 'JSONB_AGG',
  'JSON_BUILD_OBJECT', 'JSONB_BUILD_OBJECT', 'JSON_EXTRACT_PATH', 'JSONB_EXTRACT_PATH',
  'GREATEST', 'LEAST', 'COALESCE', 'NULLIF',
];

export function SqlEditor() {
  const { currentQuery, setCurrentQuery } = useQueryStore();
  const tables = useSchemaStore((state) => state.tables);
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const completionProviderRef = useRef<{ dispose: () => void } | null>(null);

  // Sync query with URL parameters
  useUrlState();

  const handleChange = (value: string | undefined) => {
    const newQuery = value || '';
    setCurrentQuery(newQuery);
  };

  const handleFormat = () => {
    if (currentQuery) {
      const formatted = formatSql(currentQuery);
      setCurrentQuery(formatted);
    }
  };

  const handleEditorMount = useCallback((editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    // Dispose of any existing provider
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
    }

    // Register completion provider
    completionProviderRef.current = monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: ['.', ' ', '"', "'"],
      provideCompletionItems: (model: editor.ITextModel, position: Position) => {
        const word = model.getWordUntilPosition(position);
        const range: IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        // Get text before cursor to determine context
        const textBeforeCursor = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const suggestions: {
          label: string;
          kind: typeof monaco.languages.CompletionItemKind[keyof typeof monaco.languages.CompletionItemKind];
          insertText: string;
          range: IRange;
          detail?: string;
          sortText?: string;
        }[] = [];

        // Check if we're after a dot (column context)
        const dotMatch = textBeforeCursor.match(/(\w+)\.\s*\w*$/);
        if (dotMatch) {
          const tableAlias = dotMatch[1].toLowerCase();

          // Find table by name or check for alias in the query
          const aliasMatch = textBeforeCursor.match(new RegExp(`(\\w+\\.\\w+|\\w+)\\s+(?:AS\\s+)?${tableAlias}\\b`, 'i'));
          let targetTable = tables.find(t => t.name.toLowerCase() === tableAlias);

          if (!targetTable && aliasMatch) {
            const tableName = aliasMatch[1].includes('.')
              ? aliasMatch[1].split('.')[1]
              : aliasMatch[1];
            targetTable = tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
          }

          if (targetTable) {
            // Add columns for this table
            targetTable.columns.forEach((col, index) => {
              suggestions.push({
                label: col.name,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col.name,
                range,
                detail: `${col.type}${col.isPrimaryKey ? ' (PK)' : ''}`,
                sortText: `0${index.toString().padStart(3, '0')}`,
              });
            });
          }
        }

        // Add table suggestions (higher priority after FROM/JOIN)
        const afterFromOrJoin = /\b(FROM|JOIN)\s+\w*$/i.test(textBeforeCursor);
        tables.forEach((table, index) => {
          const fullName = table.schema === 'public' ? table.name : `${table.schema}.${table.name}`;
          suggestions.push({
            label: fullName,
            kind: table.type === 'view'
              ? monaco.languages.CompletionItemKind.Interface
              : monaco.languages.CompletionItemKind.Class,
            insertText: fullName,
            range,
            detail: `${table.type} (${table.columns.length} columns)`,
            sortText: afterFromOrJoin ? `0${index.toString().padStart(3, '0')}` : `2${index.toString().padStart(3, '0')}`,
          });
        });

        // Add SQL keywords
        SQL_KEYWORDS.forEach((kw, index) => {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range,
            detail: 'SQL Keyword',
            sortText: `3${index.toString().padStart(3, '0')}`,
          });
        });

        // Add PostgreSQL functions
        PG_FUNCTIONS.forEach((fn, index) => {
          suggestions.push({
            label: fn,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: fn,
            range,
            detail: 'PostgreSQL Function',
            sortText: `4${index.toString().padStart(3, '0')}`,
          });
        });

        // Add column suggestions from all tables if in SELECT context
        const afterSelect = /\bSELECT\s+(?:(?!FROM)[^])*$/i.test(textBeforeCursor);
        if (afterSelect && !dotMatch) {
          tables.forEach((table) => {
            table.columns.forEach((col, colIndex) => {
              const label = `${table.name}.${col.name}`;
              suggestions.push({
                label,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: label,
                range,
                detail: `${col.type} from ${table.name}`,
                sortText: `1${colIndex.toString().padStart(3, '0')}`,
              });
            });
          });
        }

        return { suggestions };
      },
    });

    // Configure editor settings
    editorInstance.updateOptions({
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true,
      },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      tabCompletion: 'on',
      wordBasedSuggestions: 'off',
    });
  }, [tables]);

  return (
    <div className="sql-editor-container" style={{ position: 'relative' }}>
      <Editor
        height="100%"
        language="sql"
        theme="vs-dark"
        value={currentQuery}
        onChange={handleChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: isMobile ? 13 : 14,
          fontFamily: 'JetBrains Mono, monospace',
          lineNumbers: 'on',
          wordWrap: 'on',
          automaticLayout: true,
          padding: { top: 16, bottom: 16 },
          scrollBeyondLastLine: false,
          renderWhitespace: 'selection',
          tabSize: 2,
          insertSpaces: true,
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
        }}
      />
      <Button
        type="text"
        size="small"
        icon={<FormatPainterOutlined />}
        onClick={handleFormat}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.6)',
          borderColor: '#333',
        }}
        aria-label="Format SQL"
      >
        {!isMobile && 'Format'}
      </Button>
    </div>
  );
}
