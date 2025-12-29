import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'

import {
  requireOrganizationAccess,
  requireOrganizationAdmin,
} from '@/lib/auth/session'
import {
  encrypt,
  decrypt,
  validatePostgresConnectionString,
  testPostgresConnection,
  maskConnectionString,
} from '@/lib/encryption'

const updateSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional().nullable(),
  databaseUrl: z.string().optional().nullable(),
  claudeApiKey: z.string().optional().nullable(),
})

// GET /api/organizations/[id]/settings - Get organization settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params
    const access = await requireOrganizationAccess(organizationId)

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        settings: {
          select: {
            encryptedDatabaseUrl: true,
            databaseUrlIv: true,
            encryptedClaudeApiKey: true,
            claudeApiKeyIv: true,
          },
        },
      },
    })

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Decrypt and mask sensitive data for display
    let databaseUrlMasked: string | null = null
    let hasDatabaseUrl = false
    let hasClaudeApiKey = false

    if (organization.settings?.encryptedDatabaseUrl && organization.settings?.databaseUrlIv) {
      const decryptedUrl = decrypt({
        encrypted: organization.settings.encryptedDatabaseUrl,
        iv: organization.settings.databaseUrlIv,
      })
      databaseUrlMasked = maskConnectionString(decryptedUrl)
      hasDatabaseUrl = true
    }

    if (organization.settings?.encryptedClaudeApiKey && organization.settings?.claudeApiKeyIv) {
      hasClaudeApiKey = true
    }

    return NextResponse.json({
      settings: {
        name: organization.name,
        databaseUrlMasked,
        hasDatabaseUrl,
        hasClaudeApiKey,
        claudeApiKeyMasked: hasClaudeApiKey ? '****...****' : null,
      },
      role: access.role,
    })
  } catch (error) {
    console.error('Get settings error:', error)
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Organization access denied') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

// PATCH /api/organizations/[id]/settings - Update organization settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params
    await requireOrganizationAdmin(organizationId)

    const body = await request.json()
    const parsed = updateSettingsSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { name, databaseUrl, claudeApiKey } = parsed.data

    // Prepare update data
    const orgUpdate: { name?: string | null } = {}
    const settingsUpdate: {
      encryptedDatabaseUrl?: string | null
      databaseUrlIv?: string | null
      encryptedClaudeApiKey?: string | null
      claudeApiKeyIv?: string | null
    } = {}

    // Update name
    if (name !== undefined) {
      orgUpdate.name = name
    }

    // Update database URL
    if (databaseUrl !== undefined) {
      if (databaseUrl === null || databaseUrl === '') {
        // Clear the connection
        settingsUpdate.encryptedDatabaseUrl = null
        settingsUpdate.databaseUrlIv = null
      } else {
        // Validate connection string format
        const validationError = validatePostgresConnectionString(databaseUrl)
        if (validationError) {
          return NextResponse.json(
            { error: validationError },
            { status: 400 }
          )
        }

        // Test the actual connection
        const connectionError = await testPostgresConnection(databaseUrl)
        if (connectionError) {
          return NextResponse.json(
            { error: connectionError },
            { status: 400 }
          )
        }

        // Encrypt and store
        const encrypted = encrypt(databaseUrl)
        settingsUpdate.encryptedDatabaseUrl = encrypted.encrypted
        settingsUpdate.databaseUrlIv = encrypted.iv
      }
    }

    // Update Claude API key
    if (claudeApiKey !== undefined) {
      if (claudeApiKey === null || claudeApiKey === '') {
        // Clear the key
        settingsUpdate.encryptedClaudeApiKey = null
        settingsUpdate.claudeApiKeyIv = null
      } else {
        // Validate format (sk-ant-... or similar)
        if (!claudeApiKey.startsWith('sk-')) {
          return NextResponse.json(
            { error: 'Invalid API key format. Claude API keys start with "sk-"' },
            { status: 400 }
          )
        }

        // Encrypt and store
        const encrypted = encrypt(claudeApiKey)
        settingsUpdate.encryptedClaudeApiKey = encrypted.encrypted
        settingsUpdate.claudeApiKeyIv = encrypted.iv
      }
    }

    // Update in transaction
    await prisma.$transaction(async (tx) => {
      if (Object.keys(orgUpdate).length > 0) {
        await tx.organization.update({
          where: { id: organizationId },
          data: orgUpdate,
        })
      }

      if (Object.keys(settingsUpdate).length > 0) {
        await tx.organizationSettings.update({
          where: { organizationId },
          data: settingsUpdate,
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update settings error:', error)
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'Admin access required') {
        return NextResponse.json(
          { error: 'Admin access required to update settings' },
          { status: 403 }
        )
      }
    }
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
