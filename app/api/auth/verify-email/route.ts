import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { sendWelcomeEmail } from '@/lib/email'

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = verifyEmailSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { token } = parsed.data

    // Find the token
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token,
        identifier: { not: { startsWith: 'reset:' } }, // Exclude password reset tokens
        expires: { gt: new Date() },
      },
    })

    if (!verificationToken) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token. Please request a new verification email.' },
        { status: 400 }
      )
    }

    const email = verificationToken.identifier

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (user.emailVerified) {
      // Already verified, just delete the token
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token,
          },
        },
      })

      return NextResponse.json({
        message: 'Email already verified.',
      })
    }

    // Update user and delete token in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token,
          },
        },
      }),
    ])

    // Send welcome email
    await sendWelcomeEmail(email, user.name)

    return NextResponse.json({
      message: 'Email verified successfully. Welcome to Query Space!',
    })
  } catch (error) {
    console.error('Verify email error:', error)
    return NextResponse.json(
      { error: 'Failed to verify email. Please try again.' },
      { status: 500 }
    )
  }
}
