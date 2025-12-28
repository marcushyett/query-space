'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Button,
  Spin,
  Input,
  message,
  Typography,
  Dropdown,
  Modal,
  Grid,
} from 'antd'
import {
  ArrowLeftOutlined,
  SendOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { TableBrowser } from '@/components/TableBrowser'
import { TableDetailDrawer } from '@/components/TableDetailDrawer'
import { ChatMessage } from '@/components/ChatMessage'
import { AgentProgress } from '@/components/AgentProgress'
import { useOrganization } from '../../../../layout'
import { useSchemaStore } from '@/stores/schemaStore'
import { useUiStore } from '@/stores/uiStore'
import type { ChatMessage as ChatMessageType, AgentProgress as AgentProgressType, ToolCallInfo, AgentTodoItem } from '@/stores/aiChatStore'

const { Text } = Typography
const { TextArea } = Input
const { useBreakpoint } = Grid

interface ChatData {
  id: string
  title: string | null
  projectId: string
  projectTitle: string
  createdAt: string
  updatedAt: string
}

interface ApiMessage {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL'
  content: string
  sql?: string
  explanation?: string
  error?: string
  queryResultSample?: unknown[]
  chartData?: unknown
  toolCalls?: unknown
  todos?: unknown
  createdBy?: string
  createdAt: string
}

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const screens = useBreakpoint()
  const projectId = params.id as string
  const chatId = params.chatId as string

  const { currentOrg } = useOrganization()
  const { setTables, setLoading: setSchemaLoading, setError: setSchemaError } = useSchemaStore()
  const { tableBrowserOpen, toggleTableBrowser, setTableBrowserOpen } = useUiStore()

  const [loading, setLoading] = useState(true)
  const [chatData, setChatData] = useState<ChatData | null>(null)
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [canWrite, setCanWrite] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [agentProgress, setAgentProgress] = useState<AgentProgressType | null>(null)
  const [editTitleModalOpen, setEditTitleModalOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isMobile = !screens.md
  const TABLE_BROWSER_WIDTH = isMobile ? 200 : 260

  // Fetch schema for context
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
          setTables(data.schema || [])
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

  // Fetch chat data
  useEffect(() => {
    const fetchChat = async () => {
      try {
        const res = await fetch(`/api/chats/${chatId}`)
        if (!res.ok) {
          if (res.status === 404) {
            message.error('Chat not found')
            router.push(`/projects/${projectId}`)
            return
          }
          throw new Error('Failed to fetch chat')
        }

        const data = await res.json()
        setChatData(data.chat)
        setCanWrite(data.canWrite)

        // Convert API messages to store format
        const convertedMessages: ChatMessageType[] = data.messages.map((m: ApiMessage) => ({
          id: m.id,
          role: m.role.toLowerCase() as 'user' | 'assistant' | 'system' | 'tool',
          content: m.content,
          timestamp: new Date(m.createdAt).getTime(),
          sql: m.sql,
          explanation: m.explanation,
          error: m.error,
          queryResult: m.queryResultSample ? {
            rowCount: Array.isArray(m.queryResultSample) ? m.queryResultSample.length : 0,
            executionTime: 0,
            sampleResults: m.queryResultSample as Record<string, unknown>[],
          } : undefined,
          chartData: m.chartData,
          toolCalls: m.toolCalls as ToolCallInfo[] | undefined,
          todos: m.todos as AgentTodoItem[] | undefined,
        }))

        setMessages(convertedMessages)
      } catch (err) {
        console.error('Failed to fetch chat:', err)
        message.error('Failed to load chat')
      } finally {
        setLoading(false)
      }
    }

    fetchChat()
  }, [chatId, projectId, router])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-close sidebar on mobile
  useEffect(() => {
    if (isMobile && tableBrowserOpen) {
      setTableBrowserOpen(false)
    }
  }, [isMobile, tableBrowserOpen, setTableBrowserOpen])

  const saveMessages = async (newMessages: ChatMessageType[]) => {
    try {
      const apiMessages = newMessages.map(m => ({
        role: m.role.toUpperCase() as 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL',
        content: m.content,
        sql: m.sql,
        explanation: m.explanation,
        error: m.error,
        queryResultSample: m.queryResult?.sampleResults,
        chartData: m.chartData,
        toolCalls: m.toolCalls,
        todos: m.todos,
      }))

      await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })
    } catch (err) {
      console.error('Failed to save messages:', err)
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !currentOrg || isGenerating) return

    const userMessage: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsGenerating(true)

    // Start agent progress
    setAgentProgress({
      currentStep: 0,
      maxSteps: 10,
      goal: userMessage.content,
      isRunning: true,
      reachedStepLimit: false,
      canContinue: false,
      toolCalls: [],
      streamingText: '',
      todos: [],
    })

    try {
      // Call the AI query API
      const res = await fetch('/api/ai-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          prompt: userMessage.content,
          projectId,
          maxSteps: 10,
        }),
      })

      if (!res.ok) {
        throw new Error('AI query failed')
      }

      const data = await res.json()

      const assistantMessage: ChatMessageType = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.explanation || data.summary || 'Query completed.',
        timestamp: Date.now(),
        sql: data.sql,
        explanation: data.explanation,
        queryResult: data.result ? {
          rowCount: data.result.rowCount || 0,
          executionTime: data.result.executionTime || 0,
          sampleResults: data.result.rows?.slice(0, 10),
        } : undefined,
        chartData: data.chartData,
        summary: data.summary,
      }

      setMessages(prev => [...prev, assistantMessage])

      // Save both messages
      await saveMessages([userMessage, assistantMessage])

      // Auto-generate title if first message
      if (messages.length === 0 && chatData && !chatData.title) {
        const title = userMessage.content.slice(0, 50) + (userMessage.content.length > 50 ? '...' : '')
        await fetch(`/api/chats/${chatId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        })
        setChatData(prev => prev ? { ...prev, title } : null)
      }
    } catch (err) {
      const errorMessage: ChatMessageType = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: 'Sorry, there was an error processing your request. Please try again.',
        timestamp: Date.now(),
        error: err instanceof Error ? err.message : 'Unknown error',
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsGenerating(false)
      setAgentProgress(null)
    }
  }

  const handleDeleteChat = async () => {
    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete chat')
      }

      message.success('Chat deleted')
      router.push(`/projects/${projectId}`)
    } catch (err) {
      message.error('Failed to delete chat')
    }
  }

  const handleUpdateTitle = async () => {
    if (!newTitle.trim()) return

    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      })

      if (!res.ok) {
        throw new Error('Failed to update title')
      }

      setChatData(prev => prev ? { ...prev, title: newTitle.trim() } : null)
      setEditTitleModalOpen(false)
      message.success('Title updated')
    } catch (err) {
      message.error('Failed to update title')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (loading) {
    return (
      <div className="loading-state-large">
        <Spin size="large" />
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
          <Text strong style={{ fontSize: 16 }}>
            {chatData?.title || 'New Chat'}
          </Text>
        </div>
        <div className="flex items-center gap-4">
          {canWrite && (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'edit',
                    icon: <EditOutlined />,
                    label: 'Edit Title',
                    onClick: () => {
                      setNewTitle(chatData?.title || '')
                      setEditTitleModalOpen(true)
                    },
                  },
                  {
                    key: 'delete',
                    icon: <DeleteOutlined />,
                    label: 'Delete Chat',
                    danger: true,
                  },
                ],
                onClick: ({ key }) => {
                  if (key === 'delete') {
                    Modal.confirm({
                      title: 'Delete Chat',
                      content: 'Are you sure you want to delete this chat?',
                      okText: 'Delete',
                      okType: 'danger',
                      onOk: handleDeleteChat,
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
        <aside
          className={tableBrowserOpen ? 'sidebar' : 'sidebar sidebar-hidden'}
          style={{ width: tableBrowserOpen ? TABLE_BROWSER_WIDTH : 0 }}
        >
          {tableBrowserOpen && <TableBrowser />}
        </aside>

        <div className="main-content-area" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            {messages.length === 0 ? (
              <div className="empty-state-action">
                <div className="empty-state-title">Start a conversation</div>
                <div className="empty-state-description">
                  Ask questions about your data, request SQL queries, or analyze results
                </div>
              </div>
            ) : (
              <div style={{ maxWidth: 800, margin: '0 auto' }}>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {agentProgress && agentProgress.isRunning && (
                  <AgentProgress
                    currentStep={agentProgress.currentStep}
                    maxSteps={agentProgress.maxSteps}
                    toolCalls={agentProgress.toolCalls}
                    streamingText={agentProgress.streamingText}
                    todos={agentProgress.todos}
                    onStop={() => setAgentProgress(null)}
                  />
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          {canWrite && (
            <div style={{
              padding: 16,
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
            }}>
              <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', gap: 8 }}>
                <TextArea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your data..."
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  disabled={isGenerating}
                  style={{ flex: 1 }}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSendMessage}
                  loading={isGenerating}
                  disabled={!inputValue.trim()}
                >
                  {isMobile ? '' : 'Send'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <TableDetailDrawer />

      {/* Edit Title Modal */}
      <Modal
        title="Edit Chat Title"
        open={editTitleModalOpen}
        onCancel={() => setEditTitleModalOpen(false)}
        onOk={handleUpdateTitle}
        okText="Save"
      >
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Enter chat title..."
        />
      </Modal>
    </div>
  )
}
