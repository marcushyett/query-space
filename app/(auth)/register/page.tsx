'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button, Form, Input, Divider, Alert, Typography } from 'antd'
import { GithubOutlined, MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons'
import Link from 'next/link'

const { Title, Text } = Typography

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleRegister = async (values: {
    name: string
    email: string
    password: string
  }) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create account')
        return
      }

      setSuccess(true)
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthLogin = (provider: string) => {
    signIn(provider, { callbackUrl: '/' })
  }

  if (success) {
    return (
      <div className="auth-form">
        <div className="auth-header">
          <Title level={2} style={{ margin: 0, color: '#fff' }}>
            Check your email
          </Title>
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
            We&apos;ve sent you a verification link. Please check your email to verify your account.
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
          Create an account
        </Title>
        <Text type="secondary">Get started with Query Space</Text>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <div className="oauth-buttons">
        <Button
          size="large"
          icon={<GithubOutlined />}
          onClick={() => handleOAuthLogin('github')}
          block
        >
          Continue with GitHub
        </Button>
        <Button
          size="large"
          onClick={() => handleOAuthLogin('vercel')}
          block
          style={{ marginTop: 12 }}
        >
          Continue with Vercel
        </Button>
      </div>

      <Divider plain>
        <Text type="secondary">or register with email</Text>
      </Divider>

      <Form
        layout="vertical"
        onFinish={handleRegister}
        requiredMark={false}
      >
        <Form.Item
          name="name"
          rules={[{ required: true, message: 'Name is required' }]}
        >
          <Input
            size="large"
            prefix={<UserOutlined />}
            placeholder="Full name"
            autoComplete="name"
          />
        </Form.Item>

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
            placeholder="Password"
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
            placeholder="Confirm password"
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
            Create account
          </Button>
        </Form.Item>
      </Form>

      <div className="auth-footer">
        <Text type="secondary">
          Already have an account?{' '}
          <Link href="/login">Sign in</Link>
        </Text>
      </div>
    </div>
  )
}
