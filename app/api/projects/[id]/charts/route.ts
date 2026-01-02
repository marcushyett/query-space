import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { checkProjectAccess } from '@/lib/auth/session'

const listChartsSchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

// GET /api/projects/[id]/charts - List charts in a project
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
    const parsed = listChartsSchema.safeParse(searchParams)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      )
    }

    const { search, limit, offset } = parsed.data

    // Build where clause - charts belong to queries, which belong to projects
    const where: {
      query: { projectId: string }
      OR?: Array<{ title?: { contains: string; mode: 'insensitive' }; query?: { name: { contains: string; mode: 'insensitive' } } }>
    } = {
      query: { projectId }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { query: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [charts, total] = await Promise.all([
      prisma.chart.findMany({
        where,
        select: {
          id: true,
          title: true,
          type: true,
          config: true,
          createdAt: true,
          updatedAt: true,
          query: {
            select: {
              id: true,
              name: true,
              sql: true,
            },
          },
          createdBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.chart.count({ where }),
    ])

    return NextResponse.json({
      charts: charts.map((chart: {
        id: string;
        title: string | null;
        type: string;
        config: unknown;
        query: { id: string; name: string | null; sql: string };
        createdBy: { name: string | null; email: string } | null;
        createdAt: Date;
        updatedAt: Date;
      }) => ({
        id: chart.id,
        title: chart.title,
        type: chart.type,
        config: chart.config as Record<string, unknown>,
        query: {
          id: chart.query.id,
          name: chart.query.name,
          sql: chart.query.sql,
        },
        createdBy: chart.createdBy?.name || chart.createdBy?.email || null,
        createdAt: chart.createdAt,
        updatedAt: chart.updatedAt,
      })),
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('List charts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch charts' },
      { status: 500 }
    )
  }
}
