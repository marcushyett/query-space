import type { NextAuthConfig } from 'next-auth'

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
      ].some(path => nextUrl.pathname === path || nextUrl.pathname.startsWith(`${path}/`))

      if (isPublicPath) {
        return true
      }

      return isLoggedIn
    },
  },
  trustHost: true,
}
