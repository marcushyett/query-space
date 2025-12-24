'use client';

import { Editor } from '@monaco-editor/react';
import { useQueryStore } from '@/stores/queryStore';
import { useEffect } from 'react';

export function SqlEditor() {
  const { currentQuery, setCurrentQuery } = useQueryStore();

  const handleChange = (value: string | undefined) => {
    const newQuery = value || '';
    setCurrentQuery(newQuery);
  };

  useEffect(() => {
    // Load query from URL on mount (will implement in Phase 4)
  }, []);

  return (
    <div style={{ height: '100%', border: '1px solid #333' }}>
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
