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
  Breadcrumb,
  Badge,
  Tooltip,
} from 'antd'
import { TechSpinner } from '@/components/TechSpinner'
import {
  PlayCircleOutlined,
  SaveOutlined,
  MoreOutlined,
  DeleteOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  HomeOutlined,
  HistoryOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { SqlEditor } from '@/components/SqlEditor'
import { QueryResults } from '@/components/QueryResults'
import { TableBrowser } from '@/components/TableBrowser'
import { AiChatPanel } from '@/components/AiChatPanel'
import { QueryVersionsPanel } from '@/components/QueryVersionsPanel'
import { QueryHistoryDrawer } from '@/components/QueryHistoryDrawer'
import { useOrganization } from '../../../../layout'
import { useQueryStore, saveQueryExecution } from '@/stores/queryStore'
import { useSchemaStore } from '@/stores/schemaStore'
import { useUiStore } from '@/stores/uiStore'
import { useAiChatStore } from '@/stores/aiChatStore'
import { useAgentSessionStore } from '@/stores/agentSessionStore'
import { formatSql, lintSql } from '@/lib/sql-formatter'

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
  const { setCurrentQuery, currentQuery, setQueryResults, queryResults, isExecuting, setIsExecuting, queryName: storeQueryName, setQueryName: setStoreQueryName } = useQueryStore()
  const { setTables, setLoading: setSchemaLoading, setError: setSchemaError } = useSchemaStore()
  const { tableBrowserOpen, toggleTableBrowser, setTableBrowserOpen, setHistoryDrawerOpen } = useUiStore()
  const { isOpen: aiChatOpen, setOpen: setAiChatOpen } = useAiChatStore()
  const { sessions } = useAgentSessionStore()

  // Check if there are paused AI sessions to show indicator
  const pausedSessionCount = Object.values(sessions).filter(s => s.status === 'paused').length

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [queryData, setQueryData] = useState<QueryData | null>(null)
  const [queryName, setQueryName] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [_editModalOpen, _setEditModalOpen] = useState(false)
  const [projectName, setProjectName] = useState<string>('')
  const [_form] = Form.useForm()
  void _editModalOpen;
  void _setEditModalOpen;
  void _form;
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedSqlRef = useRef<string>('')
  const [autoSaving, setAutoSaving] = useState(false)
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false)

  const isMobile = !screens.md
  const isDesktop = screens.lg
  const TABLE_BROWSER_WIDTH = isMobile ? 200 : 280

  // Sync store queryName with local state (from AI agent)
  useEffect(() => {
    if (storeQueryName && storeQueryName !== queryName) {
      setQueryName(storeQueryName)
    }
  }, [storeQueryName, queryName])

  // Keep store in sync when user edits the name
  const handleQueryNameChange = (name: string) => {
    setQueryName(name)
    setStoreQueryName(name)
  }

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
      } catch {
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
      // Reset all state for new query
      setCurrentQuery('')
      setQueryResults(null)
      setQueryName('')
      setStoreQueryName('')
      setQueryData(null)
      lastSavedSqlRef.current = ''
      setHasUnsavedChanges(false)
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
        if (data.query.sampleResults && data.query.sampleResults.length > 0) {
          // Infer fields from the sample data
          const sampleRow = data.query.sampleResults[0]
          const inferredFields = Object.keys(sampleRow).map((name) => {
            const value = sampleRow[name]
            // Infer dataTypeID based on value type
            let dataTypeID = 25 // Default to text (varchar)
            if (typeof value === 'number') {
              dataTypeID = Number.isInteger(value) ? 23 : 701 // int4 or float8
            } else if (typeof value === 'boolean') {
              dataTypeID = 16 // bool
            } else if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}/.test(value))) {
              dataTypeID = 1114 // timestamp
            }
            return { name, dataTypeID }
          })

          setQueryResults({
            rows: data.query.sampleResults,
            fields: inferredFields,
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
  }, [queryId, isNew, projectId, router, setCurrentQuery, setQueryResults, setStoreQueryName])

  // Track unsaved changes
  useEffect(() => {
    if (queryData) {
      setHasUnsavedChanges(currentQuery !== queryData.sql || queryName !== (queryData.name || ''))
    } else if (isNew && currentQuery) {
      setHasUnsavedChanges(true)
    }
  }, [currentQuery, queryName, queryData, isNew])

  // Fetch project name for breadcrumbs
  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (res.ok) {
          const data = await res.json()
          setProjectName(data.project?.title || '')
        }
      } catch (err) {
        console.error('Failed to fetch project:', err)
      }
    }
    fetchProject()
  }, [projectId])

  // Auto-open sidebars on desktop, close on mobile
  useEffect(() => {
    if (isMobile) {
      setTableBrowserOpen(false)
      setAiChatOpen(false)
    } else if (isDesktop) {
      setTableBrowserOpen(true)
      setAiChatOpen(true)
    }
  }, [isMobile, isDesktop, setTableBrowserOpen, setAiChatOpen])

  const executeQuery = useCallback(async () => {
    if (!currentQuery || !currentOrg) return

    // Auto-format the query before running
    const formattedQuery = formatSql(currentQuery)
    if (formattedQuery !== currentQuery) {
      setCurrentQuery(formattedQuery)
    }

    // Lint the query before running
    const lintErrors = lintSql(formattedQuery)
    const criticalErrors = lintErrors.filter(e => e.severity === 'error')

    if (criticalErrors.length > 0) {
      message.error(criticalErrors[0].message)
      return
    }

    // Show warnings but continue
    const warnings = lintErrors.filter(e => e.severity === 'warning')
    if (warnings.length > 0) {
      message.warning(warnings[0].message)
    }

    setIsExecuting(true)
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          sql: formattedQuery,
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

      // Save execution history for saved queries
      if (!isNew) {
        saveQueryExecution({
          organizationId: currentOrg.id,
          projectId,
          queryId,
          sql: formattedQuery,
          queryName: queryName || undefined,
          source: 'MANUAL',
          success: true,
          rowCount: data.rowCount,
          executionTime: data.executionTime,
        }).catch(err => console.error('Failed to save execution:', err))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Query execution failed'
      message.error(msg)

      // Save failed execution history for saved queries
      if (!isNew) {
        saveQueryExecution({
          organizationId: currentOrg.id,
          projectId,
          queryId,
          sql: formattedQuery,
          queryName: queryName || undefined,
          source: 'MANUAL',
          success: false,
          error: msg,
        }).catch(err => console.error('Failed to save execution:', err))
      }
    } finally {
      setIsExecuting(false)
    }
  }, [currentQuery, currentOrg, setIsExecuting, setQueryResults, setCurrentQuery, isNew, projectId, queryId, queryName])

  const handleSave = useCallback(async () => {
    if (!currentQuery) {
      message.error('Query cannot be empty')
      return
    }

    setSaving(true)
    try {
      // Generate description and name using AI if not already set
      let description: string | null = queryData?.description ?? null
      let finalName = queryName

      // Only generate if we're saving a new query or the description is empty
      if (currentOrg?.id && (!description || !finalName)) {
        try {
          const aiRes = await fetch('/api/ai-describe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizationId: currentOrg.id,
              sql: currentQuery,
              name: finalName || undefined,
            }),
          })

          if (aiRes.ok) {
            const aiData = await aiRes.json()
            if (!description && aiData.description) {
              description = aiData.description
            }
            if (!finalName && aiData.suggestedName) {
              finalName = aiData.suggestedName
              setQueryName(finalName)
            }
          }
        } catch {
          // Silently continue if AI fails - description is optional
        }
      }

      if (isNew) {
        // Create new query
        const res = await fetch(`/api/projects/${projectId}/queries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: finalName || null,
            description,
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
            name: finalName || null,
            description,
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
    } catch {
      message.error('Failed to save query')
    } finally {
      setSaving(false)
    }
  }, [currentQuery, queryData, queryName, currentOrg, isNew, projectId, queryId, queryResults, router])

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
    } catch {
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

  // Auto-save with debounce (2 seconds after last change)
  useEffect(() => {
    // Don't auto-save if query is empty or unchanged
    if (!currentQuery || currentQuery === lastSavedSqlRef.current) {
      return
    }

    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Set a new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(async () => {
      // Only auto-save if there's meaningful content
      if (!currentQuery.trim()) return

      setAutoSaving(true)
      try {
        if (isNew) {
          // For new queries, create and redirect
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

          if (res.ok) {
            const data = await res.json()
            lastSavedSqlRef.current = currentQuery
            router.replace(`/projects/${projectId}/query/${data.query.id}`)
          }
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

          if (res.ok) {
            const data = await res.json()
            setQueryData(data.query)
            lastSavedSqlRef.current = currentQuery
            setHasUnsavedChanges(false)
          }
        }
      } catch (err) {
        // Silently fail auto-save - user can manually save
        console.error('Auto-save failed:', err)
      } finally {
        setAutoSaving(false)
      }
    }, 2000)

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [currentQuery, queryName, isNew, projectId, queryId, queryResults, router])

  // Update lastSavedSqlRef when query data is loaded
  useEffect(() => {
    if (queryData?.sql) {
      lastSavedSqlRef.current = queryData.sql
    }
  }, [queryData])

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
        <div className="flex items-center gap-3" style={{ flex: 1, minWidth: 0 }}>
          <Button
            type="text"
            size="small"
            icon={tableBrowserOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={toggleTableBrowser}
          />
          <Breadcrumb
            items={[
              {
                title: <span style={{ cursor: 'pointer' }} onClick={() => router.push('/')}><HomeOutlined /></span>,
              },
              {
                title: (
                  <span style={{ cursor: 'pointer' }} onClick={() => router.push(`/projects/${projectId}`)}>
                    {projectName || 'Project'}
                  </span>
                ),
              },
              {
                title: (
                  <Input
                    placeholder="Query name..."
                    value={queryName}
                    onChange={(e) => handleQueryNameChange(e.target.value)}
                    variant="borderless"
                    style={{
                      width: isMobile ? 120 : 200,
                      fontSize: 14,
                      fontWeight: 500,
                      padding: 0,
                    }}
                  />
                ),
              },
            ]}
            style={{ flex: 1 }}
          />
          {!isMobile && (autoSaving ? (
            <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              Saving...
            </Text>
          ) : hasUnsavedChanges ? (
            <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              Unsaved
            </Text>
          ) : null)}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={executeQuery}
            loading={isExecuting}
            size={isMobile ? 'middle' : 'middle'}
          >
            {isMobile ? '' : 'Run'}
          </Button>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!currentQuery}
            size={isMobile ? 'middle' : 'middle'}
          >
            {isMobile ? '' : 'Save'}
          </Button>
          <Button
            type={aiChatOpen ? 'primary' : 'text'}
            icon={<RobotOutlined />}
            onClick={() => setAiChatOpen(!aiChatOpen)}
          />
          <Tooltip title="AI Sessions">
            <Badge count={pausedSessionCount} size="small" offset={[-2, 2]} style={{ backgroundColor: '#faad14' }}>
              <Button
                type="text"
                icon={<ClockCircleOutlined />}
                onClick={() => setHistoryDrawerOpen(true)}
              />
            </Badge>
          </Tooltip>
          {!isNew && (
            <Tooltip title="Query Versions">
              <Button
                type="text"
                icon={<HistoryOutlined />}
                onClick={() => setHistoryPanelOpen(true)}
              />
            </Tooltip>
          )}
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
        </div>
      </header>

      <main className="app-main">
        {/* Desktop sidebar */}
        {!isMobile && (
          <aside
            className={tableBrowserOpen ? 'sidebar' : 'sidebar sidebar-hidden'}
            style={{ width: tableBrowserOpen ? TABLE_BROWSER_WIDTH : 0 }}
          >
            {tableBrowserOpen && <TableBrowser />}
          </aside>
        )}

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

      {/* Mobile full-screen table browser */}
      {isMobile && tableBrowserOpen && (
        <TableBrowser
          isMobileFullScreen
          onClose={() => setTableBrowserOpen(false)}
        />
      )}

      {/* Query Versions Panel */}
      <QueryVersionsPanel
        queryId={queryId}
        currentSql={currentQuery}
        open={historyPanelOpen}
        onClose={() => setHistoryPanelOpen(false)}
      />

      {/* Global AI Sessions / Query History Drawer */}
      <QueryHistoryDrawer />
    </div>
  )
}
