'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Input,
  Button,
  Modal,
  Form,
  message,
  Typography,
} from 'antd'
import { TechSpinner } from '@/components/TechSpinner'
import {
  SearchOutlined,
  PlusOutlined,
  FolderOutlined,
  CodeOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { useOrganization } from './layout'

const { Text } = Typography

interface Project {
  id: string
  title: string
  description: string | null
  queryCount: number
  chatCount: number
  updatedAt: string
}

export default function ProjectsPage() {
  const router = useRouter()
  const { currentOrg, loading: orgLoading } = useOrganization()

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Create project modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    if (orgLoading || !currentOrg) return

    const fetchProjects = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          organizationId: currentOrg.id,
          ...(search && { search }),
        })

        const res = await fetch(`/api/projects?${params}`)
        const data = await res.json()

        if (res.ok) {
          setProjects(data.projects || [])
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [currentOrg, orgLoading, search])

  const handleCreateProject = async (values: { title: string; description?: string }) => {
    if (!currentOrg) return

    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          title: values.title,
          description: values.description,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create project')
      }

      const data = await res.json()
      message.success('Project created')
      setCreateModalOpen(false)
      form.resetFields()

      // Navigate to the new project
      router.push(`/projects/${data.project.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create project'
      message.error(msg)
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  if (orgLoading) {
    return (
      <div className="loading-state-large">
        <TechSpinner size="large" />
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <Input
          placeholder="Search projects..."
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
          New Project
        </Button>
      </div>

      {/* Projects List */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {loading ? (
          <div className="loading-state">
            <TechSpinner />
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state-action">
            <div className="empty-state-icon">
              <FolderOutlined />
            </div>
            <div className="empty-state-title">
              {search ? 'No projects found' : 'No projects yet'}
            </div>
            <div className="empty-state-description">
              {search
                ? 'Try a different search term'
                : 'Create a project to start organizing your queries and analysis'}
            </div>
            {!search && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalOpen(true)}
              >
                Create your first project
              </Button>
            )}
          </div>
        ) : (
          <div className="item-grid">
            {projects.map((project) => (
              <div
                key={project.id}
                className="query-card"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <div className="query-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: '#1a1a1a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <FolderOutlined style={{ color: '#888', fontSize: 16 }} />
                    </div>
                    <div>
                      <h4 className="query-card-title">{project.title}</h4>
                      <div className="query-card-meta">
                        Updated {formatDate(project.updatedAt)}
                      </div>
                    </div>
                  </div>
                </div>

                {project.description && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                    {project.description.length > 100
                      ? `${project.description.slice(0, 100)}...`
                      : project.description}
                  </Text>
                )}

                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#666' }}>
                  <span>
                    <CodeOutlined style={{ marginRight: 4 }} />
                    {project.queryCount} {project.queryCount === 1 ? 'query' : 'queries'}
                  </span>
                  <span>
                    <MessageOutlined style={{ marginRight: 4 }} />
                    {project.chatCount} {project.chatCount === 1 ? 'chat' : 'chats'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <Modal
        title="Create Project"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false)
          form.resetFields()
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateProject}>
          <Form.Item
            name="title"
            label="Project Name"
            rules={[{ required: true, message: 'Please enter a project name' }]}
          >
            <Input placeholder="e.g., Sales Analytics" />
          </Form.Item>

          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea
              placeholder="What are you trying to analyze?"
              rows={3}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button onClick={() => setCreateModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={creating}>
                Create Project
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
