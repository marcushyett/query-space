'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Button,
  Input,
  message,
  Typography,
  Dropdown,
  Modal,
  Form,
  Grid,
} from 'antd'
import { TechSpinner } from '@/components/TechSpinner'
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import { SqlEditor } from '@/components/SqlEditor'
import { QueryResults } from '@/components/QueryResults'
import { TableBrowser } from '@/components/TableBrowser'
import { TableDetailDrawer } from '@/components/TableDetailDrawer'
import { AiChatPanel } from '@/components/AiChatPanel'
import { useOrganization } from '../../../../layout'
import { useQueryStore, QueryResult } from '@/stores/queryStore'
import { useSchemaStore } from '@/stores/schemaStore'
import { useUiStore } from '@/stores/uiStore'
import { useAiChatStore } from '@/stores/aiChatStore'

const { Text } = Typography
const { useBreakpoint } = Grid

interface QueryData {
  id: string
  name: string | null
  description: string | null
  sql: string
  sampleResults: unknown[] | null
  rowCount: number | null
  executionTime: number | null
}

export default function QueryEditorPage() {
  const params = useParams()
  const router = useRouter()
  const screens = useBreakpoint()
  const projectId = params.id as string
  const queryId = params.queryId as string
  const isNew = queryId === 'new'

  const { currentOrg } = useOrganization()
  const { setCurrentQuery, currentQuery, setQueryResults, queryResults, isExecuting, setIsExecuting } = useQueryStore()
  const { setTables, setLoading: setSchemaLoading, setError: setSchemaError } = useSchemaStore()
  const { tableBrowserOpen, toggleTableBrowser, setTableBrowserOpen } = useUiStore()
  const { isOpen: aiChatOpen, setOpen: setAiChatOpen } = useAiChatStore()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [queryData, setQueryData] = useState<QueryData | null>(null)
  const [queryName, setQueryName] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [form] = Form.useForm()

  const isMobile = !screens.md
  const TABLE_BROWSER_WIDTH = isMobile ? 200 : 260

  // Fetch schema for autocomplete
  useEffect(() => {
    if (!currentOrg) return

    const fetchSchema = async () => {
      setSchemaLoading(true)
      try {
        const res = await fetch('/api/schema', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId: currentOrg.id }),
        })

        if (res.ok) {
          const data = await res.json()
          setTables(data.tables || [])
        } else {
          setSchemaError('Failed to fetch schema')
        }
      } catch (err) {
        setSchemaError('Failed to fetch schema')
      } finally {
        setSchemaLoading(false)
      }
    }

    fetchSchema()
  }, [currentOrg, setTables, setSchemaLoading, setSchemaError])

  // Fetch existing query data
  useEffect(() => {
    if (isNew) {
      setCurrentQuery('')
      setQueryResults(null)
      return
    }

    const fetchQuery = async () => {
      try {
        const res = await fetch(`/api/queries/${queryId}`)
        if (!res.ok) {
          if (res.status === 404) {
            message.error('Query not found')
            router.push(`/projects/${projectId}`)
            return
          }
          throw new Error('Failed to fetch query')
        }

        const data = await res.json()
        setQueryData(data.query)
        setQueryName(data.query.name || '')
        setCurrentQuery(data.query.sql)

        // Restore sample results if available
        if (data.query.sampleResults) {
          setQueryResults({
            rows: data.query.sampleResults,
            fields: [],
            rowCount: data.query.rowCount || 0,
            executionTime: data.query.executionTime || 0,
          })
        }
      } catch (err) {
        console.error('Failed to fetch query:', err)
        message.error('Failed to load query')
      } finally {
        setLoading(false)
      }
    }

    fetchQuery()
  }, [queryId, isNew, projectId, router, setCurrentQuery, setQueryResults])

  // Track unsaved changes
  useEffect(() => {
    if (queryData) {
      setHasUnsavedChanges(currentQuery !== queryData.sql || queryName !== (queryData.name || ''))
    } else if (isNew && currentQuery) {
      setHasUnsavedChanges(true)
    }
  }, [currentQuery, queryName, queryData, isNew])

  // Auto-close sidebar on mobile
  useEffect(() => {
    if (isMobile && tableBrowserOpen) {
      setTableBrowserOpen(false)
    }
  }, [isMobile, tableBrowserOpen, setTableBrowserOpen])

  const executeQuery = useCallback(async () => {
    if (!currentQuery || !currentOrg) return

    setIsExecuting(true)
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          sql: currentQuery,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Query execution failed')
      }

      setQueryResults({
        rows: data.rows,
        fields: data.fields,
        rowCount: data.rowCount,
        executionTime: data.executionTime,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Query execution failed'
      message.error(msg)
    } finally {
      setIsExecuting(false)
    }
  }, [currentQuery, currentOrg, setIsExecuting, setQueryResults])

  const handleSave = async () => {
    if (!currentQuery) {
      message.error('Query cannot be empty')
      return
    }

    setSaving(true)
    try {
      if (isNew) {
        // Create new query
        const res = await fetch(`/api/projects/${projectId}/queries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: queryName || null,
            sql: currentQuery,
            sampleResults: queryResults?.rows?.slice(0, 10),
            rowCount: queryResults?.rowCount,
            executionTime: queryResults?.executionTime,
          }),
        })

        if (!res.ok) {
          throw new Error('Failed to save query')
        }

        const data = await res.json()
        message.success('Query saved')
        router.replace(`/projects/${projectId}/query/${data.query.id}`)
      } else {
        // Update existing query
        const res = await fetch(`/api/queries/${queryId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: queryName || null,
            sql: currentQuery,
            sampleResults: queryResults?.rows?.slice(0, 10),
            rowCount: queryResults?.rowCount,
            executionTime: queryResults?.executionTime,
          }),
        })

        if (!res.ok) {
          throw new Error('Failed to update query')
        }

        const data = await res.json()
        setQueryData(data.query)
        setHasUnsavedChanges(false)
        message.success('Query updated')
      }
    } catch (err) {
      message.error('Failed to save query')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/queries/${queryId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete query')
      }

      message.success('Query deleted')
      router.push(`/projects/${projectId}`)
    } catch (err) {
      message.error('Failed to delete query')
    }
  }

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        executeQuery()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [executeQuery, handleSave])

  if (loading) {
    return (
      <div className="loading-state-large">
        <TechSpinner size="large" />
      </div>
    )
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="flex items-center gap-4">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push(`/projects/${projectId}`)}
          />
          <Button
            type="text"
            icon={tableBrowserOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={toggleTableBrowser}
          />
          <Input
            placeholder="Query name..."
            value={queryName}
            onChange={(e) => setQueryName(e.target.value)}
            variant="borderless"
            style={{ maxWidth: 300, fontSize: 16, fontWeight: 500 }}
          />
          {hasUnsavedChanges && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Unsaved changes
            </Text>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={executeQuery}
            loading={isExecuting}
          >
            {isMobile ? '' : 'Run'}
          </Button>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!currentQuery}
          >
            {isMobile ? '' : 'Save'}
          </Button>
          <Button
            type={aiChatOpen ? 'primary' : 'text'}
            icon={<RobotOutlined />}
            onClick={() => setAiChatOpen(!aiChatOpen)}
          />
          {!isNew && (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'delete',
                    icon: <DeleteOutlined />,
                    label: 'Delete Query',
                    danger: true,
                  },
                ],
                onClick: ({ key }) => {
                  if (key === 'delete') {
                    Modal.confirm({
                      title: 'Delete Query',
                      content: 'Are you sure you want to delete this query?',
                      okText: 'Delete',
                      okType: 'danger',
                      onOk: handleDelete,
                    })
                  }
                },
              }}
              trigger={['click']}
            >
              <Button type="text" icon={<MoreOutlined />} />
            </Dropdown>
          )}
          {!isMobile && (
            <Text type="secondary" className="text-xs">
              Cmd+Enter to run
            </Text>
          )}
        </div>
      </header>

      <main className="app-main">
        <aside
          className={tableBrowserOpen ? 'sidebar' : 'sidebar sidebar-hidden'}
          style={{ width: tableBrowserOpen ? TABLE_BROWSER_WIDTH : 0 }}
        >
          {tableBrowserOpen && <TableBrowser />}
        </aside>

        <div className="main-content-area">
          <div className="editor-results-container">
            <div className="editor-pane">
              <SqlEditor />
            </div>
            <div className="results-pane">
              <QueryResults />
            </div>
          </div>

          <AiChatPanel />
        </div>
      </main>

      <TableDetailDrawer />
    </div>
  )
}
