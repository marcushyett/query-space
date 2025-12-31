import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { checkOrganizationAccess } from '@/lib/auth/session'

const layoutUpdateSchema = z.object({
  layouts: z.array(
    z.object({
      widgetId: z.string(),
      positionX: z.number().min(0).max(11),
      positionY: z.number().min(0),
      width: z.number().min(1).max(12),
      height: z.number().min(1).max(12),
    })
  ),
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

// PUT /api/dashboards/[id]/layout - Batch update widget layouts
export async function PUT(
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
    const parsed = layoutUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid layout data' },
        { status: 400 }
      )
    }

    const { layouts } = parsed.data

    // Batch update all widget positions in a transaction
    await prisma.$transaction(
      layouts.map((layout) =>
        prisma.dashboardWidget.updateMany({
          where: {
            id: layout.widgetId,
            dashboardId: dashboardId,
          },
          data: {
            positionX: layout.positionX,
            positionY: layout.positionY,
            width: layout.width,
            height: layout.height,
          },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update layout error:', error)
    return NextResponse.json(
      { error: 'Failed to update layout' },
      { status: 500 }
    )
  }
}
