import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth/config.edge'

// Use the edge-compatible auth config (no Prisma, bcrypt, or Node.js crypto)
const { auth } = NextAuth(authConfig)

// Export the auth middleware directly - it uses the `authorized` callback
export default auth

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth API routes handled by NextAuth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
