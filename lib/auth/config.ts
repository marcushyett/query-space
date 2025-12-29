import NextAuth from 'next-auth'
import type { OAuthConfig } from 'next-auth/providers'
import { PrismaAdapter } from '@auth/prisma-adapter'
import GitHub from 'next-auth/providers/github'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import { authConfig } from './config.edge'

// Vercel OIDC profile type (standard OpenID Connect claims)
interface VercelProfile {
  sub: string
  email: string
  name?: string
  picture?: string
}

// Vercel OAuth provider (custom implementation)
const VercelProvider: OAuthConfig<VercelProfile> = {
  id: 'vercel',
  name: 'Vercel',
  type: 'oauth',
  authorization: {
    url: 'https://vercel.com/oauth/authorize',
    params: { scope: 'openid email profile' },
  },
  token: {
    url: 'https://api.vercel.com/login/oauth/token',
  },
  userinfo: 'https://api.vercel.com/login/oauth/userinfo',
  profile(profile) {
    return {
      id: profile.sub,
      email: profile.email,
      name: profile.name ?? profile.email,
      image: profile.picture,
    }
  },
  // Use PKCE with S256 for enhanced security (Vercel supports PKCE)
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
      // Allow OAuth sign-ins without email verification
      if (account?.provider !== 'credentials') {
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
