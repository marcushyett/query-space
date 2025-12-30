'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { ConfigProvider, Dropdown, Avatar, message, Layout, Flex } from 'antd'
import { TechSpinner } from '@/components/TechSpinner'
import type { MenuProps } from 'antd'
import {
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  TeamOutlined,
  DownOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { darkTheme } from '@/config/theme'
import { useConnectionStore } from '@/stores/connectionStore'

const { Header, Content } = Layout

interface Organization {
  id: string
  name: string | null
  role: 'ADMIN' | 'MEMBER'
  accessType: 'READ_ONLY' | 'READ_WRITE'
}

interface OrganizationContextValue {
  currentOrg: Organization | null
  organizations: Organization[]
  switchOrganization: (orgId: string) => void
  loading: boolean
}

const OrganizationContext = createContext<OrganizationContextValue>({
  currentOrg: null,
  organizations: [],
  switchOrganization: () => {},
  loading: true,
})

export const useOrganization = () => useContext(OrganizationContext)

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { setOrganizationId, setConnectionString, clearConnection } = useConnectionStore()

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  // Initialize connection store when organization changes
  useEffect(() => {
    const initializeConnection = async (org: Organization) => {
      // Set organization ID in the connection store
      setOrganizationId(org.id)

      // Fetch settings to check if database is configured
      try {
        const settingsRes = await fetch(`/api/organizations/${org.id}/settings`)
        const settingsData = await settingsRes.json()

        if (settingsRes.ok && settingsData.settings?.hasDatabaseUrl) {
          // Mark as connected - the actual connection string is used server-side
          setConnectionString('configured-in-org-settings')
        }
      } catch (err) {
        console.error('Failed to fetch organization settings:', err)
      }
    }

    if (currentOrg) {
      initializeConnection(currentOrg)
    } else {
      clearConnection()
    }
  }, [currentOrg, setOrganizationId, setConnectionString, clearConnection])

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const res = await fetch('/api/organizations')
        const data = await res.json()

        if (data.organizations?.length) {
          setOrganizations(data.organizations)

          // Check localStorage for previously selected org
          const savedOrgId = localStorage.getItem('currentOrganizationId')
          const savedOrg = data.organizations.find((o: Organization) => o.id === savedOrgId)

          if (savedOrg) {
            setCurrentOrg(savedOrg)
          } else {
            setCurrentOrg(data.organizations[0])
            localStorage.setItem('currentOrganizationId', data.organizations[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to fetch organizations:', err)
        message.error('Failed to load organizations')
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated') {
      fetchOrganizations()
    }
  }, [status])

  const switchOrganization = (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId)
    if (org) {
      // Clear existing connection before switching
      clearConnection()
      setCurrentOrg(org)
      localStorage.setItem('currentOrganizationId', orgId)
      // Reload to refresh data for new org
      router.refresh()
    }
  }

  const handleSignOut = () => {
    localStorage.removeItem('currentOrganizationId')
    signOut({ callbackUrl: '/login' })
  }

  const orgMenuItems: MenuProps['items'] = [
    ...organizations.map((org) => ({
      key: org.id,
      label: org.name || 'My Organization',
      icon: <TeamOutlined />,
      onClick: () => switchOrganization(org.id),
    })),
    { type: 'divider' as const },
    {
      key: 'new',
      label: 'Create Organization',
      icon: <PlusOutlined />,
      onClick: () => router.push('/settings'),
    },
  ]

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'settings',
      label: 'Settings',
      icon: <SettingOutlined />,
      onClick: () => router.push('/settings'),
    },
    { type: 'divider' as const },
    {
      key: 'signout',
      label: 'Sign Out',
      icon: <LogoutOutlined />,
      onClick: handleSignOut,
    },
  ]

  if (status === 'loading' || loading) {
    return (
      <ConfigProvider theme={darkTheme}>
        <Layout style={{ minHeight: '100vh', background: '#000' }}>
          <Flex justify="center" align="center" style={{ flex: 1 }}>
            <TechSpinner size="large" />
          </Flex>
        </Layout>
      </ConfigProvider>
    )
  }

  return (
    <ConfigProvider theme={darkTheme}>
      <OrganizationContext.Provider
        value={{ currentOrg, organizations, switchOrganization, loading }}
      >
        <Layout style={{ minHeight: '100vh' }}>
          {/* Navigation Bar - Ant Design Header with sticky positioning */}
          <Header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              height: 48,
              lineHeight: '48px',
              background: '#0a0a0a',
              borderBottom: '1px solid #222',
            }}
          >
            <Flex align="center" gap={16}>
              {/* Logo/Title */}
              <Flex
                align="center"
                gap={8}
                style={{ cursor: 'pointer', fontSize: 16 }}
                onClick={() => router.push('/')}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: '#000',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-jetbrains-mono), monospace',
                    fontWeight: 700,
                    fontSize: 16,
                    color: '#fff',
                  }}
                >
                  Q
                </div>
                <span>
                  <span style={{ fontWeight: 700 }}>Query</span>
                  <span style={{ fontWeight: 400 }}>space</span>
                </span>
              </Flex>

              {/* Organization Selector */}
              {organizations.length > 0 && (
                <Dropdown menu={{ items: orgMenuItems }} trigger={['click']}>
                  <Flex
                    align="center"
                    gap={8}
                    style={{
                      cursor: 'pointer',
                      padding: '4px 12px',
                      borderRadius: 6,
                      background: '#1a1a1a',
                      border: '1px solid #333',
                    }}
                  >
                    <TeamOutlined style={{ fontSize: 12, color: '#fff' }} />
                    <span style={{ color: '#fff', fontSize: 13 }}>
                      {currentOrg?.name || 'My Organization'}
                    </span>
                    <DownOutlined style={{ fontSize: 10, color: '#666' }} />
                  </Flex>
                </Dropdown>
              )}
            </Flex>

            <Flex align="center" gap={12}>
              {/* Settings Link */}
              <div
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px',
                  cursor: 'pointer',
                  color: pathname === '/settings' ? '#fff' : '#888',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                }}
                onClick={() => router.push('/settings')}
                role="button"
                aria-label="Settings"
              >
                <SettingOutlined style={{ fontSize: 18 }} />
              </div>

              {/* User Menu */}
              <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
                <div style={{ cursor: 'pointer' }}>
                  <Avatar
                    src={session?.user?.image}
                    icon={!session?.user?.image && <UserOutlined />}
                    size={28}
                  />
                </div>
              </Dropdown>
            </Flex>
          </Header>

          {/* Main Content */}
          <Content style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {children}
          </Content>
        </Layout>
      </OrganizationContext.Provider>
    </ConfigProvider>
  )
}
