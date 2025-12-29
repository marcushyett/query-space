import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'

// GET /api/invites/[token] - Get invite details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const invite = await prisma.organizationInvite.findUnique({
      where: { token },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        invitedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!invite) {
      return NextResponse.json(
        { error: 'Invite not found' },
        { status: 404 }
      )
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This invite has expired' },
        { status: 410 }
      )
    }

    return NextResponse.json({
      invite: {
        email: invite.email,
        role: invite.role,
        accessType: invite.accessType,
        organization: {
          id: invite.organization.id,
          name: invite.organization.name,
        },
        invitedBy: invite.invitedBy?.name || invite.invitedBy?.email || 'Unknown',
        expiresAt: invite.expiresAt,
      },
    })
  } catch (error) {
    console.error('Get invite error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invite' },
      { status: 500 }
    )
  }
}

// POST /api/invites/[token] - Accept invite
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { error: 'You must be logged in to accept an invite' },
        { status: 401 }
      )
    }

    const invite = await prisma.organizationInvite.findUnique({
      where: { token },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!invite) {
      return NextResponse.json(
        { error: 'Invite not found' },
        { status: 404 }
      )
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This invite has expired' },
        { status: 410 }
      )
    }

    // Verify email matches (case-insensitive)
    if (invite.email.toLowerCase() !== currentUser.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invite was sent to a different email address' },
        { status: 403 }
      )
    }

    // Check if already a member
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invite.organizationId,
          userId: currentUser.id,
        },
      },
    })

    if (existingMember) {
      // Delete the invite since they're already a member
      await prisma.organizationInvite.delete({
        where: { id: invite.id },
      })

      return NextResponse.json({
        success: true,
        message: 'You are already a member of this organization',
        organization: invite.organization,
      })
    }

    // Accept invite - create membership and delete invite
    await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          organizationId: invite.organizationId,
          userId: currentUser.id,
          role: invite.role,
          accessType: invite.accessType,
        },
      }),
      prisma.organizationInvite.delete({
        where: { id: invite.id },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: 'Successfully joined the organization',
      organization: invite.organization,
    })
  } catch (error) {
    console.error('Accept invite error:', error)
    return NextResponse.json(
      { error: 'Failed to accept invite' },
      { status: 500 }
    )
  }
}
