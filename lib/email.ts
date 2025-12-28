import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@queryspace.app'
const APP_NAME = 'Query Space'
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set, skipping email send')
    console.log('Would have sent email:', { to, subject })
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text: text || subject,
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
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify your email</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000; color: #fff; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #0a0a0a; border: 1px solid #333; border-radius: 8px; padding: 40px;">
          <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600;">Verify your email</h1>
          <p style="margin: 0 0 24px; color: #888; line-height: 1.6;">
            Thanks for signing up for ${APP_NAME}! Click the button below to verify your email address.
          </p>
          <a href="${verifyUrl}" style="display: inline-block; background-color: #1890ff; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
            Verify Email
          </a>
          <p style="margin: 24px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
            If you didn't sign up for ${APP_NAME}, you can safely ignore this email.
          </p>
          <p style="margin: 16px 0 0; color: #666; font-size: 12px;">
            Or copy and paste this URL: ${verifyUrl}
          </p>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: email,
    subject: `Verify your email for ${APP_NAME}`,
    html,
  })
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset your password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000; color: #fff; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #0a0a0a; border: 1px solid #333; border-radius: 8px; padding: 40px;">
          <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600;">Reset your password</h1>
          <p style="margin: 0 0 24px; color: #888; line-height: 1.6;">
            We received a request to reset your password for your ${APP_NAME} account. Click the button below to create a new password.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background-color: #1890ff; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
            Reset Password
          </a>
          <p style="margin: 24px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
            This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>
          <p style="margin: 16px 0 0; color: #666; font-size: 12px;">
            Or copy and paste this URL: ${resetUrl}
          </p>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: email,
    subject: `Reset your password for ${APP_NAME}`,
    html,
  })
}

export async function sendOrganizationInviteEmail(
  email: string,
  token: string,
  inviterName: string | null,
  organizationName: string | null
) {
  const inviteUrl = `${APP_URL}/invite/${token}`
  const orgDisplay = organizationName || 'an organization'
  const inviterDisplay = inviterName || 'Someone'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You've been invited</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000; color: #fff; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #0a0a0a; border: 1px solid #333; border-radius: 8px; padding: 40px;">
          <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600;">You've been invited!</h1>
          <p style="margin: 0 0 24px; color: #888; line-height: 1.6;">
            ${inviterDisplay} has invited you to join ${orgDisplay} on ${APP_NAME}.
          </p>
          <a href="${inviteUrl}" style="display: inline-block; background-color: #1890ff; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
            Accept Invitation
          </a>
          <p style="margin: 24px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
            This invitation will expire in 7 days. If you don't want to join, you can safely ignore this email.
          </p>
          <p style="margin: 16px 0 0; color: #666; font-size: 12px;">
            Or copy and paste this URL: ${inviteUrl}
          </p>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: email,
    subject: `${inviterDisplay} invited you to ${orgDisplay} on ${APP_NAME}`,
    html,
  })
}

export async function sendWelcomeEmail(email: string, name: string | null) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${APP_NAME}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #000; color: #fff; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #0a0a0a; border: 1px solid #333; border-radius: 8px; padding: 40px;">
          <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600;">Welcome to ${APP_NAME}!</h1>
          <p style="margin: 0 0 24px; color: #888; line-height: 1.6;">
            Hi${name ? ` ${name}` : ''},<br><br>
            Your account is now set up and ready to use. With ${APP_NAME}, you can:
          </p>
          <ul style="margin: 0 0 24px; padding-left: 20px; color: #888; line-height: 1.8;">
            <li>Connect to your PostgreSQL databases</li>
            <li>Run queries with AI assistance</li>
            <li>Visualize your data with charts</li>
            <li>Create dashboards to track metrics</li>
          </ul>
          <a href="${APP_URL}" style="display: inline-block; background-color: #1890ff; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
            Get Started
          </a>
          <p style="margin: 24px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
            If you have any questions, feel free to reach out to our support team.
          </p>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: email,
    subject: `Welcome to ${APP_NAME}!`,
    html,
  })
}
