import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { checkProjectAccess, getCurrentUser } from '@/lib/auth/session'

const createQuerySchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  sql: z.string().min(1, 'SQL is required'),
  sampleResults: z.any().optional(),
  rowCount: z.number().optional(),
  executionTime: z.number().optional(),
})

const listQueriesSchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

// GET /api/projects/[id]/queries - List queries in a project
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
    const parsed = listQueriesSchema.safeParse(searchParams)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      )
    }

    const { search, limit, offset } = parsed.data

    // Build where clause
    const where: {
      projectId: string
      OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; sql?: { contains: string; mode: 'insensitive' } }>
    } = { projectId }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sql: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [queries, total] = await Promise.all([
      prisma.query.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          sql: true,
          rowCount: true,
          executionTime: true,
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
              charts: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.query.count({ where }),
    ])

    return NextResponse.json({
      queries: queries.map((q) => ({
        id: q.id,
        name: q.name,
        description: q.description,
        sql: q.sql,
        rowCount: q.rowCount,
        executionTime: q.executionTime,
        chartCount: q._count.charts,
        createdBy: q.createdBy?.name || q.createdBy?.email || null,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      })),
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error('List queries error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch queries' },
      { status: 500 }
    )
  }
}

// POST /api/projects/[id]/queries - Save a new query
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
    const parsed = createQuerySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { name, description, sql, sampleResults, rowCount, executionTime } = parsed.data

    // Limit sample results to prevent storage bloat
    let limitedSampleResults = sampleResults
    if (sampleResults && Array.isArray(sampleResults) && sampleResults.length > 10) {
      limitedSampleResults = sampleResults.slice(0, 10)
    }

    const query = await prisma.query.create({
      data: {
        projectId,
        name,
        description,
        sql,
        sampleResults: limitedSampleResults,
        rowCount,
        executionTime,
        createdById: user?.id,
      },
      select: {
        id: true,
        name: true,
        sql: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ query }, { status: 201 })
  } catch (error) {
    console.error('Create query error:', error)
    return NextResponse.json(
      { error: 'Failed to save query' },
      { status: 500 }
    )
  }
}
