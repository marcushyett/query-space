import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import {
  requireUser,
  requireOrganizationWrite,
  getUserOrganizations,
} from '@/lib/auth/session'

const createDashboardSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  projectIds: z.array(z.string()).optional(), // Projects to link
})

const listDashboardsSchema = z.object({
  organizationId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

// GET /api/dashboards - List dashboards
export async function GET(request: NextRequest) {
  try {
    await requireUser()

    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const parsed = listDashboardsSchema.safeParse(searchParams)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      )
    }

    const { organizationId, limit, offset } = parsed.data

    // Get user's organizations
    const userOrgs = await getUserOrganizations()
    const orgIds = userOrgs.map((o) => o.id)

    if (orgIds.length === 0) {
      return NextResponse.json({ dashboards: [], total: 0 })
    }

    // Build where clause
    const where = {
      organizationId: organizationId
        ? organizationId
        : { in: orgIds },
    }

    // Verify org access if specific org
    if (organizationId && !orgIds.includes(organizationId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const [dashboards, total] = await Promise.all([
      prisma.dashboard.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
          organization: {
            select: { name: true },
          },
          _count: {
            select: { widgets: true },
          },
          projects: {
            select: {
              project: {
                select: { id: true, title: true },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.dashboard.count({ where }),
    ])

    return NextResponse.json({
      dashboards: dashboards.map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        organizationId: d.organizationId,
        organizationName: d.organization.name,
        widgetCount: d._count.widgets,
        projects: d.projects.map((p) => p.project),
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('List dashboards error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboards' },
      { status: 500 }
    )
  }
}

// POST /api/dashboards - Create a new dashboard
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createDashboardSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { organizationId, title, description, projectIds } = parsed.data

    await requireOrganizationWrite(organizationId)

    const dashboard = await prisma.dashboard.create({
      data: {
        organizationId,
        title,
        description,
        ...(projectIds && projectIds.length > 0
          ? {
              projects: {
                create: projectIds.map((projectId) => ({
                  projectId,
                })),
              },
            }
          : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ dashboard }, { status: 201 })
  } catch (error) {
    console.error('Create dashboard error:', error)
    if (error instanceof Error && error.message === 'Write access required') {
      return NextResponse.json(
        { error: 'Write access required' },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create dashboard' },
      { status: 500 }
    )
  }
}
