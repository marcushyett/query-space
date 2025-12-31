'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Form, Input, Alert, Typography } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import Link from 'next/link'

const { Title, Text } = Typography

function ResetPasswordForm() {
  const _router = useRouter()
  void _router // Reserved for future navigation
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)

  if (!token) {
    return (
      <div className="auth-form">
        <Alert
          type="error"
          message="Invalid or missing reset token"
          description="Please request a new password reset link."
          showIcon
        />
        <div className="auth-footer" style={{ marginTop: 24 }}>
          <Link href="/forgot-password">
            <Button type="primary" size="large" block>
              Request new link
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (values: { password: string }) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: values.password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to reset password')
        return
      }

      setSuccess(true)
      setEmailVerified(data.emailVerified || false)
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="auth-form">
        <div className="auth-header">
          <Title level={2} style={{ margin: 0, color: '#fff' }}>
            {emailVerified ? 'Password reset & email verified!' : 'Password reset!'}
          </Title>
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
            {emailVerified
              ? 'Your password has been reset and your email has been verified. You can now sign in.'
              : 'Your password has been successfully reset. You can now sign in with your new password.'}
          </Text>
        </div>

        <div className="auth-footer" style={{ marginTop: 32 }}>
          <Link href="/login">
            <Button type="primary" size="large" block>
              Sign in
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-form">
      <div className="auth-header">
        <Title level={2} style={{ margin: 0, color: '#fff' }}>
          Reset your password
        </Title>
        <Text type="secondary">Enter your new password below</Text>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Form
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
      >
        <Form.Item
          name="password"
          rules={[
            { required: true, message: 'Password is required' },
            { min: 8, message: 'Password must be at least 8 characters' },
            {
              pattern: /[A-Z]/,
              message: 'Password must contain an uppercase letter',
            },
            {
              pattern: /[a-z]/,
              message: 'Password must contain a lowercase letter',
            },
            {
              pattern: /[0-9]/,
              message: 'Password must contain a number',
            },
          ]}
        >
          <Input.Password
            size="large"
            prefix={<LockOutlined />}
            placeholder="New password"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Please confirm your password' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error('Passwords do not match'))
              },
            }),
          ]}
        >
          <Input.Password
            size="large"
            prefix={<LockOutlined />}
            placeholder="Confirm new password"
            autoComplete="new-password"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 12 }}>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={loading}
            block
          >
            Reset password
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-form">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
