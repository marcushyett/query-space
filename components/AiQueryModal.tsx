'use client';

import { useState, useCallback, useRef } from 'react';
import { Modal, Input, Button, Checkbox, Space, Typography, Grid } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useUiStore } from '@/stores/uiStore';
import { useAiStore } from '@/stores/aiStore';
import { useQueryStore } from '@/stores/queryStore';
import { useAiQuery } from '@/hooks/useAiQuery';

const { Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

export function AiQueryModal() {
  const { aiModalOpen, setAiModalOpen } = useUiStore();
  const { apiKey: storedApiKey, persistApiKey, setApiKey, setPersistApiKey } = useAiStore();
  const { setCurrentQuery } = useQueryStore();
  const { generateQuery, isGenerating } = useAiQuery();
  const screens = useBreakpoint();

  // Detect mobile (screens smaller than md breakpoint)
  const isMobile = !screens.md;

  // Initialize with stored values - these will be updated when modal closes and reopens
  const [apiKeyInput, setApiKeyInput] = useState(storedApiKey || '');
  const [promptInput, setPromptInput] = useState('');
  const [shouldPersist, setShouldPersist] = useState(persistApiKey);

  // Track the last known stored values to detect changes
  const lastStoredApiKeyRef = useRef(storedApiKey);
  const lastPersistApiKeyRef = useRef(persistApiKey);

  // Reset prompt when modal closes, and sync stored values when they change
  const handleAfterOpenChange = useCallback((open: boolean) => {
    if (open) {
      // When opening, sync with stored values if they've changed
      if (lastStoredApiKeyRef.current !== storedApiKey) {
        setApiKeyInput(storedApiKey || '');
        lastStoredApiKeyRef.current = storedApiKey;
      }
      if (lastPersistApiKeyRef.current !== persistApiKey) {
        setShouldPersist(persistApiKey);
        lastPersistApiKeyRef.current = persistApiKey;
      }
    } else {
      // When closing, clear prompt
      setPromptInput('');
    }
  }, [storedApiKey, persistApiKey]);

  const handleGenerate = async () => {
    // Store API key if persist is checked
    if (shouldPersist && apiKeyInput) {
      setApiKey(apiKeyInput);
      setPersistApiKey(true);
    } else if (!shouldPersist) {
      // Temporarily set API key for this request
      setApiKey(apiKeyInput);
    }

    const generatedSql = await generateQuery(promptInput);

    if (generatedSql) {
      setCurrentQuery(generatedSql);
      handleClose();
    }
  };

  const handleClose = () => {
    setAiModalOpen(false);
    setPromptInput('');
    // Only clear API key input if not persisting
    if (!shouldPersist) {
      setApiKeyInput('');
    }
  };

  const handlePersistChange = (checked: boolean) => {
    setShouldPersist(checked);
    if (!checked) {
      // Clear stored API key when unchecking
      setPersistApiKey(false);
    }
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
            disabled={!apiKeyInput || !promptInput.trim()}
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
          <label className="ai-modal-label">Claude API Key:</label>
          <Input.Password
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="sk-ant-..."
            status={apiKeyInput ? '' : undefined}
          />
          <div className="ai-modal-checkbox">
            <Checkbox
              checked={shouldPersist}
              onChange={(e) => handlePersistChange(e.target.checked)}
            >
              Remember API key
            </Checkbox>
            <Text type="secondary" className="text-xs">
              (stored in browser localStorage)
            </Text>
          </div>
        </div>

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
                if (apiKeyInput && promptInput.trim()) {
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
