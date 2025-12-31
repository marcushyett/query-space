'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Input,
  Button,
  Modal,
  Form,
  Select,
  message,
  Typography,
} from 'antd';
import { TechSpinner } from '@/components/TechSpinner';
import {
  SearchOutlined,
  PlusOutlined,
  AppstoreOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useOrganization } from '../layout';

const { Text } = Typography;

interface DashboardListItem {
  id: string;
  title: string;
  description: string | null;
  organizationId: string;
  organizationName: string | null;
  widgetCount: number;
  projects: { id: string; title: string }[];
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  title: string;
}

export default function DashboardsPage() {
  const router = useRouter();
  const { currentOrg, loading: orgLoading } = useOrganization();

  const [dashboards, setDashboards] = useState<DashboardListItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create dashboard modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (orgLoading || !currentOrg) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [dashboardsRes, projectsRes] = await Promise.all([
          fetch(`/api/dashboards?organizationId=${currentOrg.id}`),
          fetch(`/api/projects?organizationId=${currentOrg.id}`),
        ]);

        const dashboardsData = await dashboardsRes.json();
        const projectsData = await projectsRes.json();

        if (dashboardsRes.ok) {
          setDashboards(dashboardsData.dashboards || []);
        }

        if (projectsRes.ok) {
          setProjects(projectsData.projects || []);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentOrg, orgLoading]);

  const filteredDashboards = dashboards.filter((d) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      d.title.toLowerCase().includes(term) ||
      d.description?.toLowerCase().includes(term)
    );
  });

  const handleCreateDashboard = async (values: {
    title: string;
    description?: string;
    projectIds?: string[];
  }) => {
    if (!currentOrg) return;

    setCreating(true);
    try {
      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          title: values.title,
          description: values.description,
          projectIds: values.projectIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create dashboard');
      }

      const data = await res.json();
      message.success('Dashboard created');
      setCreateModalOpen(false);
      form.resetFields();

      // Navigate to the new dashboard
      router.push(`/dashboards/${data.dashboard.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create dashboard';
      message.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  if (orgLoading) {
    return (
      <div className="loading-state-large">
        <TechSpinner size="large" />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <Input
          placeholder="Search dashboards..."
          prefix={<SearchOutlined style={{ color: '#666' }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
          allowClear
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalOpen(true)}
        >
          New Dashboard
        </Button>
      </div>

      {/* Dashboards List */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {loading ? (
          <div className="loading-state">
            <TechSpinner />
          </div>
        ) : filteredDashboards.length === 0 ? (
          <div className="empty-state-action">
            <div className="empty-state-icon">
              <AppstoreOutlined />
            </div>
            <div className="empty-state-title">
              {search ? 'No dashboards found' : 'No dashboards yet'}
            </div>
            <div className="empty-state-description">
              {search
                ? 'Try a different search term'
                : 'Create a dashboard to visualize your data with charts and KPIs'}
            </div>
            {!search && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalOpen(true)}
              >
                Create your first dashboard
              </Button>
            )}
          </div>
        ) : (
          <div className="item-grid">
            {filteredDashboards.map((dashboard) => (
              <div
                key={dashboard.id}
                className="query-card"
                onClick={() => router.push(`/dashboards/${dashboard.id}`)}
              >
                <div className="query-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: '#1a1a1a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <BarChartOutlined style={{ color: '#1668dc', fontSize: 16 }} />
                    </div>
                    <div>
                      <h4 className="query-card-title">{dashboard.title}</h4>
                      <div className="query-card-meta">
                        Updated {formatDate(dashboard.updatedAt)}
                      </div>
                    </div>
                  </div>
                </div>

                {dashboard.description && (
                  <Text
                    type="secondary"
                    style={{ fontSize: 12, display: 'block', marginBottom: 12 }}
                  >
                    {dashboard.description.length > 100
                      ? `${dashboard.description.slice(0, 100)}...`
                      : dashboard.description}
                  </Text>
                )}

                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#666' }}>
                  <span>
                    <AppstoreOutlined style={{ marginRight: 4 }} />
                    {dashboard.widgetCount}{' '}
                    {dashboard.widgetCount === 1 ? 'widget' : 'widgets'}
                  </span>
                  {dashboard.projects.length > 0 && (
                    <span>
                      {dashboard.projects.length}{' '}
                      {dashboard.projects.length === 1 ? 'project' : 'projects'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Dashboard Modal */}
      <Modal
        title="Create Dashboard"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateDashboard}>
          <Form.Item
            name="title"
            label="Dashboard Name"
            rules={[{ required: true, message: 'Please enter a dashboard name' }]}
          >
            <Input placeholder="e.g., Sales Overview" />
          </Form.Item>

          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea placeholder="What does this dashboard show?" rows={3} />
          </Form.Item>

          <Form.Item
            name="projectIds"
            label="Link Projects"
            extra="Select projects to pull charts and queries from"
          >
            <Select
              mode="multiple"
              placeholder="Select projects"
              options={projects.map((p) => ({ label: p.title, value: p.id }))}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button onClick={() => setCreateModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={creating}>
                Create Dashboard
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
