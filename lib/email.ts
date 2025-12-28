import { Resend } from 'resend'

// Lazy-initialize Resend client to avoid build-time errors
let resend: Resend | null = null
function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

// Get the app URL based on environment
// Priority: NEXTAUTH_URL > VERCEL_PROJECT_PRODUCTION_URL > VERCEL_URL > localhost
function getAppUrl(): string {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

const FROM_EMAIL = process.env.EMAIL_FROM || 'Query Space <support@mail.queryspace.dev>'
const APP_NAME = 'Query Space'

interface SendEmailOptions {
  to: string
  subject: string
  text: string
}

async function sendEmail({ to, subject, text }: SendEmailOptions) {
  const client = getResendClient()
  if (!client) {
    console.warn('RESEND_API_KEY not set, skipping email send')
    console.log('Would have sent email:', { to, subject })
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      text,
    })

    if (error) {
      console.error('Failed to send email:', error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id }
  } catch (error) {
    console.error('Error sending email:', error)
    return { success: false, error: 'Failed to send email' }
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${getAppUrl()}/verify-email?token=${token}`

  const text = `Welcome to ${APP_NAME}!

Please verify your email address by clicking the link below:

${verifyUrl}

If you didn't sign up for ${APP_NAME}, you can safely ignore this email.

Thanks,
The ${APP_NAME} Team`

  return sendEmail({
    to: email,
    subject: `Verify your email for ${APP_NAME}`,
    text,
  })
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${getAppUrl()}/reset-password?token=${token}`

  const text = `Hi,

We received a request to reset your password for your ${APP_NAME} account.

Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

Thanks,
The ${APP_NAME} Team`

  return sendEmail({
    to: email,
    subject: `Reset your password for ${APP_NAME}`,
    text,
  })
}

export async function sendOrganizationInviteEmail(
  email: string,
  token: string,
  inviterName: string | null,
  organizationName: string | null
) {
  const inviteUrl = `${getAppUrl()}/invite/${token}`
  const orgDisplay = organizationName || 'an organization'
  const inviterDisplay = inviterName || 'Someone'

  const text = `Hi,

${inviterDisplay} has invited you to join ${orgDisplay} on ${APP_NAME}.

Click the link below to accept the invitation:

${inviteUrl}

This invitation will expire in 7 days. If you don't want to join, you can safely ignore this email.

Thanks,
The ${APP_NAME} Team`

  return sendEmail({
    to: email,
    subject: `${inviterDisplay} invited you to ${orgDisplay} on ${APP_NAME}`,
    text,
  })
}

export async function sendWelcomeEmail(email: string, name: string | null) {
  const appUrl = getAppUrl()

  const text = `Hi${name ? ` ${name}` : ''},

Welcome to ${APP_NAME}! Your account is now set up and ready to use.

With ${APP_NAME}, you can:
- Connect to your PostgreSQL databases
- Run queries with AI assistance
- Visualize your data with charts
- Create dashboards to track metrics

Get started: ${appUrl}

If you have any questions, feel free to reach out to our support team.

Thanks,
The ${APP_NAME} Team`

  return sendEmail({
    to: email,
    subject: `Welcome to ${APP_NAME}!`,
    text,
  })
}
