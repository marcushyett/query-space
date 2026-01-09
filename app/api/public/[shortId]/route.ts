import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// GET /api/public/[shortId] - Get public dashboard/query data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortId: string }> }
) {
  try {
    const { shortId } = await params

    // Find the public link
    const publicLink = await prisma.publicLink.findUnique({
      where: { shortId },
      include: {
        dashboard: {
          include: {
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
        },
        query: {
          select: {
            id: true,
            name: true,
            sql: true,
            sampleResults: true,
            rowCount: true,
            executionTime: true,
          },
        },
      },
    })

    if (!publicLink) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      )
    }

    // Check expiration
    if (publicLink.expiresAt && publicLink.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Link has expired' },
        { status: 410 }
      )
    }

    // Increment view count (non-blocking)
    prisma.publicLink.update({
      where: { id: publicLink.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    }).catch(console.error)

    // Return dashboard or query data
    if (publicLink.dashboard) {
      return NextResponse.json({
        type: 'dashboard',
        data: {
          id: publicLink.dashboard.id,
          title: publicLink.dashboard.title,
          description: publicLink.dashboard.description,
          widgets: publicLink.dashboard.widgets.map((w: {
            id: string;
            type: string;
            positionX: number;
            positionY: number;
            width: number;
            height: number;
            title: string | null;
            config: unknown;
            chart: { id: string; title: string | null; type: string; config: unknown; query: unknown } | null;
            query: unknown;
          }) => ({
            id: w.id,
            type: w.type,
            positionX: w.positionX,
            positionY: w.positionY,
            width: w.width,
            height: w.height,
            title: w.title,
            config: w.config,
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
        },
      })
    }

    if (publicLink.query) {
      return NextResponse.json({
        type: 'query',
        data: publicLink.query,
      })
    }

    return NextResponse.json(
      { error: 'No content linked' },
      { status: 404 }
    )
  } catch (error) {
    console.error('Get public content error:', error)
    return NextResponse.json(
      { error: 'Failed to load content' },
      { status: 500 }
    )
  }
}
