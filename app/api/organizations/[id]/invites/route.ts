import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import {
  requireOrganizationAdmin,
  requireOrganizationAccess,
  getCurrentUser,
} from '@/lib/auth/session'
import { sendOrganizationInviteEmail } from '@/lib/email'

const createInviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
  accessType: z.enum(['READ_ONLY', 'READ_WRITE']).default('READ_WRITE'),
})

// GET /api/organizations/[id]/invites - List pending invites
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params
    await requireOrganizationAccess(organizationId)

    const invites = await prisma.organizationInvite.findMany({
      where: {
        organizationId,
        expiresAt: { gt: new Date() },
      },
      include: {
        invitedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      invites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        accessType: i.accessType,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
        invitedBy: i.invitedBy?.name || i.invitedBy?.email,
      })),
    })
  } catch (error) {
    console.error('Get invites error:', error)
    if (error instanceof Error) {
      if (error.message === 'Organization access denied') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }
    return NextResponse.json(
      { error: 'Failed to fetch invites' },
      { status: 500 }
    )
  }
}

// POST /api/organizations/[id]/invites - Create invite
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params
    await requireOrganizationAdmin(organizationId)

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createInviteSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { email, role, accessType } = parsed.data

    // Check if user is already a member
    const existingMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: { email },
      },
    })

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this organization' },
        { status: 409 }
      )
    }

    // Check for existing invite
    const existingInvite = await prisma.organizationInvite.findFirst({
      where: {
        organizationId,
        email,
        expiresAt: { gt: new Date() },
      },
    })

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invite has already been sent to this email' },
        { status: 409 }
      )
    }

    // Get organization name
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    })

    // Create invite (expires in 7 days)
    const invite = await prisma.organizationInvite.create({
      data: {
        organizationId,
        email,
        role,
        accessType,
        invitedById: currentUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    // Send invite email
    await sendOrganizationInviteEmail(
      email,
      invite.token,
      currentUser.name,
      organization?.name || null
    )

    return NextResponse.json({ success: true, inviteId: invite.id }, { status: 201 })
  } catch (error) {
    console.error('Create invite error:', error)
    if (error instanceof Error) {
      if (error.message === 'Admin access required') {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        )
      }
    }
    return NextResponse.json(
      { error: 'Failed to create invite' },
      { status: 500 }
    )
  }
}

// DELETE /api/organizations/[id]/invites?inviteId=xxx - Cancel invite
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params
    await requireOrganizationAdmin(organizationId)

    const inviteId = request.nextUrl.searchParams.get('inviteId')
    if (!inviteId) {
      return NextResponse.json(
        { error: 'Invite ID is required' },
        { status: 400 }
      )
    }

    // Find and delete invite
    const invite = await prisma.organizationInvite.findFirst({
      where: {
        id: inviteId,
        organizationId,
      },
    })

    if (!invite) {
      return NextResponse.json(
        { error: 'Invite not found' },
        { status: 404 }
      )
    }

    await prisma.organizationInvite.delete({
      where: { id: inviteId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete invite error:', error)
    return NextResponse.json(
      { error: 'Failed to delete invite' },
      { status: 500 }
    )
  }
}
