'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button, Card, Typography, Spin, Alert } from 'antd'
import { TeamOutlined, CheckCircleOutlined } from '@ant-design/icons'
import Link from 'next/link'

const { Title, Text } = Typography

interface InviteDetails {
  email: string
  role: string
  accessType: string
  organization: {
    id: string
    name: string | null
  }
  invitedBy: string
  expiresAt: string
}

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()
  const { data: session, status } = useSession()

  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const response = await fetch(`/api/invites/${token}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to load invite')
          return
        }

        setInvite(data.invite)
      } catch {
        setError('Failed to load invite details')
      } finally {
        setLoading(false)
      }
    }

    fetchInvite()
  }, [token])

  const handleAccept = async () => {
    setAccepting(true)
    setError(null)

    try {
      const response = await fetch(`/api/invites/${token}`, {
        method: 'POST',
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to accept invite')
        return
      }

      setSuccess(true)
      // Redirect to the app after 2 seconds
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch {
      setError('Failed to accept invite')
    } finally {
      setAccepting(false)
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="auth-layout">
        <div className="auth-container">
          <Card style={{ textAlign: 'center', background: '#0a0a0a', border: '1px solid #333' }}>
            <Spin size="large" />
            <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
              Loading invite...
            </Text>
          </Card>
        </div>
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="auth-layout">
        <div className="auth-container">
          <Card style={{ background: '#0a0a0a', border: '1px solid #333' }}>
            <Alert
              type="error"
              message="Invite Error"
              description={error}
              showIcon
              style={{ marginBottom: 24 }}
            />
            <Link href="/login">
              <Button type="primary" block>
                Go to Login
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="auth-layout">
        <div className="auth-container">
          <Card style={{ textAlign: 'center', background: '#0a0a0a', border: '1px solid #333' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
            <Title level={3} style={{ color: '#fff', marginBottom: 8 }}>
              Welcome!
            </Title>
            <Text type="secondary">
              You&apos;ve joined {invite?.organization.name || 'the organization'}.
              Redirecting...
            </Text>
          </Card>
        </div>
      </div>
    )
  }

  if (!invite) return null

  // User needs to log in first
  if (!session) {
    return (
      <div className="auth-layout">
        <div className="auth-container">
          <Card style={{ background: '#0a0a0a', border: '1px solid #333' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <TeamOutlined style={{ fontSize: 28, color: '#fff' }} />
              </div>
              <Title level={3} style={{ color: '#fff', marginBottom: 8 }}>
                You&apos;ve been invited!
              </Title>
              <Text type="secondary">
                {invite.invitedBy} has invited you to join{' '}
                <strong>{invite.organization.name || 'their organization'}</strong>
              </Text>
            </div>

            <Alert
              message="Sign in to continue"
              description={`Please sign in with ${invite.email} to accept this invite.`}
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Link href={`/login?callbackUrl=/invite/${token}`}>
              <Button type="primary" size="large" block>
                Sign in to Accept
              </Button>
            </Link>
            <Link href={`/register?callbackUrl=/invite/${token}`}>
              <Button size="large" block style={{ marginTop: 12 }}>
                Create Account
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    )
  }

  // Check if email matches
  const emailMatches = session.user?.email?.toLowerCase() === invite.email.toLowerCase()

  return (
    <div className="auth-layout">
      <div className="auth-container">
        <Card style={{ background: '#0a0a0a', border: '1px solid #333' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <TeamOutlined style={{ fontSize: 28, color: '#fff' }} />
            </div>
            <Title level={3} style={{ color: '#fff', marginBottom: 8 }}>
              Join {invite.organization.name || 'Organization'}
            </Title>
            <Text type="secondary">
              {invite.invitedBy} has invited you as a{' '}
              <strong>{invite.role === 'ADMIN' ? 'Admin' : 'Member'}</strong>
              {invite.accessType === 'READ_ONLY' && ' (Read Only)'}
            </Text>
          </div>

          {error && (
            <Alert
              type="error"
              message={error}
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {!emailMatches && (
            <Alert
              type="warning"
              message="Email mismatch"
              description={`This invite was sent to ${invite.email}. You're signed in as ${session.user?.email}.`}
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <div style={{
            background: '#0d0d0d',
            border: '1px solid #1a1a1a',
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
          }}>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Organization</Text>
              <div style={{ color: '#fff' }}>{invite.organization.name || 'Unnamed'}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Role</Text>
              <div style={{ color: '#fff' }}>{invite.role === 'ADMIN' ? 'Administrator' : 'Member'}</div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Access</Text>
              <div style={{ color: '#fff' }}>
                {invite.accessType === 'READ_WRITE' ? 'Read & Write' : 'Read Only'}
              </div>
            </div>
          </div>

          <Button
            type="primary"
            size="large"
            block
            loading={accepting}
            onClick={handleAccept}
            disabled={!emailMatches}
          >
            Accept Invitation
          </Button>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/">
              <Text type="secondary" style={{ cursor: 'pointer' }}>
                Decline and go back
              </Text>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
