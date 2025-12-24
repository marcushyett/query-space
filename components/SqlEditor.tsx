'use client';

import { Editor } from '@monaco-editor/react';
import { useQueryStore } from '@/stores/queryStore';
import { useUrlState } from '@/hooks/useUrlState';

export function SqlEditor() {
  const { currentQuery, setCurrentQuery } = useQueryStore();

  // Sync query with URL parameters
  useUrlState();

  const handleChange = (value: string | undefined) => {
    const newQuery = value || '';
    setCurrentQuery(newQuery);
  };

  return (
    <div className="sql-editor-container">
      <Editor
        height="100%"
        language="sql"
        theme="vs-dark"
        value={currentQuery}
        onChange={handleChange}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
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
    </div>
  );
}
