'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button, Form, Input, Divider, Alert, Typography } from 'antd'
import { GithubOutlined, MailOutlined, LockOutlined } from '@ant-design/icons'
import Link from 'next/link'

const { Title, Text } = Typography

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const error = searchParams.get('error')

  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleCredentialsLogin = async (values: {
    email: string
    password: string
  }) => {
    setLoading(true)
    setFormError(null)

    try {
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      })

      if (result?.error) {
        setFormError('Invalid email or password')
      } else {
        router.push(callbackUrl)
      }
    } catch {
      setFormError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthLogin = (provider: string) => {
    signIn(provider, { callbackUrl })
  }

  return (
    <div className="auth-form">
      <div className="auth-header">
        <Title level={2} style={{ margin: 0, color: '#fff' }}>
          Welcome back
        </Title>
        <Text type="secondary">Sign in to continue to Query Space</Text>
      </div>

      {(error || formError) && (
        <Alert
          type="error"
          message={
            error === 'OAuthAccountNotLinked'
              ? 'This email is already registered with a different provider'
              : formError || 'Authentication failed'
          }
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
        <Text type="secondary">or continue with email</Text>
      </Divider>

      <Form
        layout="vertical"
        onFinish={handleCredentialsLogin}
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

        <Form.Item
          name="password"
          rules={[{ required: true, message: 'Password is required' }]}
        >
          <Input.Password
            size="large"
            prefix={<LockOutlined />}
            placeholder="Password"
            autoComplete="current-password"
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
            Sign in
          </Button>
        </Form.Item>

        <div className="auth-links">
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
      </Form>

      <div className="auth-footer">
        <Text type="secondary">
          Don&apos;t have an account?{' '}
          <Link href="/register">Create one</Link>
        </Text>
      </div>
    </div>
  )
}
