'use client';

import { useState, useCallback } from 'react';
import { Modal, Input, Button, Space, Typography, Grid } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useUiStore } from '@/stores/uiStore';
import { useQueryStore } from '@/stores/queryStore';
import { useAiQuery } from '@/hooks/useAiQuery';

const { Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

export function AiQueryModal() {
  const { aiModalOpen, setAiModalOpen } = useUiStore();
  const { setCurrentQuery } = useQueryStore();
  const { generateQuery, isGenerating } = useAiQuery();
  const screens = useBreakpoint();

  // Detect mobile (screens smaller than md breakpoint)
  const isMobile = !screens.md;

  const [promptInput, setPromptInput] = useState('');

  const handleAfterOpenChange = useCallback((open: boolean) => {
    if (!open) {
      // When closing, clear prompt
      setPromptInput('');
    }
  }, []);

  const handleGenerate = async () => {
    const generatedSql = await generateQuery(promptInput);

    if (generatedSql) {
      setCurrentQuery(generatedSql);
      handleClose();
    }
  };

  const handleClose = () => {
    setAiModalOpen(false);
    setPromptInput('');
  };

  return (
    <Modal
      title={
        <Space>
          <RobotOutlined />
          Generate SQL with AI
        </Space>
      }
      open={aiModalOpen}
      onCancel={handleClose}
      afterOpenChange={handleAfterOpenChange}
      footer={
        <div className={isMobile ? 'ai-modal-footer-mobile' : 'ai-modal-footer'}>
          <Button key="cancel" onClick={handleClose} className={isMobile ? 'ai-modal-btn-mobile' : ''}>
            Cancel
          </Button>
          <Button
            key="generate"
            type="primary"
            onClick={handleGenerate}
            loading={isGenerating}
            disabled={!promptInput.trim()}
            className={isMobile ? 'ai-modal-btn-mobile' : ''}
          >
            Generate
          </Button>
        </div>
      }
      width={isMobile ? '100%' : 560}
      style={isMobile ? { top: 0, maxWidth: '100%', margin: 0, paddingBottom: 0 } : undefined}
      className={isMobile ? 'ai-modal-mobile' : ''}
    >
      <div className="ai-modal-content">
        <div className="ai-modal-section">
          <label className="ai-modal-label">Describe your query:</label>
          <TextArea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder={isMobile
              ? "e.g., 'Show all users who signed up in the last 30 days'"
              : "Describe the query you want to generate, e.g., 'Show all users who signed up in the last 30 days'"
            }
            rows={isMobile ? 5 : 4}
            className={isMobile ? 'ai-modal-textarea-mobile' : ''}
            onPressEnter={(e) => {
              // Submit on Cmd+Enter or Ctrl+Enter (desktop only)
              if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                if (promptInput.trim()) {
                  handleGenerate();
                }
              }
            }}
          />
          {!isMobile && (
            <Text type="secondary" className="text-xs">
              Press Cmd+Enter to generate
            </Text>
          )}
        </div>

        <div className="ai-modal-info">
          <Text type="secondary" className="text-xs">
            Your database schema will be included as context for accurate SQL generation.
            The generated query will be inserted into the editor for review before execution.
          </Text>
        </div>
      </div>
    </Modal>
  );
}
