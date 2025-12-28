import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import {
  checkOrganizationAccess,
  requireOrganizationAdmin,
} from '@/lib/auth/session'

const updateDashboardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  projectIds: z.array(z.string()).optional(),
})

// Helper to get dashboard and verify access
async function getDashboardWithAccess(dashboardId: string) {
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: {
      id: true,
      title: true,
      description: true,
      organizationId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!dashboard) return null

  const access = await checkOrganizationAccess(dashboard.organizationId)
  if (!access) return null

  return { dashboard, access }
}

// GET /api/dashboards/[id] - Get dashboard with widgets
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dashboardId } = await params
    const result = await getDashboardWithAccess(dashboardId)

    if (!result) {
      return NextResponse.json(
        { error: 'Dashboard not found or access denied' },
        { status: 404 }
      )
    }

    const { dashboard, access } = result

    // Get full dashboard data with widgets
    const fullDashboard = await prisma.dashboard.findUnique({
      where: { id: dashboardId },
      include: {
        organization: {
          select: { name: true },
        },
        projects: {
          include: {
            project: {
              select: { id: true, title: true },
            },
          },
        },
        widgets: {
          include: {
            chart: {
              include: {
                query: {
                  select: {
                    id: true,
                    name: true,
                    sql: true,
                    sampleResults: true,
                  },
                },
              },
            },
            query: {
              select: {
                id: true,
                name: true,
                sql: true,
                sampleResults: true,
              },
            },
          },
          orderBy: [{ positionY: 'asc' }, { positionX: 'asc' }],
        },
      },
    })

    if (!fullDashboard) {
      return NextResponse.json(
        { error: 'Dashboard not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      dashboard: {
        id: fullDashboard.id,
        title: fullDashboard.title,
        description: fullDashboard.description,
        organizationId: fullDashboard.organizationId,
        organizationName: fullDashboard.organization.name,
        projects: fullDashboard.projects.map((p) => p.project),
        widgets: fullDashboard.widgets.map((w) => ({
          id: w.id,
          type: w.type,
          positionX: w.positionX,
          positionY: w.positionY,
          width: w.width,
          height: w.height,
          title: w.title,
          chart: w.chart
            ? {
                id: w.chart.id,
                title: w.chart.title,
                type: w.chart.type,
                config: w.chart.config,
                query: w.chart.query,
              }
            : null,
          query: w.query,
        })),
        createdAt: fullDashboard.createdAt,
        updatedAt: fullDashboard.updatedAt,
      },
      canWrite: access.accessType === 'READ_WRITE' || access.role === 'ADMIN',
    })
  } catch (error) {
    console.error('Get dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard' },
      { status: 500 }
    )
  }
}

// PATCH /api/dashboards/[id] - Update dashboard
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dashboardId } = await params
    const result = await getDashboardWithAccess(dashboardId)

    if (!result) {
      return NextResponse.json(
        { error: 'Dashboard not found or access denied' },
        { status: 404 }
      )
    }

    const canWrite =
      result.access.accessType === 'READ_WRITE' ||
      result.access.role === 'ADMIN'

    if (!canWrite) {
      return NextResponse.json(
        { error: 'Write access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = updateDashboardSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { title, description, projectIds } = parsed.data

    // Update dashboard
    await prisma.$transaction(async (tx) => {
      // Update basic fields
      await tx.dashboard.update({
        where: { id: dashboardId },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
        },
      })

      // Update project links if provided
      if (projectIds !== undefined) {
        // Remove existing links
        await tx.dashboardProject.deleteMany({
          where: { dashboardId },
        })

        // Create new links
        if (projectIds.length > 0) {
          await tx.dashboardProject.createMany({
            data: projectIds.map((projectId) => ({
              dashboardId,
              projectId,
            })),
          })
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to update dashboard' },
      { status: 500 }
    )
  }
}

// DELETE /api/dashboards/[id] - Delete dashboard
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: dashboardId } = await params
    const result = await getDashboardWithAccess(dashboardId)

    if (!result) {
      return NextResponse.json(
        { error: 'Dashboard not found or access denied' },
        { status: 404 }
      )
    }

    // Only admins can delete
    try {
      await requireOrganizationAdmin(result.access.id)
    } catch {
      return NextResponse.json(
        { error: 'Admin access required to delete dashboards' },
        { status: 403 }
      )
    }

    await prisma.dashboard.delete({
      where: { id: dashboardId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to delete dashboard' },
      { status: 500 }
    )
  }
}
