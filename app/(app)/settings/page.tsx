'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  Typography,
  Form,
  Input,
  Button,
  Alert,
  Tag,
  Modal,
  Select,
  Avatar,
  Popconfirm,
  message,
} from 'antd'
import { TechSpinner } from '@/components/TechSpinner'
import {
  DatabaseOutlined,
  UserOutlined,
  TeamOutlined,
  PlusOutlined,
  DeleteOutlined,
  MailOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

interface Organization {
  id: string
  name: string | null
  role: 'ADMIN' | 'MEMBER'
  accessType: 'READ_ONLY' | 'READ_WRITE'
}

interface OrganizationSettings {
  name: string | null
  databaseUrlMasked: string | null
  hasDatabaseUrl: boolean
  hasClaudeApiKey: boolean
  claudeApiKeyMasked: string | null
}

interface Member {
  id: string
  userId: string
  name: string | null
  email: string
  image: string | null
  role: 'ADMIN' | 'MEMBER'
  accessType: 'READ_ONLY' | 'READ_WRITE'
  createdAt: string
}

interface Invite {
  id: string
  email: string
  role: 'ADMIN' | 'MEMBER'
  accessType: 'READ_ONLY' | 'READ_WRITE'
  createdAt: string
  expiresAt: string
  invitedBy: string
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [deletingConnection, setDeletingConnection] = useState(false)
  const [settings, setSettings] = useState<OrganizationSettings | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [orgName, setOrgName] = useState('')
  const [databaseUrl, setDatabaseUrl] = useState('')

  // Invite modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER')
  const [inviteAccessType, setInviteAccessType] = useState<'READ_ONLY' | 'READ_WRITE'>('READ_WRITE')
  const [inviting, setInviting] = useState(false)

  // Create organization modal
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [creatingOrg, setCreatingOrg] = useState(false)

  // Visibility toggles for sensitive data
  const [showDatabaseUrl, setShowDatabaseUrl] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get organizations
        const orgsRes = await fetch('/api/organizations')
        const orgsData = await orgsRes.json()

        setOrganizations(orgsData.organizations || [])

        if (!orgsData.organizations?.length) {
          setLoading(false)
          return
        }

        const org = orgsData.organizations[0]
        setOrganizationId(org.id)
        setIsAdmin(org.role === 'ADMIN')

        // Fetch settings
        const settingsRes = await fetch(`/api/organizations/${org.id}/settings`)
        const settingsData = await settingsRes.json()

        if (settingsRes.ok) {
          setSettings(settingsData.settings)
          setOrgName(settingsData.settings.name || '')
        }

        // Fetch members
        const membersRes = await fetch(`/api/organizations/${org.id}/members`)
        const membersData = await membersRes.json()
        if (membersRes.ok) {
          setMembers(membersData.members || [])
        }

        // Fetch invites if admin
        if (org.role === 'ADMIN') {
          const invitesRes = await fetch(`/api/organizations/${org.id}/invites`)
          const invitesData = await invitesRes.json()
          if (invitesRes.ok) {
            setInvites(invitesData.invites || [])
          }
        }
      } catch (err) {
        setError('Failed to load settings')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleSaveSettings = async () => {
    if (!organizationId) return

    setSaving(true)
    setError(null)

    try {
      const updates: Record<string, string | null> = {}

      if (orgName !== settings?.name) {
        updates.name = orgName || null
      }
      if (databaseUrl) {
        updates.databaseUrl = databaseUrl
      }

      if (Object.keys(updates).length === 0) {
        message.info('No changes to save')
        return
      }

      setTestingConnection(!!databaseUrl)

      const res = await fetch(`/api/organizations/${organizationId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      // Refresh settings
      const settingsRes = await fetch(`/api/organizations/${organizationId}/settings`)
      const settingsData = await settingsRes.json()
      if (settingsRes.ok) {
        setSettings(settingsData.settings)
      }

      // Clear sensitive fields
      setDatabaseUrl('')

      message.success(databaseUrl ? 'Database connection verified and saved' : 'Settings saved')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      setError(msg)
      message.error(msg)
    } finally {
      setSaving(false)
      setTestingConnection(false)
    }
  }

  const handleDeleteConnection = async () => {
    if (!organizationId) return

    setDeletingConnection(true)
    setError(null)

    try {
      const res = await fetch(`/api/organizations/${organizationId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseUrl: null }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete connection')
      }

      // Refresh settings
      const settingsRes = await fetch(`/api/organizations/${organizationId}/settings`)
      const settingsData = await settingsRes.json()
      if (settingsRes.ok) {
        setSettings(settingsData.settings)
      }

      message.success('Database connection removed')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete'
      setError(msg)
      message.error(msg)
    } finally {
      setDeletingConnection(false)
    }
  }

  const handleCreateOrganization = async () => {
    setCreatingOrg(true)
    setError(null)

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOrgName || null }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create organization')
      }

      const data = await res.json()

      // Refresh organizations list
      const orgsRes = await fetch('/api/organizations')
      const orgsData = await orgsRes.json()
      setOrganizations(orgsData.organizations || [])

      setCreateOrgModalOpen(false)
      setNewOrgName('')
      message.success('Organization created')

      // Switch to the new organization
      if (data.organization?.id) {
        setOrganizationId(data.organization.id)
        localStorage.setItem('currentOrganizationId', data.organization.id)
        window.location.reload()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create'
      setError(msg)
      message.error(msg)
    } finally {
      setCreatingOrg(false)
    }
  }

  const handleInvite = async () => {
    if (!organizationId || !inviteEmail) return

    setInviting(true)
    try {
      const res = await fetch(`/api/organizations/${organizationId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          accessType: inviteAccessType,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send invite')
      }

      // Refresh invites
      const invitesRes = await fetch(`/api/organizations/${organizationId}/invites`)
      const invitesData = await invitesRes.json()
      if (invitesRes.ok) {
        setInvites(invitesData.invites || [])
      }

      setInviteModalOpen(false)
      setInviteEmail('')
      message.success('Invite sent')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send invite'
      message.error(msg)
    } finally {
      setInviting(false)
    }
  }

  const handleCancelInvite = async (inviteId: string) => {
    if (!organizationId) return

    try {
      const res = await fetch(`/api/organizations/${organizationId}/invites?inviteId=${inviteId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to cancel invite')
      }

      setInvites(invites.filter((i) => i.id !== inviteId))
      message.success('Invite cancelled')
    } catch {
      message.error('Failed to cancel invite')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!organizationId) return

    try {
      const res = await fetch(`/api/organizations/${organizationId}/members?memberId=${memberId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove member')
      }

      setMembers(members.filter((m) => m.id !== memberId))
      message.success('Member removed')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove member'
      message.error(msg)
    }
  }

  if (loading) {
    return (
      <div className="loading-state-large">
        <TechSpinner size="large" />
      </div>
    )
  }

  if (!loading && organizations.length === 0) {
    return (
      <div className="settings-page">
        <Title level={2} style={{ color: '#fff', marginBottom: 24 }}>
          Settings
        </Title>
        <div className="empty-state-action">
          <div className="empty-state-icon">
            <TeamOutlined />
          </div>
          <div className="empty-state-title">No organization yet</div>
          <div className="empty-state-description">
            Create an organization to get started with Query Space
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOrgModalOpen(true)}
          >
            Create Organization
          </Button>
        </div>

        {/* Create Organization Modal */}
        <Modal
          title="Create Organization"
          open={createOrgModalOpen}
          onCancel={() => {
            setCreateOrgModalOpen(false)
            setNewOrgName('')
          }}
          onOk={handleCreateOrganization}
          okText="Create"
          confirmLoading={creatingOrg}
        >
          <Form layout="vertical">
            <Form.Item label="Organization Name (optional)">
              <Input
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="My Organization"
              />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    )
  }

  if (error && !settings) {
    return (
      <div className="settings-page">
        <Alert type="error" message={error} showIcon />
      </div>
    )
  }

  return (
    <div className="settings-page">
      <Title level={2} style={{ color: '#fff', marginBottom: 24 }}>
        Settings
      </Title>

      {error && (
        <Alert type="error" message={error} showIcon style={{ marginBottom: 24 }} closable onClose={() => setError(null)} />
      )}

      {/* Organization */}
      <div className="settings-section">
        <div className="settings-section-header">
          <h3 className="settings-section-title">
            <TeamOutlined style={{ marginRight: 8 }} />
            Organization
          </h3>
        </div>

        <div className="settings-field">
          <label className="settings-label">Organization Name (optional)</label>
          <Input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="My Organization"
            disabled={!isAdmin}
          />
          <p className="settings-hint">A name to identify your organization</p>
        </div>
      </div>

      {/* Database Connection */}
      <div className="settings-section">
        <div className="settings-section-header">
          <h3 className="settings-section-title">
            <DatabaseOutlined style={{ marginRight: 8 }} />
            Database Connection
          </h3>
          {settings?.hasDatabaseUrl && (
            <Tag color="green" icon={<CheckCircleOutlined />}>Connected</Tag>
          )}
        </div>

        <Alert
          type="info"
          message="PostgreSQL Only"
          description="We currently only support PostgreSQL databases. We recommend using a read-only connection string for security. The connection will be tested before saving."
          showIcon
          style={{ marginBottom: 16 }}
        />

        {settings?.hasDatabaseUrl && (
          <div className="settings-field">
            <label className="settings-label">Current Connection</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                value={showDatabaseUrl ? (settings.databaseUrlMasked || '') : '••••••••••••••••••••••••••••••••'}
                disabled
                style={{ flex: 1 }}
                suffix={
                  <Button
                    type="text"
                    size="small"
                    icon={showDatabaseUrl ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowDatabaseUrl(!showDatabaseUrl)}
                    style={{ marginRight: -8 }}
                  />
                }
              />
              {isAdmin && (
                <Popconfirm
                  title="Delete database connection?"
                  description="This will remove the connection. You can add it again later."
                  onConfirm={handleDeleteConnection}
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                  cancelText="Cancel"
                >
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={deletingConnection}
                  >
                    Delete
                  </Button>
                </Popconfirm>
              )}
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="settings-field">
            <label className="settings-label">
              {settings?.hasDatabaseUrl ? 'Update' : 'Add'} Connection String
            </label>
            <Input.Password
              id="database-url-input"
              value={databaseUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDatabaseUrl(e.target.value)}
              placeholder="postgresql://user:password@host:5432/database"
              autoComplete="off"
            />
            <p className="settings-hint">
              Your connection string is encrypted at rest. The connection will be validated when you save.
            </p>
          </div>
        )}
      </div>

      {/* Save Button */}
      {isAdmin && (
        <div style={{ marginBottom: 32 }}>
          <Button
            type="primary"
            loading={saving}
            onClick={handleSaveSettings}
            disabled={!databaseUrl && orgName === settings?.name}
          >
            {testingConnection ? 'Testing Connection...' : 'Save Settings'}
          </Button>
        </div>
      )}

      {/* Members */}
      <div className="settings-section">
        <div className="settings-section-header">
          <h3 className="settings-section-title">
            <UserOutlined style={{ marginRight: 8 }} />
            Team Members
          </h3>
          {isAdmin && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setInviteModalOpen(true)}
            >
              Invite
            </Button>
          )}
        </div>

        <div className="members-list">
          {members.map((member) => (
            <div key={member.id} className="member-item">
              <div className="member-info">
                <Avatar
                  src={member.image}
                  icon={!member.image && <UserOutlined />}
                  className="member-avatar"
                />
                <div className="member-details">
                  <span className="member-name">{member.name || member.email}</span>
                  <span className="member-email">{member.email}</span>
                </div>
              </div>
              <div className="member-actions">
                <Tag color={member.role === 'ADMIN' ? 'blue' : 'default'}>
                  {member.role}
                </Tag>
                <Tag color={member.accessType === 'READ_ONLY' ? 'orange' : 'green'}>
                  {member.accessType === 'READ_ONLY' ? 'Read Only' : 'Read/Write'}
                </Tag>
                {isAdmin && member.userId !== session?.user?.id && (
                  <Popconfirm
                    title="Remove this member?"
                    onConfirm={() => handleRemoveMember(member.id)}
                    okText="Remove"
                    cancelText="Cancel"
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                  </Popconfirm>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pending Invites */}
        {isAdmin && invites.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Pending Invites
            </Text>
            <div className="members-list">
              {invites.map((invite) => (
                <div key={invite.id} className="member-item">
                  <div className="member-info">
                    <Avatar icon={<MailOutlined />} className="member-avatar" />
                    <div className="member-details">
                      <span className="member-name">{invite.email}</span>
                      <span className="member-email">
                        Invited by {invite.invitedBy}
                      </span>
                    </div>
                  </div>
                  <div className="member-actions">
                    <Tag>{invite.role}</Tag>
                    <Popconfirm
                      title="Cancel this invite?"
                      onConfirm={() => handleCancelInvite(invite.id)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button type="text" danger size="small">
                        Cancel
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Organizations */}
      <div className="settings-section">
        <div className="settings-section-header">
          <h3 className="settings-section-title">
            <TeamOutlined style={{ marginRight: 8 }} />
            Organizations
          </h3>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOrgModalOpen(true)}
          >
            New Organization
          </Button>
        </div>

        <div className="members-list">
          {organizations.map((org) => (
            <div key={org.id} className="member-item">
              <div className="member-info">
                <Avatar
                  icon={<TeamOutlined />}
                  className="member-avatar"
                  style={{ backgroundColor: org.id === organizationId ? '#1890ff' : '#444' }}
                />
                <div className="member-details">
                  <span className="member-name">{org.name || 'My Organization'}</span>
                  <span className="member-email">
                    {org.role} • {org.accessType === 'READ_ONLY' ? 'Read Only' : 'Read/Write'}
                  </span>
                </div>
              </div>
              <div className="member-actions">
                {org.id === organizationId && (
                  <Tag color="blue">Current</Tag>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Modal */}
      <Modal
        title="Invite Team Member"
        open={inviteModalOpen}
        onCancel={() => setInviteModalOpen(false)}
        onOk={handleInvite}
        okText="Send Invite"
        confirmLoading={inviting}
      >
        <Form layout="vertical">
          <Form.Item label="Email Address" required>
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
            />
          </Form.Item>
          <Form.Item label="Role">
            <Select value={inviteRole} onChange={setInviteRole}>
              <Select.Option value="MEMBER">Member</Select.Option>
              <Select.Option value="ADMIN">Admin</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="Access Level">
            <Select value={inviteAccessType} onChange={setInviteAccessType}>
              <Select.Option value="READ_WRITE">Read & Write</Select.Option>
              <Select.Option value="READ_ONLY">Read Only</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Organization Modal */}
      <Modal
        title="Create Organization"
        open={createOrgModalOpen}
        onCancel={() => {
          setCreateOrgModalOpen(false)
          setNewOrgName('')
        }}
        onOk={handleCreateOrganization}
        okText="Create"
        confirmLoading={creatingOrg}
      >
        <Form layout="vertical">
          <Form.Item label="Organization Name (optional)">
            <Input
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="My Organization"
            />
            <p className="settings-hint" style={{ marginTop: 8 }}>
              Leave empty to use the default name &quot;My Organization&quot;
            </p>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
