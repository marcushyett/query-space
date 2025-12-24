'use client';

import { useState } from 'react';
import { Modal, Input, Button, Alert } from 'antd';
import { useConnectionStore } from '@/stores/connectionStore';
import { useUiStore } from '@/stores/uiStore';

export function ConnectionDialog() {
  const { connectionDialogOpen, setConnectionDialogOpen } = useUiStore();
  const { setConnectionString } = useConnectionStore();
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleConnect = () => {
    if (!inputValue.trim()) {
      setError('Connection string is required');
      return;
    }

    // Basic validation for PostgreSQL connection string format
    if (!inputValue.includes('postgresql://') && !inputValue.includes('postgres://')) {
      setError('Invalid connection string format. Expected: postgresql://user:password@host:port/database');
      return;
    }

    setConnectionString(inputValue.trim());
    setConnectionDialogOpen(false);
    setInputValue('');
    setError(null);
  };

  const handleCancel = () => {
    setConnectionDialogOpen(false);
    setInputValue('');
    setError(null);
  };

  return (
    <Modal
      title="Connect to PostgreSQL Database"
      open={connectionDialogOpen}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button key="connect" type="primary" onClick={handleConnect}>
          Connect
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Alert
          message="Security Notice"
          description="Your connection string will be stored in browser localStorage and sent to API routes for query execution. Never use this on a shared computer or with production databases containing sensitive data."
          type="warning"
          showIcon
          className="greyscale-alert"
          style={{ marginBottom: 16 }}
        />

        <label style={{ display: 'block', marginBottom: 8 }}>
          Connection String:
        </label>
        <Input.TextArea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="postgresql://username:password@localhost:5432/database"
          rows={3}
          status={error ? 'error' : ''}
        />
        {error && (
          <div style={{ color: '#ff4d4f', marginTop: 8, fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
          <strong>Recommended:</strong> Use a read-only database user (SELECT-only permissions) to prevent accidental data modification.
        </div>
      </div>
    </Modal>
  );
}
