'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Tabs,
  Button,
  Spin,
  Input,
  Empty,
  Modal,
  Form,
  message,
  Typography,
  Dropdown,
  Popconfirm,
} from 'antd'
import {
  ArrowLeftOutlined,
  PlusOutlined,
  CodeOutlined,
  MessageOutlined,
  SearchOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useOrganization } from '../../layout'

const { Text, Paragraph } = Typography

interface Project {
  id: string
  title: string
  description: string | null
  organizationId: string
  queryCount: number
  chatCount: number
  createdAt: string
  updatedAt: string
}

interface Query {
  id: string
  name: string | null
  description: string | null
  sql: string
  rowCount: number | null
  executionTime: number | null
  chartCount: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

interface Chat {
  id: string
  title: string | null
  messageCount: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { currentOrg } = useOrganization()

  const [project, setProject] = useState<Project | null>(null)
  const [canWrite, setCanWrite] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('queries')

  // Queries state
  const [queries, setQueries] = useState<Query[]>([])
  const [queriesLoading, setQueriesLoading] = useState(false)
  const [querySearch, setQuerySearch] = useState('')

  // Chats state
  const [chats, setChats] = useState<Chat[]>([])
  const [chatsLoading, setChatsLoading] = useState(false)

  // Edit project modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  // Fetch project details
  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) {
          if (res.status === 404) {
            message.error('Project not found')
            router.push('/')
            return
          }
          throw new Error('Failed to fetch project')
        }
        const data = await res.json()
        setProject(data.project)
        setCanWrite(data.canWrite)
      } catch (err) {
        console.error('Failed to fetch project:', err)
        message.error('Failed to load project')
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [projectId, router])

  // Fetch queries
  useEffect(() => {
    if (!project) return

    const fetchQueries = async () => {
      setQueriesLoading(true)
      try {
        const params = new URLSearchParams()
        if (querySearch) params.set('search', querySearch)

        const res = await fetch(`/api/projects/${projectId}/queries?${params}`)
        if (res.ok) {
          const data = await res.json()
          setQueries(data.queries || [])
        }
      } catch (err) {
        console.error('Failed to fetch queries:', err)
      } finally {
        setQueriesLoading(false)
      }
    }

    fetchQueries()
  }, [project, projectId, querySearch])

  // Fetch chats
  useEffect(() => {
    if (!project) return

    const fetchChats = async () => {
      setChatsLoading(true)
      try {
        const res = await fetch(`/api/projects/${projectId}/chats`)
        if (res.ok) {
          const data = await res.json()
          setChats(data.chats || [])
        }
      } catch (err) {
        console.error('Failed to fetch chats:', err)
      } finally {
        setChatsLoading(false)
      }
    }

    fetchChats()
  }, [project, projectId])

  const handleUpdateProject = async (values: { title: string; description?: string }) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      if (!res.ok) {
        throw new Error('Failed to update project')
      }

      const data = await res.json()
      setProject((prev) => prev ? { ...prev, ...data.project } : null)
      message.success('Project updated')
      setEditModalOpen(false)
    } catch (err) {
      message.error('Failed to update project')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete project')
      }

      message.success('Project deleted')
      router.push('/')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete project'
      message.error(msg)
    }
  }

  const handleNewQuery = () => {
    // Navigate to query editor with project context
    router.push(`/projects/${projectId}/query/new`)
  }

  const handleNewChat = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        throw new Error('Failed to create chat')
      }

      const data = await res.json()
      router.push(`/projects/${projectId}/chat/${data.chat.id}`)
    } catch (err) {
      message.error('Failed to create chat')
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

  const truncateSql = (sql: string, maxLength = 100) => {
    const cleaned = sql.replace(/\s+/g, ' ').trim()
    if (cleaned.length <= maxLength) return cleaned
    return cleaned.slice(0, maxLength) + '...'
  }

  if (loading) {
    return (
      <div className="loading-state-large">
        <Spin size="large" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="empty-state-action">
        <Empty description="Project not found" />
        <Button onClick={() => router.push('/')}>Go back</Button>
      </div>
    )
  }

  const projectMenu = {
    items: [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: 'Edit Project',
        onClick: () => {
          form.setFieldsValue({
            title: project.title,
            description: project.description,
          })
          setEditModalOpen(true)
        },
      },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: 'Delete Project',
        danger: true,
      },
    ],
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/')}
          />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{project.title}</h1>
          {canWrite && (
            <Dropdown
              menu={{
                items: projectMenu.items,
                onClick: ({ key }) => {
                  if (key === 'delete') {
                    Modal.confirm({
                      title: 'Delete Project',
                      content: 'Are you sure you want to delete this project? This will also delete all queries, chats, and charts in this project.',
                      okText: 'Delete',
                      okType: 'danger',
                      onOk: handleDeleteProject,
                    })
                  }
                },
              }}
              trigger={['click']}
            >
              <Button type="text" icon={<MoreOutlined />} />
            </Dropdown>
          )}
        </div>
        {project.description && (
          <Paragraph type="secondary" style={{ margin: 0, marginLeft: 44 }}>
            {project.description}
          </Paragraph>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        tabBarStyle={{ padding: '0 24px', marginBottom: 0 }}
        items={[
          {
            key: 'queries',
            label: (
              <span>
                <CodeOutlined /> Queries ({project.queryCount})
              </span>
            ),
            children: (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Search and actions */}
                <div style={{
                  padding: '16px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  borderBottom: '1px solid var(--border-color)',
                }}>
                  <Input
                    placeholder="Search queries..."
                    prefix={<SearchOutlined style={{ color: '#666' }} />}
                    value={querySearch}
                    onChange={(e) => setQuerySearch(e.target.value)}
                    style={{ maxWidth: 300 }}
                    allowClear
                  />
                  {canWrite && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleNewQuery}
                    >
                      New Query
                    </Button>
                  )}
                </div>

                {/* Queries list */}
                <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
                  {queriesLoading ? (
                    <div className="loading-state">
                      <Spin />
                    </div>
                  ) : queries.length === 0 ? (
                    <div className="empty-state-action">
                      <div className="empty-state-icon">
                        <CodeOutlined />
                      </div>
                      <div className="empty-state-title">
                        {querySearch ? 'No queries found' : 'No queries yet'}
                      </div>
                      <div className="empty-state-description">
                        {querySearch
                          ? 'Try a different search term'
                          : 'Create your first query to start exploring data'}
                      </div>
                      {!querySearch && canWrite && (
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={handleNewQuery}
                        >
                          Create Query
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="item-grid">
                      {queries.map((query) => (
                        <div
                          key={query.id}
                          className="query-card"
                          onClick={() => router.push(`/projects/${projectId}/query/${query.id}`)}
                        >
                          <div className="query-card-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                <CodeOutlined style={{ color: '#fff', fontSize: 16 }} />
                              </div>
                              <div>
                                <h4 className="query-card-title">
                                  {query.name || 'Untitled Query'}
                                </h4>
                                <div className="query-card-meta">
                                  Updated {formatDate(query.updatedAt)}
                                </div>
                              </div>
                            </div>
                          </div>

                          <Text
                            code
                            style={{
                              display: 'block',
                              fontSize: 11,
                              marginBottom: 12,
                              background: 'rgba(255,255,255,0.05)',
                              padding: '8px 10px',
                              borderRadius: 4,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {truncateSql(query.sql)}
                          </Text>

                          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#666' }}>
                            {query.rowCount !== null && (
                              <span>{query.rowCount.toLocaleString()} rows</span>
                            )}
                            {query.executionTime !== null && (
                              <span>
                                <ClockCircleOutlined style={{ marginRight: 4 }} />
                                {query.executionTime}ms
                              </span>
                            )}
                            {query.chartCount > 0 && (
                              <span>{query.chartCount} chart{query.chartCount !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'chats',
            label: (
              <span>
                <MessageOutlined /> AI Chats ({project.chatCount})
              </span>
            ),
            children: (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Actions */}
                <div style={{
                  padding: '16px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  borderBottom: '1px solid var(--border-color)',
                }}>
                  {canWrite && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleNewChat}
                    >
                      New Chat
                    </Button>
                  )}
                </div>

                {/* Chats list */}
                <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
                  {chatsLoading ? (
                    <div className="loading-state">
                      <Spin />
                    </div>
                  ) : chats.length === 0 ? (
                    <div className="empty-state-action">
                      <div className="empty-state-icon">
                        <MessageOutlined />
                      </div>
                      <div className="empty-state-title">No chats yet</div>
                      <div className="empty-state-description">
                        Start a chat to explore your data with AI assistance
                      </div>
                      {canWrite && (
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={handleNewChat}
                        >
                          Start Chat
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="item-grid">
                      {chats.map((chat) => (
                        <div
                          key={chat.id}
                          className="query-card"
                          onClick={() => router.push(`/projects/${projectId}/chat/${chat.id}`)}
                        >
                          <div className="query-card-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                background: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                <MessageOutlined style={{ color: '#fff', fontSize: 16 }} />
                              </div>
                              <div>
                                <h4 className="query-card-title">
                                  {chat.title || 'New Chat'}
                                </h4>
                                <div className="query-card-meta">
                                  Updated {formatDate(chat.updatedAt)}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#666' }}>
                            <span>{chat.messageCount} message{chat.messageCount !== 1 ? 's' : ''}</span>
                            {chat.createdBy && <span>by {chat.createdBy}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Edit Project Modal */}
      <Modal
        title="Edit Project"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleUpdateProject}>
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
              <Button onClick={() => setEditModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={saving}>
                Save Changes
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
