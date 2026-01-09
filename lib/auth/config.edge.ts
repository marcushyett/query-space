import type { NextAuthConfig } from 'next-auth'

/**
 * Get the correct base URL for auth callbacks.
 * For preview deployments, use VERCEL_URL instead of NEXTAUTH_URL
 * to ensure callbacks redirect to the preview branch, not production.
 */
function getAuthUrl(): string | undefined {
  // For preview deployments, always use the deployment-specific URL
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  // For production or local, use NEXTAUTH_URL if set
  return process.env.NEXTAUTH_URL
}

// Dynamically set AUTH_URL for preview deployments
// This ensures NextAuth uses the correct callback URL instead of production
const authUrl = getAuthUrl()
if (authUrl && process.env.VERCEL_ENV === 'preview') {
  process.env.NEXTAUTH_URL = authUrl
  process.env.AUTH_URL = authUrl
}

// Lightweight auth config for middleware (Edge-compatible)
// Does NOT include Prisma adapter or bcrypt which require Node.js crypto
export const authConfig: NextAuthConfig = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
    verifyRequest: '/verify-email',
    newUser: '/onboarding',
  },
  providers: [], // Providers are configured in the full config
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
      }

      if (trigger === 'update' && session) {
        return { ...token, ...session }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
      }
      return session
    },
    // Authorization check for middleware
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isPublicPath = [
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/verify-email',
        '/invite',
        '/m', // Public links (short URLs)
      ].some(path => nextUrl.pathname === path || nextUrl.pathname.startsWith(`${path}/`))

      if (isPublicPath) {
        return true
      }

      return isLoggedIn
    },
  },
  trustHost: true,
}
