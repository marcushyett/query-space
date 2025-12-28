import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { checkProjectAccess, getCurrentUser } from '@/lib/auth/session'

const createMessageSchema = z.object({
  role: z.enum(['USER', 'ASSISTANT', 'SYSTEM', 'TOOL']),
  content: z.string(),
  sql: z.string().optional(),
  explanation: z.string().optional(),
  error: z.string().optional(),
  queryResultSample: z.any().optional(),
  chartData: z.any().optional(),
  toolCalls: z.any().optional(),
  todos: z.any().optional(),
})

const batchCreateMessagesSchema = z.object({
  messages: z.array(createMessageSchema),
})

// Helper to verify chat access
async function verifyChatAccess(chatId: string) {
  const chat = await prisma.aIChat.findUnique({
    where: { id: chatId },
    select: { projectId: true },
  })

  if (!chat) return null

  const access = await checkProjectAccess(chat.projectId)
  if (!access) return null

  return access
}

// POST /api/chats/[id]/messages - Add message(s) to chat
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params
    const access = await verifyChatAccess(chatId)

    if (!access) {
      return NextResponse.json(
        { error: 'Chat not found or access denied' },
        { status: 404 }
      )
    }

    if (!access.canWrite) {
      return NextResponse.json(
        { error: 'Write access required' },
        { status: 403 }
      )
    }

    const user = await getCurrentUser()
    const body = await request.json()

    // Try batch format first
    const batchParsed = batchCreateMessagesSchema.safeParse(body)
    if (batchParsed.success) {
      // Batch insert
      const { messages } = batchParsed.data

      // Limit queryResultSample to prevent storage bloat
      const limitedMessages = messages.map((m) => {
        let limitedResults = m.queryResultSample
        if (limitedResults && Array.isArray(limitedResults) && limitedResults.length > 10) {
          limitedResults = limitedResults.slice(0, 10)
        }
        return {
          chatId,
          role: m.role,
          content: m.content,
          sql: m.sql,
          explanation: m.explanation,
          error: m.error,
          queryResultSample: limitedResults,
          chartData: m.chartData,
          toolCalls: m.toolCalls,
          todos: m.todos,
          createdById: user?.id,
        }
      })

      await prisma.aIChatMessage.createMany({
        data: limitedMessages,
      })

      // Update chat's updatedAt
      await prisma.aIChat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      })

      return NextResponse.json(
        { success: true, count: messages.length },
        { status: 201 }
      )
    }

    // Try single message format
    const singleParsed = createMessageSchema.safeParse(body)
    if (!singleParsed.success) {
      return NextResponse.json(
        { error: 'Invalid message format' },
        { status: 400 }
      )
    }

    const { role, content, sql, explanation, error, queryResultSample, chartData, toolCalls, todos } = singleParsed.data

    // Limit queryResultSample
    let limitedResults = queryResultSample
    if (limitedResults && Array.isArray(limitedResults) && limitedResults.length > 10) {
      limitedResults = limitedResults.slice(0, 10)
    }

    const message = await prisma.aIChatMessage.create({
      data: {
        chatId,
        role,
        content,
        sql,
        explanation,
        error,
        queryResultSample: limitedResults,
        chartData,
        toolCalls,
        todos,
        createdById: user?.id,
      },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    })

    // Update chat's updatedAt
    await prisma.aIChat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error('Create message error:', error)
    return NextResponse.json(
      { error: 'Failed to save message' },
      { status: 500 }
    )
  }
}
