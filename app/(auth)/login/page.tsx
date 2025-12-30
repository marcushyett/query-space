'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button, Form, Input, Divider, Alert, Typography } from 'antd'
import { TechSpinner } from '@/components/TechSpinner'
import { GithubOutlined, MailOutlined, LockOutlined } from '@ant-design/icons'
import Link from 'next/link'

// Vercel logo icon (no built-in antd icon available)
const VercelIcon = () => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 76 65"
    fill="currentColor"
    style={{ verticalAlign: '-0.125em' }}
  >
    <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
  </svg>
)

const { Title, Text } = Typography

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrlParam = searchParams.get('callbackUrl')
  const error = searchParams.get('error')

  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Get the full callback URL including origin for OAuth
  // This ensures users return to the correct domain (including preview branches)
  const getCallbackUrl = () => {
    if (callbackUrlParam) {
      // If it's already a full URL, use it
      if (callbackUrlParam.startsWith('http')) {
        return callbackUrlParam
      }
      // Otherwise, prepend the current origin
      return `${window.location.origin}${callbackUrlParam}`
    }
    // Default to the current origin's home page
    return window.location.origin
  }

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
        router.push(callbackUrlParam || '/')
      }
    } catch {
      setFormError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthLogin = (provider: string) => {
    signIn(provider, { callbackUrl: getCallbackUrl() })
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
              ? 'This email is already registered with a different sign-in method. Please use the original method.'
              : error === 'OAuthCallback'
              ? 'OAuth login failed. Please try again or use email/password.'
              : error === 'OAuthCallbackError'
              ? 'OAuth callback error. The provider may be misconfigured.'
              : error === 'Callback'
              ? 'Login callback failed. Please try again.'
              : error === 'OAuthSignin'
              ? 'Could not start OAuth sign-in. Please try again.'
              : error === 'OAuthCreateAccount'
              ? 'Could not create account. Please try email registration.'
              : error === 'AccessDenied'
              ? 'Access denied. You may not have permission to sign in.'
              : error === 'Configuration'
              ? 'Server configuration error. Please contact support.'
              : formError || 'Authentication failed. Please try again.'
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
          icon={<VercelIcon />}
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-form"><TechSpinner size="large" /></div>}>
      <LoginForm />
    </Suspense>
  )
}
