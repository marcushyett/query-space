import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { sendPasswordResetEmail } from '@/lib/email'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = forgotPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { email } = parsed.data

    // Always return success to prevent email enumeration
    const successResponse = {
      message: 'If an account with that email exists, we sent a password reset link.',
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Return success even if user doesn't exist (security)
      return NextResponse.json(successResponse)
    }

    // Check if user signed up with OAuth (no password set)
    if (!user.password) {
      // Return success but don't send email - they should use OAuth
      return NextResponse.json(successResponse)
    }

    // Delete any existing reset tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: `reset:${email}`,
      },
    })

    // Create new reset token
    const resetToken = randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await prisma.verificationToken.create({
      data: {
        identifier: `reset:${email}`,
        token: resetToken,
        expires: tokenExpiry,
      },
    })

    // Send reset email
    await sendPasswordResetEmail(email, resetToken)

    return NextResponse.json(successResponse)
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
