import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { checkOrganizationAccess } from '@/lib/auth/session'

const createWidgetSchema = z.object({
  type: z.enum(['CHART', 'TABLE']),
  chartId: z.string().optional(),
  queryId: z.string().optional(),
  positionX: z.number().min(0).max(11).default(0),
  positionY: z.number().min(0).default(0),
  width: z.number().min(1).max(12).default(6),
  height: z.number().min(1).max(12).default(4),
  title: z.string().max(200).optional(),
})

const updateWidgetSchema = z.object({
  positionX: z.number().min(0).max(11).optional(),
  positionY: z.number().min(0).optional(),
  width: z.number().min(1).max(12).optional(),
  height: z.number().min(1).max(12).optional(),
  title: z.string().max(200).optional().nullable(),
})

// Helper to verify dashboard access
async function verifyDashboardAccess(dashboardId: string) {
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: { organizationId: true },
  })

  if (!dashboard) return null

  const access = await checkOrganizationAccess(dashboard.organizationId)
  if (!access) return null

  const canWrite =
    access.accessType === 'READ_WRITE' || access.role === 'ADMIN'

  return { organizationId: dashboard.organizationId, canWrite, access }
}

// POST /api/dashboards/[id]/widgets - Add widget to dashboard
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dashboardId } = await params
    const result = await verifyDashboardAccess(dashboardId)

    if (!result) {
      return NextResponse.json(
        { error: 'Dashboard not found or access denied' },
        { status: 404 }
      )
    }

    if (!result.canWrite) {
      return NextResponse.json(
        { error: 'Write access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = createWidgetSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { type, chartId, queryId, positionX, positionY, width, height, title } =
      parsed.data

    // Validate that either chartId or queryId is provided
    if (type === 'CHART' && !chartId) {
      return NextResponse.json(
        { error: 'Chart ID is required for chart widgets' },
        { status: 400 }
      )
    }

    if (type === 'TABLE' && !queryId) {
      return NextResponse.json(
        { error: 'Query ID is required for table widgets' },
        { status: 400 }
      )
    }

    const widget = await prisma.dashboardWidget.create({
      data: {
        dashboardId,
        type,
        chartId: type === 'CHART' ? chartId : null,
        queryId: type === 'TABLE' ? queryId : null,
        positionX,
        positionY,
        width,
        height,
        title,
      },
      select: {
        id: true,
        type: true,
        positionX: true,
        positionY: true,
        width: true,
        height: true,
        title: true,
      },
    })

    return NextResponse.json({ widget }, { status: 201 })
  } catch (error) {
    console.error('Create widget error:', error)
    return NextResponse.json(
      { error: 'Failed to create widget' },
      { status: 500 }
    )
  }
}

// PATCH /api/dashboards/[id]/widgets?widgetId=xxx - Update widget
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dashboardId } = await params
    const widgetId = request.nextUrl.searchParams.get('widgetId')

    if (!widgetId) {
      return NextResponse.json(
        { error: 'Widget ID is required' },
        { status: 400 }
      )
    }

    const result = await verifyDashboardAccess(dashboardId)

    if (!result) {
      return NextResponse.json(
        { error: 'Dashboard not found or access denied' },
        { status: 404 }
      )
    }

    if (!result.canWrite) {
      return NextResponse.json(
        { error: 'Write access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = updateWidgetSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      )
    }

    const { positionX, positionY, width, height, title } = parsed.data

    // Verify widget belongs to dashboard
    const widget = await prisma.dashboardWidget.findFirst({
      where: {
        id: widgetId,
        dashboardId,
      },
    })

    if (!widget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      )
    }

    await prisma.dashboardWidget.update({
      where: { id: widgetId },
      data: {
        ...(positionX !== undefined && { positionX }),
        ...(positionY !== undefined && { positionY }),
        ...(width !== undefined && { width }),
        ...(height !== undefined && { height }),
        ...(title !== undefined && { title }),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update widget error:', error)
    return NextResponse.json(
      { error: 'Failed to update widget' },
      { status: 500 }
    )
  }
}

// DELETE /api/dashboards/[id]/widgets?widgetId=xxx - Remove widget
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dashboardId } = await params
    const widgetId = request.nextUrl.searchParams.get('widgetId')

    if (!widgetId) {
      return NextResponse.json(
        { error: 'Widget ID is required' },
        { status: 400 }
      )
    }

    const result = await verifyDashboardAccess(dashboardId)

    if (!result) {
      return NextResponse.json(
        { error: 'Dashboard not found or access denied' },
        { status: 404 }
      )
    }

    if (!result.canWrite) {
      return NextResponse.json(
        { error: 'Write access required' },
        { status: 403 }
      )
    }

    // Delete widget (must belong to this dashboard)
    await prisma.dashboardWidget.deleteMany({
      where: {
        id: widgetId,
        dashboardId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete widget error:', error)
    return NextResponse.json(
      { error: 'Failed to delete widget' },
      { status: 500 }
    )
  }
}
