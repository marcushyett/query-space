import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import {
  requireUser,
  requireOrganizationWrite,
  getUserOrganizations,
} from '@/lib/auth/session'

const createProjectSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
})

const listProjectsSchema = z.object({
  organizationId: z.string().min(1).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

// GET /api/projects - List projects (optionally filtered by org)
export async function GET(request: NextRequest) {
  try {
    await requireUser()

    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const parsed = listProjectsSchema.safeParse(searchParams)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      )
    }

    const { organizationId, search, limit, offset } = parsed.data

    // Get user's organizations
    const userOrgs = await getUserOrganizations()
    const orgIds = userOrgs.map((o) => o.id)

    if (orgIds.length === 0) {
      return NextResponse.json({ projects: [], total: 0 })
    }

    // Build where clause
    const where: {
      organizationId: { in: string[] } | string
      OR?: Array<{ title?: { contains: string; mode: 'insensitive' }; description?: { contains: string; mode: 'insensitive' } }>
    } = {
      organizationId: organizationId
        ? organizationId
        : { in: orgIds },
    }

    // If specific org requested, verify access
    if (organizationId) {
      const hasAccess = orgIds.includes(organizationId)
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // Add search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Execute query with count
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              queries: true,
              aiChats: true,
            },
          },
          organization: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.project.count({ where }),
    ])

    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        organizationId: p.organizationId,
        organizationName: p.organization.name,
        queryCount: p._count.queries,
        chatCount: p._count.aiChats,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('List projects error:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createProjectSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { organizationId, title, description } = parsed.data

    // Verify write access to organization
    await requireOrganizationWrite(organizationId)

    const project = await prisma.project.create({
      data: {
        organizationId,
        title,
        description,
      },
      select: {
        id: true,
        title: true,
        description: true,
        organizationId: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    console.error('Create project error:', error)
    if (error instanceof Error) {
      if (error.message === 'Write access required') {
        return NextResponse.json(
          { error: 'Write access required to create projects' },
          { status: 403 }
        )
      }
    }
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}
