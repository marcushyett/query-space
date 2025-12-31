import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { checkProjectAccess } from '@/lib/auth/session'

const updateChatSchema = z.object({
  title: z.string().min(1).max(200).optional(),
})

// Helper to get chat and verify access
async function getChatWithAccess(chatId: string) {
  const chat = await prisma.aIChat.findUnique({
    where: { id: chatId },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          organizationId: true,
        },
      },
    },
  })

  if (!chat) return null

  const access = await checkProjectAccess(chat.projectId)
  if (!access) return null

  return { chat, access }
}

// GET /api/chats/[id] - Get chat details with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params
    const result = await getChatWithAccess(chatId)

    if (!result) {
      return NextResponse.json(
        { error: 'Chat not found or access denied' },
        { status: 404 }
      )
    }

    const { chat, access } = result

    // Get messages
    const messages = await prisma.aIChatMessage.findMany({
      where: { chatId },
      select: {
        id: true,
        role: true,
        content: true,
        sql: true,
        explanation: true,
        error: true,
        queryResultSample: true,
        chartData: true,
        toolCalls: true,
        todos: true,
        createdAt: true,
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      chat: {
        id: chat.id,
        title: chat.title,
        projectId: chat.projectId,
        projectTitle: chat.project.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sql: m.sql,
        explanation: m.explanation,
        error: m.error,
        queryResultSample: m.queryResultSample,
        chartData: m.chartData,
        toolCalls: m.toolCalls,
        todos: m.todos,
        createdBy: m.createdBy?.name || m.createdBy?.email || null,
        createdAt: m.createdAt,
      })),
      canWrite: access.canWrite,
    })
  } catch (error) {
    console.error('Get chat error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chat' },
      { status: 500 }
    )
  }
}

// PATCH /api/chats/[id] - Update chat title
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params
    const result = await getChatWithAccess(chatId)

    if (!result) {
      return NextResponse.json(
        { error: 'Chat not found or access denied' },
        { status: 404 }
      )
    }

    if (!result.access.canWrite) {
      return NextResponse.json(
        { error: 'Write access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = updateChatSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      )
    }

    const { title } = parsed.data

    const chat = await prisma.aIChat.update({
      where: { id: chatId },
      data: {
        ...(title && { title }),
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ chat })
  } catch (error) {
    console.error('Update chat error:', error)
    return NextResponse.json(
      { error: 'Failed to update chat' },
      { status: 500 }
    )
  }
}

// DELETE /api/chats/[id] - Delete chat
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params
    const result = await getChatWithAccess(chatId)

    if (!result) {
      return NextResponse.json(
        { error: 'Chat not found or access denied' },
        { status: 404 }
      )
    }

    if (!result.access.canWrite) {
      return NextResponse.json(
        { error: 'Write access required' },
        { status: 403 }
      )
    }

    await prisma.aIChat.delete({
      where: { id: chatId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete chat error:', error)
    return NextResponse.json(
      { error: 'Failed to delete chat' },
      { status: 500 }
    )
  }
}
