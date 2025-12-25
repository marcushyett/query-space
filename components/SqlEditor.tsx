'use client';

import { useRef, useCallback, useEffect } from 'react';
import { Editor, type Monaco } from '@monaco-editor/react';
import type { editor, Position, IRange } from 'monaco-editor';
import { Button, Grid } from 'antd';
import { FormatPainterOutlined } from '@ant-design/icons';
import { useQueryStore } from '@/stores/queryStore';
import { useSchemaStore } from '@/stores/schemaStore';
import type { SchemaTable } from '@/app/api/schema/route';
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
  const monacoRef = useRef<Monaco | null>(null);
  // Use ref to always access latest tables in completion provider
  const tablesRef = useRef<SchemaTable[]>(tables);

  // Keep tablesRef updated with latest tables
  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

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
    // Store monaco reference for potential future use
    monacoRef.current = monaco;

    // Auto-format on Enter key
    editorInstance.onKeyDown((e) => {
      if (e.keyCode === monaco.KeyCode.Enter) {
        // Use setTimeout to let the Enter key insert the newline first
        setTimeout(() => {
          const currentValue = editorInstance.getValue();
          if (currentValue) {
            const formatted = formatSql(currentValue);
            if (formatted !== currentValue) {
              const position = editorInstance.getPosition();
              editorInstance.setValue(formatted);
              // Restore cursor position approximately
              if (position) {
                editorInstance.setPosition(position);
              }
            }
          }
        }, 0);
      }
    });

    // Dispose of any existing provider
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
    }

    // Register completion provider - uses tablesRef to always access latest tables
    completionProviderRef.current = monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: ['.', ' ', '"', "'"],
      provideCompletionItems: (model: editor.ITextModel, position: Position) => {
        // Access tables via ref to get latest value
        const currentTables = tablesRef.current;

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
          let targetTable = currentTables.find(t => t.name.toLowerCase() === tableAlias);

          if (!targetTable && aliasMatch) {
            const tableName = aliasMatch[1].includes('.')
              ? aliasMatch[1].split('.')[1]
              : aliasMatch[1];
            targetTable = currentTables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
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
        // Quote table names for PostgreSQL compatibility
        const afterFromOrJoin = /\b(FROM|JOIN)\s+\w*$/i.test(textBeforeCursor);
        currentTables.forEach((table, index) => {
          const displayName = table.schema === 'public' ? table.name : `${table.schema}.${table.name}`;
          // Quote table names for PostgreSQL - use double quotes
          const quotedName = table.schema === 'public'
            ? `"${table.name}"`
            : `"${table.schema}"."${table.name}"`;
          suggestions.push({
            label: displayName,
            kind: table.type === 'view'
              ? monaco.languages.CompletionItemKind.Interface
              : monaco.languages.CompletionItemKind.Class,
            insertText: quotedName,
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
        // For PostgreSQL, use just column names (not table.column)
        const afterSelect = /\bSELECT\s+(?:(?!FROM)[^])*$/i.test(textBeforeCursor);
        if (afterSelect && !dotMatch) {
          currentTables.forEach((table) => {
            table.columns.forEach((col, colIndex) => {
              suggestions.push({
                label: col.name,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col.name,
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
  }, []);

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
