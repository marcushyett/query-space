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
// Based on https://vercel.com/docs/sign-in-with-vercel/authorization-server-api#user-info-endpoint
interface VercelProfile {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
  preferred_username?: string
  picture?: string
}

// Vercel OAuth provider (custom implementation using Vercel's authorization server)
// Docs: https://vercel.com/docs/sign-in-with-vercel/authorization-server-api
const VercelProvider: OAuthConfig<VercelProfile> = {
  id: 'vercel',
  name: 'Vercel',
  type: 'oauth',
  // Vercel uses OpenID Connect - discovery URL for well-known config
  wellKnown: 'https://vercel.com/.well-known/openid-configuration',
  authorization: {
    url: 'https://vercel.com/oauth/authorize',
    // Vercel requires OpenID Connect scopes
    // openid: required for OIDC
    // email: get user email
    // profile: get user profile info
    params: {
      scope: 'openid email profile',
      response_type: 'code',
    },
  },
  token: {
    url: 'https://api.vercel.com/login/oauth/token',
    // Vercel requires form-urlencoded body with grant_type
    async request({ params, checks, provider }) {
      const response = await fetch('https://api.vercel.com/login/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: provider.clientId as string,
          client_secret: provider.clientSecret as string,
          code: params.code as string,
          code_verifier: checks.code_verifier as string,
          redirect_uri: params.redirect_uri as string,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Vercel OAuth] Token exchange failed:', response.status, errorText)
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`)
      }

      const tokens = await response.json()
      console.log('[Vercel OAuth] Token exchange successful, received tokens:', {
        hasAccessToken: !!tokens.access_token,
        hasIdToken: !!tokens.id_token,
        hasRefreshToken: !!tokens.refresh_token,
        tokenType: tokens.token_type,
        scope: tokens.scope,
      })
      return { tokens }
    },
  },
  userinfo: {
    url: 'https://api.vercel.com/login/oauth/userinfo',
    async request({ tokens }) {
      // Vercel userinfo endpoint uses POST with Bearer token
      const response = await fetch('https://api.vercel.com/login/oauth/userinfo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Vercel OAuth] Userinfo fetch failed:', response.status, errorText)
        throw new Error(`Failed to fetch userinfo: ${response.status} ${errorText}`)
      }
      const profile = await response.json()
      console.log('[Vercel OAuth] Userinfo fetched successfully:', {
        sub: profile.sub,
        email: profile.email,
        name: profile.name,
        hasImage: !!profile.picture,
      })
      return profile
    },
  },
  profile(profile) {
    console.log('[Vercel OAuth] Mapping profile:', profile)
    return {
      id: profile.sub,
      email: profile.email,
      name: profile.name ?? profile.preferred_username ?? profile.email,
      image: profile.picture,
    }
  },
  // PKCE with S256 is REQUIRED by Vercel OAuth
  // state provides CSRF protection
  checks: ['pkce', 'state'],
  // Use client_secret_post to send credentials in request body
  client: {
    token_endpoint_auth_method: 'client_secret_post',
  },
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
      console.log('[Auth] signIn callback called:', {
        provider: account?.provider,
        userId: user?.id,
        userEmail: user?.email,
        accountType: account?.type,
      })

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
