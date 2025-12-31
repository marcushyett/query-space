'use client';

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { DashboardWidget, WidgetConfig } from '@/stores/dashboardStore';

interface TextWidgetProps {
  widget: DashboardWidget;
}

export function TextWidget({ widget }: TextWidgetProps) {
  const config: WidgetConfig = widget.config || {};
  const content = config.content || '';

  const markdownContent = useMemo(() => {
    // If no content, show placeholder
    if (!content.trim()) {
      return '*No content*';
    }
    return content;
  }, [content]);

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding: 16,
      }}
      className="text-widget-content"
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 16px', color: '#fff' }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 12px', color: '#fff' }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px', color: '#fff' }}>
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p style={{ fontSize: 14, margin: '0 0 12px', color: '#ccc', lineHeight: 1.6 }}>
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul style={{ margin: '0 0 12px', paddingLeft: 20, color: '#ccc' }}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: '0 0 12px', paddingLeft: 20, color: '#ccc' }}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li style={{ fontSize: 14, marginBottom: 4, lineHeight: 1.5 }}>
              {children}
            </li>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1668dc', textDecoration: 'none' }}
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code
              style={{
                background: '#1a1a1a',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 13,
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                color: '#e0e0e0',
              }}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre
              style={{
                background: '#1a1a1a',
                padding: 12,
                borderRadius: 6,
                overflow: 'auto',
                margin: '0 0 12px',
                fontSize: 13,
                fontFamily: 'var(--font-jetbrains-mono), monospace',
              }}
            >
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote
              style={{
                borderLeft: '3px solid #333',
                paddingLeft: 16,
                margin: '0 0 12px',
                color: '#888',
                fontStyle: 'italic',
              }}
            >
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr
              style={{
                border: 'none',
                borderTop: '1px solid #333',
                margin: '16px 0',
              }}
            />
          ),
          strong: ({ children }) => (
            <strong style={{ fontWeight: 600, color: '#fff' }}>{children}</strong>
          ),
          em: ({ children }) => (
            <em style={{ fontStyle: 'italic', color: '#ccc' }}>{children}</em>
          ),
        }}
      >
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
}
