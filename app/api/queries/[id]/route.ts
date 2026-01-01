import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'

const updateQuerySchema = z.object({
  name: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  sql: z.string().min(1).optional(),
  sampleResults: z.any().optional(),
  rowCount: z.number().optional().nullable(),
  executionTime: z.number().optional().nullable(),
})

// Helper to check query access
async function checkQueryAccess(queryId: string, includeAgentSessions = false) {
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
      // Include linked agent sessions if requested
      ...(includeAgentSessions && {
        agentSessions: {
          orderBy: { updatedAt: 'desc' as const },
          take: 5, // Limit to last 5 sessions
        },
      }),
    },
  })

  if (!query) return null

  const member = query.project.organization.members[0]
  if (!member) return null

  return {
    query,
    canWrite: member.accessType === 'READ_WRITE' || member.role === 'ADMIN',
  }
}

// GET /api/queries/[id] - Get query details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: queryId } = await params
    const access = await checkQueryAccess(queryId, true) // Include agent sessions

    if (!access) {
      return NextResponse.json(
        { error: 'Query not found or access denied' },
        { status: 404 }
      )
    }

    const { query, canWrite } = access

    // Transform agent sessions for response
    const agentSessions = 'agentSessions' in query ? (query.agentSessions as Array<{
      id: string;
      goal: string;
      status: string;
      currentStep: number;
      maxSteps: number;
      currentSql: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>).map(s => ({
      id: s.id,
      goal: s.goal,
      status: s.status.toLowerCase(),
      currentStep: s.currentStep,
      maxSteps: s.maxSteps,
      currentSql: s.currentSql,
      createdAt: s.createdAt.getTime(),
      updatedAt: s.updatedAt.getTime(),
    })) : [];

    return NextResponse.json({
      query: {
        id: query.id,
        name: query.name,
        description: query.description,
        sql: query.sql,
        sampleResults: query.sampleResults,
        rowCount: query.rowCount,
        executionTime: query.executionTime,
        projectId: query.projectId,
        createdAt: query.createdAt,
        updatedAt: query.updatedAt,
        agentSessions,
      },
      canWrite,
    })
  } catch (error) {
    console.error('Get query error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch query' },
      { status: 500 }
    )
  }
}

// PATCH /api/queries/[id] - Update query
export async function PATCH(
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
    const parsed = updateQuerySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { name, description, sql, sampleResults, rowCount, executionTime } = parsed.data

    // Limit sample results
    let limitedSampleResults = sampleResults
    if (sampleResults && Array.isArray(sampleResults) && sampleResults.length > 10) {
      limitedSampleResults = sampleResults.slice(0, 10)
    }

    const query = await prisma.query.update({
      where: { id: queryId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(sql && { sql }),
        ...(limitedSampleResults !== undefined && { sampleResults: limitedSampleResults }),
        ...(rowCount !== undefined && { rowCount }),
        ...(executionTime !== undefined && { executionTime }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        sql: true,
        sampleResults: true,
        rowCount: true,
        executionTime: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ query })
  } catch (error) {
    console.error('Update query error:', error)
    return NextResponse.json(
      { error: 'Failed to update query' },
      { status: 500 }
    )
  }
}

// DELETE /api/queries/[id] - Delete query
export async function DELETE(
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

    // Delete query (cascades to charts)
    await prisma.query.delete({
      where: { id: queryId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete query error:', error)
    return NextResponse.json(
      { error: 'Failed to delete query' },
      { status: 500 }
    )
  }
}
