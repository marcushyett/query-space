'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Input,
  Dropdown,
  message,
  Modal,
  Form,
  Tooltip,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  MoreOutlined,
  DeleteOutlined,
  CopyOutlined,
  SettingOutlined,
  ArrowLeftOutlined,
  SaveOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useDashboardStore } from '@/stores/dashboardStore';

interface DashboardHeaderProps {
  onSaveLayout: () => Promise<void>;
}

export function DashboardHeader({ onSaveLayout }: DashboardHeaderProps) {
  const router = useRouter();
  const {
    dashboard,
    isEditMode,
    setEditMode,
    setAddWidgetOpen,
    isSaving,
    setSaving,
    setDashboard,
    clearWidgetData,
  } = useDashboardStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(dashboard?.title || '');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsForm] = Form.useForm();

  const handleTitleSave = useCallback(async () => {
    if (!dashboard || !editedTitle.trim()) return;

    try {
      const response = await fetch(`/api/dashboards/${dashboard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editedTitle.trim() }),
      });

      if (!response.ok) throw new Error('Failed to update title');

      setDashboard({ ...dashboard, title: editedTitle.trim() });
      setIsEditing(false);
      message.success('Title updated');
    } catch (error) {
      console.error('Failed to update title:', error);
      message.error('Failed to update title');
    }
  }, [dashboard, editedTitle, setDashboard]);

  const handleDelete = useCallback(async () => {
    if (!dashboard) return;

    Modal.confirm({
      title: 'Delete Dashboard',
      content: 'Are you sure you want to delete this dashboard? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await fetch(`/api/dashboards/${dashboard.id}`, {
            method: 'DELETE',
          });

          if (!response.ok) throw new Error('Failed to delete dashboard');

          message.success('Dashboard deleted');
          router.push('/dashboards');
        } catch (error) {
          console.error('Failed to delete dashboard:', error);
          message.error('Failed to delete dashboard');
        }
      },
    });
  }, [dashboard, router]);

  const handleDuplicate = useCallback(async () => {
    if (!dashboard) return;

    try {
      const response = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: dashboard.organizationId,
          title: `${dashboard.title} (Copy)`,
          description: dashboard.description,
          projectIds: dashboard.projects.map((p) => p.id),
        }),
      });

      if (!response.ok) throw new Error('Failed to duplicate dashboard');

      const { dashboard: newDashboard } = await response.json();
      message.success('Dashboard duplicated');
      router.push(`/dashboards/${newDashboard.id}`);
    } catch (error) {
      console.error('Failed to duplicate dashboard:', error);
      message.error('Failed to duplicate dashboard');
    }
  }, [dashboard, router]);

  const handleRefreshAll = useCallback(() => {
    clearWidgetData();
    message.info('Refreshing all widgets...');
  }, [clearWidgetData]);

  const handleSaveAndExit = useCallback(async () => {
    setSaving(true);
    try {
      await onSaveLayout();
      setEditMode(false);
      message.success('Dashboard saved');
    } catch (error) {
      console.error('Failed to save dashboard:', error);
      message.error('Failed to save dashboard');
    } finally {
      setSaving(false);
    }
  }, [onSaveLayout, setEditMode, setSaving]);

  const handleSettingsSave = useCallback(
    async (values: { title: string; description: string }) => {
      if (!dashboard) return;

      try {
        const response = await fetch(`/api/dashboards/${dashboard.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });

        if (!response.ok) throw new Error('Failed to update settings');

        setDashboard({
          ...dashboard,
          title: values.title,
          description: values.description,
        });
        setIsSettingsOpen(false);
        message.success('Settings updated');
      } catch (error) {
        console.error('Failed to update settings:', error);
        message.error('Failed to update settings');
      }
    },
    [dashboard, setDashboard]
  );

  const menuItems: MenuProps['items'] = [
    {
      key: 'settings',
      label: 'Settings',
      icon: <SettingOutlined />,
      onClick: () => {
        settingsForm.setFieldsValue({
          title: dashboard?.title,
          description: dashboard?.description || '',
        });
        setIsSettingsOpen(true);
      },
    },
    {
      key: 'duplicate',
      label: 'Duplicate',
      icon: <CopyOutlined />,
      onClick: handleDuplicate,
    },
    { type: 'divider' },
    {
      key: 'delete',
      label: 'Delete',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: handleDelete,
    },
  ];

  if (!dashboard) return null;

  return (
    <>
      <div className="dashboard-header">
        {/* Left side: Back button and title */}
        <div className="dashboard-header-left">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/dashboards')}
            style={{ color: '#888' }}
          />

          {isEditing ? (
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onPressEnter={handleTitleSave}
              autoFocus
              className="dashboard-title-input"
            />
          ) : (
            <div
              className="dashboard-title"
              onClick={() => {
                if (isEditMode) {
                  setEditedTitle(dashboard.title);
                  setIsEditing(true);
                }
              }}
              style={{ cursor: isEditMode ? 'pointer' : 'default' }}
            >
              <span className="dashboard-title-text">
                {dashboard.title}
              </span>
              {isEditMode && (
                <EditOutlined style={{ color: '#666', fontSize: 14 }} />
              )}
            </div>
          )}
        </div>

        {/* Right side: Actions */}
        <div className="dashboard-header-actions">
          {!isEditMode && (
            <Tooltip title="Refresh all widgets">
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={handleRefreshAll}
              />
            </Tooltip>
          )}

          {isEditMode ? (
            <>
              <Button
                icon={<PlusOutlined />}
                onClick={() => setAddWidgetOpen(true)}
                className="add-widget-btn"
              >
                <span className="btn-text">Add Widget</span>
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveAndExit}
                loading={isSaving}
              >
                <span className="btn-text">Done</span>
              </Button>
            </>
          ) : (
            <Button
              icon={<EditOutlined />}
              onClick={() => setEditMode(true)}
            >
              <span className="btn-text">Edit</span>
            </Button>
          )}

          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        </div>
      </div>

      <style jsx global>{`
        .dashboard-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid #222;
          background: #0a0a0a;
          gap: 8px;
        }

        .dashboard-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }

        .dashboard-title {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .dashboard-title-text {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dashboard-title-input {
          width: 300px;
          font-size: 16px;
          font-weight: 600;
        }

        .dashboard-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        /* Mobile styles */
        @media (max-width: 768px) {
          .dashboard-header {
            padding: 8px 12px;
          }

          .dashboard-header-left {
            gap: 8px;
          }

          .dashboard-title-text {
            font-size: 14px;
            max-width: 120px;
          }

          .dashboard-title-input {
            width: 150px;
            font-size: 14px;
          }

          .dashboard-header-actions {
            gap: 4px;
          }

          .dashboard-header-actions .btn-text {
            display: none;
          }

          .add-widget-btn .btn-text {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .dashboard-title-text {
            max-width: 80px;
          }
        }
      `}</style>

      {/* Settings Modal */}
      <Modal
        title="Dashboard Settings"
        open={isSettingsOpen}
        onCancel={() => setIsSettingsOpen(false)}
        footer={null}
      >
        <Form
          form={settingsForm}
          layout="vertical"
          onFinish={handleSettingsSave}
        >
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter a title' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional description" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                Save
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
