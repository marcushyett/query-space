'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button, Alert, Typography, Spin } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import Link from 'next/link'

const { Title, Text } = Typography

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError('Missing verification token')
      return
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to verify email')
        } else {
          setSuccess(true)
        }
      } catch {
        setError('An error occurred. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    verifyEmail()
  }, [token])

  if (loading) {
    return (
      <div className="auth-form" style={{ textAlign: 'center' }}>
        <Spin size="large" />
        <Text type="secondary" style={{ display: 'block', marginTop: 24 }}>
          Verifying your email...
        </Text>
      </div>
    )
  }

  if (success) {
    return (
      <div className="auth-form" style={{ textAlign: 'center' }}>
        <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
        <Title level={2} style={{ margin: '24px 0 8px', color: '#fff' }}>
          Email verified!
        </Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 32 }}>
          Your email has been successfully verified. You can now sign in to your account.
        </Text>
        <Link href="/login">
          <Button type="primary" size="large" block>
            Sign in
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="auth-form" style={{ textAlign: 'center' }}>
      <CloseCircleOutlined style={{ fontSize: 64, color: '#ff4d4f' }} />
      <Title level={2} style={{ margin: '24px 0 8px', color: '#fff' }}>
        Verification failed
      </Title>
      <Alert
        type="error"
        message={error || 'Failed to verify email'}
        showIcon
        style={{ marginBottom: 24, textAlign: 'left' }}
      />
      <Text type="secondary" style={{ display: 'block', marginBottom: 32 }}>
        The verification link may have expired. Please try signing in or request a new verification email.
      </Text>
      <Link href="/login">
        <Button type="primary" size="large" block>
          Back to sign in
        </Button>
      </Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-form" style={{ textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
