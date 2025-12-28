'use client'

import { useState } from 'react'
import { Button, Form, Input, Alert, Typography } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import Link from 'next/link'

const { Title, Text } = Typography

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (values: { email: string }) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send reset email')
        return
      }

      setSuccess(true)
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
            Check your email
          </Title>
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
            If an account exists with that email, we&apos;ve sent a password reset link.
          </Text>
        </div>

        <div className="auth-footer" style={{ marginTop: 32 }}>
          <Link href="/login">
            <Button type="primary" size="large" block>
              Back to sign in
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
          Forgot password?
        </Title>
        <Text type="secondary">
          Enter your email and we&apos;ll send you a reset link
        </Text>
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
          name="email"
          rules={[
            { required: true, message: 'Email is required' },
            { type: 'email', message: 'Invalid email address' },
          ]}
        >
          <Input
            size="large"
            prefix={<MailOutlined />}
            placeholder="Email address"
            autoComplete="email"
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
            Send reset link
          </Button>
        </Form.Item>
      </Form>

      <div className="auth-footer">
        <Link href="/login">Back to sign in</Link>
      </div>
    </div>
  )
}
