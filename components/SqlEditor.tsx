'use client';

import { Editor } from '@monaco-editor/react';
import { Button, Grid } from 'antd';
import { FormatPainterOutlined } from '@ant-design/icons';
import { useQueryStore } from '@/stores/queryStore';
import { useUrlState } from '@/hooks/useUrlState';
import { formatSql } from '@/lib/sql-formatter';

const { useBreakpoint } = Grid;

export function SqlEditor() {
  const { currentQuery, setCurrentQuery } = useQueryStore();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

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

  return (
    <div className="sql-editor-container" style={{ position: 'relative' }}>
      <Editor
        height="100%"
        language="sql"
        theme="vs-dark"
        value={currentQuery}
        onChange={handleChange}
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
