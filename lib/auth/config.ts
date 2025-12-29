import NextAuth from 'next-auth'
import type { OAuthConfig, OAuthUserConfig } from 'next-auth/providers'
import type { TokenSet } from '@auth/core/types'
import { PrismaAdapter } from '@auth/prisma-adapter'
import GitHub from 'next-auth/providers/github'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import { authConfig } from './config.edge'

// Vercel profile type from userinfo endpoint
interface VercelProfile {
  sub: string
  email: string
  name?: string
  picture?: string
  // Vercel-specific fields
  user_id?: string
  username?: string
}

// Vercel OAuth provider (custom implementation using Vercel's authorization server)
// Docs: https://vercel.com/docs/sign-in-with-vercel/authorization-server-api
const VercelProvider: OAuthConfig<VercelProfile> = {
  id: 'vercel',
  name: 'Vercel',
  type: 'oauth',
  authorization: {
    url: 'https://vercel.com/oauth/authorize',
    // Use Vercel's supported scopes: profile, email, teams, billing
    // Don't use 'openid' as Vercel uses its own scope format
    params: { scope: 'profile email' },
  },
  token: {
    url: 'https://api.vercel.com/login/oauth/token',
  },
  userinfo: {
    url: 'https://api.vercel.com/login/oauth/userinfo',
    async request({ tokens, provider }: { tokens: TokenSet; provider: OAuthUserConfig<VercelProfile> }) {
      // Fetch userinfo with access token
      const userinfoUrl = typeof provider.userinfo === 'object' ? provider.userinfo.url : provider.userinfo
      const response = await fetch(userinfoUrl as string, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch userinfo: ${response.status}`)
      }
      return response.json()
    },
  },
  profile(profile) {
    return {
      id: profile.sub || profile.user_id || profile.email,
      email: profile.email,
      name: profile.name ?? profile.username ?? profile.email,
      image: profile.picture,
    }
  },
  // Use PKCE with S256 for enhanced security (Vercel supports PKCE)
  // state is also used for CSRF protection
  checks: ['pkce', 'state'],
  clientId: process.env.VERCEL_CLIENT_ID,
  clientSecret: process.env.VERCEL_CLIENT_SECRET,
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    ...(process.env.VERCEL_CLIENT_ID && process.env.VERCEL_CLIENT_SECRET
      ? [VercelProvider]
      : []),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)

        if (!parsed.success) {
          return null
        }

        const { email, password } = parsed.data

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || !user.password) {
          return null
        }

        const isValidPassword = await compare(password, user.password)

        if (!isValidPassword) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // For OAuth providers, handle account linking
      if (account && account.provider !== 'credentials' && user.email) {
        // Check if a user with this email already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { accounts: true },
        })

        if (existingUser) {
          // Check if this OAuth account is already linked
          const existingAccount = existingUser.accounts.find(
            (acc) => acc.provider === account.provider && acc.providerAccountId === account.providerAccountId
          )

          if (!existingAccount) {
            // Link the new OAuth account to the existing user
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            })
          }

          // Update the user object to use the existing user's ID
          // This ensures the session uses the correct user
          user.id = existingUser.id
        }

        return true
      }

      // For credentials, check email verification
      if (user.id) {
        const existingUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { emailVerified: true },
        })

        if (!existingUser?.emailVerified) {
          // Still allow sign in, but we'll prompt for verification
          return true
        }
      }

      return true
    },
  },
  events: {
    async createUser({ user }) {
      // When a new user is created, create a default organization for them
      if (user.id) {
        await prisma.organization.create({
          data: {
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
        })
      }
    },
  },
})
