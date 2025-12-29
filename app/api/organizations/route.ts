import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { requireUser, getUserOrganizations } from '@/lib/auth/session'

const createOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

// GET /api/organizations - List user's organizations
export async function GET() {
  try {
    const organizations = await getUserOrganizations()

    return NextResponse.json({ organizations })
  } catch (error) {
    console.error('Get organizations error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    )
  }
}

// POST /api/organizations - Create a new organization
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const parsed = createOrgSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      )
    }

    const { name } = parsed.data

    const organization = await prisma.organization.create({
      data: {
        name,
        members: {
          create: {
            userId: user.id,
            role: 'ADMIN',
            accessType: 'READ_WRITE',
          },
        },
        settings: {
          create: {},
        },
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ organization }, { status: 201 })
  } catch (error) {
    console.error('Create organization error:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    )
  }
}
