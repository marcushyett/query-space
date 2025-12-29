import { prisma } from '@/lib/db/prisma'
import { decrypt } from '@/lib/encryption'
import { checkOrganizationAccess } from './session'

export interface DecryptedOrgSettings {
  databaseUrl: string | null
  claudeApiKey: string | null
  organizationName: string | null
}

/**
 * Get decrypted organization settings
 * Only returns settings if user has access to the organization
 */
export async function getOrganizationSettings(
  organizationId: string
): Promise<DecryptedOrgSettings | null> {
  // Verify user has access
  const access = await checkOrganizationAccess(organizationId)
  if (!access) {
    return null
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
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

  if (!org) {
    return null
  }

  let databaseUrl: string | null = null
  let claudeApiKey: string | null = null

  // Decrypt database URL if present
  if (org.settings?.encryptedDatabaseUrl && org.settings?.databaseUrlIv) {
    try {
      databaseUrl = decrypt({
        encrypted: org.settings.encryptedDatabaseUrl,
        iv: org.settings.databaseUrlIv,
      })
    } catch (e) {
      console.error('Failed to decrypt database URL:', e)
    }
  }

  // Decrypt Claude API key if present
  if (org.settings?.encryptedClaudeApiKey && org.settings?.claudeApiKeyIv) {
    try {
      claudeApiKey = decrypt({
        encrypted: org.settings.encryptedClaudeApiKey,
        iv: org.settings.claudeApiKeyIv,
      })
    } catch (e) {
      console.error('Failed to decrypt Claude API key:', e)
    }
  }

  return {
    databaseUrl,
    claudeApiKey,
    organizationName: org.name,
  }
}

/**
 * Get the database connection string for an organization
 * Throws if not found or no access
 */
export async function requireDatabaseConnection(
  organizationId: string
): Promise<string> {
  const settings = await getOrganizationSettings(organizationId)

  if (!settings) {
    throw new Error('Organization not found or access denied')
  }

  if (!settings.databaseUrl) {
    throw new Error('Database connection not configured. Go to Settings to add your PostgreSQL connection.')
  }

  return settings.databaseUrl
}

/**
 * Get the Claude API key for an organization
 * Falls back to environment variable if not set
 */
export async function getClaudeApiKey(
  organizationId: string
): Promise<string | null> {
  const settings = await getOrganizationSettings(organizationId)

  // Use org setting if available
  if (settings?.claudeApiKey) {
    return settings.claudeApiKey
  }

  // Fall back to environment variable
  return process.env.CLAUDE_API_KEY || null
}
