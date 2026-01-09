import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { checkOrganizationAccess, getCurrentUser } from '@/lib/auth/session'
import { generateShortId, getPublicUrl } from '@/lib/shortId'

// Helper to get dashboard and verify access
async function getDashboardWithAccess(dashboardId: string) {
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: {
      id: true,
      organizationId: true,
    },
  })

  if (!dashboard) return null

  const access = await checkOrganizationAccess(dashboard.organizationId)
  if (!access) return null

  return { dashboard, access }
}

// GET /api/dashboards/[id]/share - Get existing public link for dashboard
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

    // Find existing public link
    const publicLink = await prisma.publicLink.findFirst({
      where: { dashboardId },
      select: {
        id: true,
        shortId: true,
        expiresAt: true,
        viewCount: true,
        lastViewedAt: true,
        createdAt: true,
      },
    })

    if (!publicLink) {
      return NextResponse.json({ publicLink: null })
    }

    return NextResponse.json({
      publicLink: {
        ...publicLink,
        url: getPublicUrl(publicLink.shortId),
      },
    })
  } catch (error) {
    console.error('Get public link error:', error)
    return NextResponse.json(
      { error: 'Failed to get public link' },
      { status: 500 }
    )
  }
}

// POST /api/dashboards/[id]/share - Create a new public link
export async function POST(
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
        { error: 'Write access required to create public links' },
        { status: 403 }
      )
    }

    // Check if link already exists
    const existingLink = await prisma.publicLink.findFirst({
      where: { dashboardId },
    })

    if (existingLink) {
      return NextResponse.json({
        publicLink: {
          id: existingLink.id,
          shortId: existingLink.shortId,
          url: getPublicUrl(existingLink.shortId),
          expiresAt: existingLink.expiresAt,
          viewCount: existingLink.viewCount,
          createdAt: existingLink.createdAt,
        },
      })
    }

    // Generate unique short ID with collision detection
    let shortId: string
    let attempts = 0
    const maxAttempts = 10

    do {
      shortId = generateShortId()
      const existing = await prisma.publicLink.findUnique({
        where: { shortId },
      })
      if (!existing) break
      attempts++
    } while (attempts < maxAttempts)

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique short ID' },
        { status: 500 }
      )
    }

    // Get current user for createdById
    const user = await getCurrentUser()

    // Create the public link
    const publicLink = await prisma.publicLink.create({
      data: {
        shortId,
        organizationId: result.dashboard.organizationId,
        dashboardId,
        createdById: user?.id,
      },
    })

    return NextResponse.json({
      publicLink: {
        id: publicLink.id,
        shortId: publicLink.shortId,
        url: getPublicUrl(publicLink.shortId),
        expiresAt: publicLink.expiresAt,
        viewCount: publicLink.viewCount,
        createdAt: publicLink.createdAt,
      },
    })
  } catch (error) {
    console.error('Create public link error:', error)
    return NextResponse.json(
      { error: 'Failed to create public link' },
      { status: 500 }
    )
  }
}

// DELETE /api/dashboards/[id]/share - Revoke public link
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

    const canWrite =
      result.access.accessType === 'READ_WRITE' ||
      result.access.role === 'ADMIN'

    if (!canWrite) {
      return NextResponse.json(
        { error: 'Write access required to revoke public links' },
        { status: 403 }
      )
    }

    // Delete all public links for this dashboard
    await prisma.publicLink.deleteMany({
      where: { dashboardId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete public link error:', error)
    return NextResponse.json(
      { error: 'Failed to revoke public link' },
      { status: 500 }
    )
  }
}
