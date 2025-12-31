'use client'

import { useState, useEffect, createContext, useContext, useLayoutEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { ConfigProvider, Dropdown, Avatar, message, Layout, Flex, Grid } from 'antd'
import { TechSpinner } from '@/components/TechSpinner'
import type { MenuProps } from 'antd'
import {
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  TeamOutlined,
  DownOutlined,
  PlusOutlined,
  AppstoreOutlined,
  FolderOutlined,
} from '@ant-design/icons'

const { useBreakpoint } = Grid
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
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  // Scroll to top when navigating to a new page
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

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
        <Layout style={{ height: '100vh', background: '#000', overflow: 'hidden' }}>
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
        <Layout style={{ height: '100vh', overflow: 'hidden' }}>
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
                    gap={4}
                    style={{
                      cursor: 'pointer',
                      padding: isMobile ? '4px 6px' : '2px 8px',
                      borderRadius: 4,
                      transition: 'background 0.15s',
                    }}
                    className="nav-icon-button"
                  >
                    <TeamOutlined style={{ fontSize: 14, color: '#888' }} />
                    {!isMobile && (
                      <>
                        <span style={{ color: '#ccc', fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {currentOrg?.name || 'Organization'}
                        </span>
                        <DownOutlined style={{ fontSize: 8, color: '#666' }} />
                      </>
                    )}
                  </Flex>
                </Dropdown>
              )}

              {/* Navigation Links */}
              {!isMobile && (
                <Flex align="center" gap={4} style={{ marginLeft: 8 }}>
                  <div
                    style={{
                      padding: '4px 12px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: pathname === '/' || pathname.startsWith('/projects') ? '#fff' : '#888',
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: pathname === '/' || pathname.startsWith('/projects') ? '#1a1a1a' : 'transparent',
                    }}
                    onClick={() => router.push('/')}
                    role="button"
                  >
                    <FolderOutlined style={{ fontSize: 14 }} />
                    Projects
                  </div>
                  <div
                    style={{
                      padding: '4px 12px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: pathname.startsWith('/dashboards') ? '#fff' : '#888',
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: pathname.startsWith('/dashboards') ? '#1a1a1a' : 'transparent',
                    }}
                    onClick={() => router.push('/dashboards')}
                    role="button"
                  >
                    <AppstoreOutlined style={{ fontSize: 14 }} />
                    Dashboards
                  </div>
                </Flex>
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
