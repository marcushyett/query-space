import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { checkProjectAccess, getCurrentUser } from '@/lib/auth/session'

const createChatSchema = z.object({
  title: z.string().max(200).optional(),
})

const listChatsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

// GET /api/projects/[id]/chats - List AI chats in a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const access = await checkProjectAccess(projectId)

    if (!access) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const parsed = listChatsSchema.safeParse(searchParams)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      )
    }

    const { limit, offset } = parsed.data

    const [chats, total] = await Promise.all([
      prisma.aIChat.findMany({
        where: { projectId },
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: {
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.aIChat.count({ where: { projectId } }),
    ])

    return NextResponse.json({
      chats: chats.map((c) => ({
        id: c.id,
        title: c.title,
        messageCount: c._count.messages,
        createdBy: c.createdBy?.name || c.createdBy?.email || null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('List chats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    )
  }
}

// POST /api/projects/[id]/chats - Create a new chat
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const access = await checkProjectAccess(projectId)

    if (!access) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
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
    const parsed = createChatSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      )
    }

    const { title } = parsed.data

    const chat = await prisma.aIChat.create({
      data: {
        projectId,
        title,
        createdById: user?.id,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ chat }, { status: 201 })
  } catch (error) {
    console.error('Create chat error:', error)
    return NextResponse.json(
      { error: 'Failed to create chat' },
      { status: 500 }
    )
  }
}
