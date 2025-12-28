import { auth } from '@/lib/auth/config'
import { prisma } from '@/lib/db/prisma'
import { cache } from 'react'

export type SessionUser = {
  id: string
  email: string
  name: string | null
  image: string | null
}

export type OrganizationWithRole = {
  id: string
  name: string | null
  role: 'ADMIN' | 'MEMBER'
  accessType: 'READ_ONLY' | 'READ_WRITE'
}

export type CurrentUserContext = {
  user: SessionUser
  organizations: OrganizationWithRole[]
  currentOrganization: OrganizationWithRole | null
}

/**
 * Get the current session user (cached per request)
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth()
  if (!session?.user?.id) return null

  return {
    id: session.user.id,
    email: session.user.email || '',
    name: session.user.name || null,
    image: session.user.image || null,
  }
})

/**
 * Get all organizations the current user belongs to
 */
export const getUserOrganizations = cache(async (): Promise<OrganizationWithRole[]> => {
  const user = await getCurrentUser()
  if (!user) return []

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    role: m.role,
    accessType: m.accessType,
  }))
})

/**
 * Get the default organization for the current user
 * (their first/oldest organization)
 */
export const getDefaultOrganization = cache(async (): Promise<OrganizationWithRole | null> => {
  const organizations = await getUserOrganizations()
  return organizations[0] || null
})

/**
 * Check if user has access to a specific organization
 */
export async function checkOrganizationAccess(
  organizationId: string
): Promise<OrganizationWithRole | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: user.id,
      },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!membership) return null

  return {
    id: membership.organization.id,
    name: membership.organization.name,
    role: membership.role,
    accessType: membership.accessType,
  }
}

/**
 * Check if user has access to a specific project
 * Returns access info or null if no access
 */
export async function checkProjectAccess(projectId: string): Promise<{
  project: { id: string; title: string; organizationId: string }
  canWrite: boolean
  organization: OrganizationWithRole
} | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      organizationId: true,
    },
  })

  if (!project) return null

  // Check organization membership
  const orgAccess = await checkOrganizationAccess(project.organizationId)
  if (!orgAccess) return null

  // Check if user has specific project access restrictions
  const projectAccess = await prisma.projectAccess.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: user.id,
      },
    },
  })

  // If user is admin, they always have full access
  if (orgAccess.role === 'ADMIN') {
    return { project, canWrite: true, organization: orgAccess }
  }

  // Check if user has any project restrictions in this org
  const hasAnyRestrictions = await prisma.projectAccess.findFirst({
    where: {
      userId: user.id,
      project: { organizationId: project.organizationId },
    },
  })

  if (hasAnyRestrictions) {
    // User has restrictions - they need explicit access
    if (!projectAccess) return null // No access to this project

    const canWrite = projectAccess.canWrite && orgAccess.accessType === 'READ_WRITE'
    return { project, canWrite, organization: orgAccess }
  }

  // No restrictions - user has access based on org-level accessType
  const canWrite = orgAccess.accessType === 'READ_WRITE'
  return { project, canWrite, organization: orgAccess }
}

/**
 * Require authenticated user, throws if not authenticated
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

/**
 * Require organization access, throws if no access
 */
export async function requireOrganizationAccess(
  organizationId: string
): Promise<OrganizationWithRole> {
  const access = await checkOrganizationAccess(organizationId)
  if (!access) {
    throw new Error('Organization access denied')
  }
  return access
}

/**
 * Require admin role in organization
 */
export async function requireOrganizationAdmin(
  organizationId: string
): Promise<OrganizationWithRole> {
  const access = await requireOrganizationAccess(organizationId)
  if (access.role !== 'ADMIN') {
    throw new Error('Admin access required')
  }
  return access
}

/**
 * Require write access in organization
 */
export async function requireOrganizationWrite(
  organizationId: string
): Promise<OrganizationWithRole> {
  const access = await requireOrganizationAccess(organizationId)
  if (access.accessType === 'READ_ONLY' && access.role !== 'ADMIN') {
    throw new Error('Write access required')
  }
  return access
}
