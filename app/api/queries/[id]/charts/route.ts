import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { ChartType } from '@prisma/client'

const createChartSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  type: z.enum(['line', 'column', 'area', 'pie', 'donut', 'scatter', 'funnel', 'waterfall', 'heatmap', 'radar', 'bar']),
  config: z.object({
    xAxis: z.string().nullable().optional(),
    yAxes: z.array(z.string()).optional(),
    stacked: z.boolean().optional(),
    breakdownBy: z.string().nullable().optional(),
  }).passthrough(),
})

// Map chart type strings to Prisma enum values
function mapChartType(type: string): ChartType {
  const mapping: Record<string, ChartType> = {
    'line': ChartType.LINE,
    'column': ChartType.COLUMN,
    'bar': ChartType.COLUMN, // Map bar to column (horizontal is just a config option)
    'area': ChartType.AREA,
    'pie': ChartType.PIE,
    'donut': ChartType.DONUT,
    'scatter': ChartType.SCATTER,
    'funnel': ChartType.FUNNEL,
    'waterfall': ChartType.WATERFALL,
    'heatmap': ChartType.HEATMAP,
    'radar': ChartType.RADAR,
  }
  return mapping[type] || ChartType.COLUMN
}

// Helper to check query access
async function checkQueryAccess(queryId: string) {
  const user = await getCurrentUser()
  if (!user) return null

  const query = await prisma.query.findUnique({
    where: { id: queryId },
    include: {
      project: {
        include: {
          organization: {
            include: {
              members: {
                where: { userId: user.id },
                select: { role: true, accessType: true },
              },
            },
          },
        },
      },
    },
  })

  if (!query) return null

  const member = query.project.organization.members[0]
  if (!member) return null

  return {
    query,
    userId: user.id,
    canWrite: member.accessType === 'READ_WRITE' || member.role === 'ADMIN',
  }
}

// GET /api/queries/[id]/charts - List charts for a query
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: queryId } = await params
    const access = await checkQueryAccess(queryId)

    if (!access) {
      return NextResponse.json(
        { error: 'Query not found or access denied' },
        { status: 404 }
      )
    }

    const charts = await prisma.chart.findMany({
      where: { queryId },
      select: {
        id: true,
        title: true,
        type: true,
        config: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({
      charts: charts.map((chart) => ({
        id: chart.id,
        title: chart.title,
        type: chart.type.toLowerCase(),
        config: chart.config as Record<string, unknown>,
        createdAt: chart.createdAt,
        updatedAt: chart.updatedAt,
      })),
    })
  } catch (error) {
    console.error('List charts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch charts' },
      { status: 500 }
    )
  }
}

// POST /api/queries/[id]/charts - Create a new chart
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: queryId } = await params
    const access = await checkQueryAccess(queryId)

    if (!access) {
      return NextResponse.json(
        { error: 'Query not found or access denied' },
        { status: 404 }
      )
    }

    if (!access.canWrite) {
      return NextResponse.json(
        { error: 'Write access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = createChartSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { title, type, config } = parsed.data

    const chart = await prisma.chart.create({
      data: {
        queryId,
        title: title || null,
        type: mapChartType(type),
        config: {
          type, // Store the original type string for UI
          ...config,
        },
        createdById: access.userId,
      },
      select: {
        id: true,
        title: true,
        type: true,
        config: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      chart: {
        id: chart.id,
        title: chart.title,
        type: type,
        config: chart.config as Record<string, unknown>,
        createdAt: chart.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Create chart error:', error)
    return NextResponse.json(
      { error: 'Failed to create chart' },
      { status: 500 }
    )
  }
}
