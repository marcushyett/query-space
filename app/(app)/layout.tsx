'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { ConfigProvider, Dropdown, Avatar, Spin, message } from 'antd'
import type { MenuProps } from 'antd'
import {
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  TeamOutlined,
  DownOutlined,
  FolderOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { darkTheme } from '@/config/theme'
import { useConnectionStore } from '@/stores/connectionStore'

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
        <div className="app-shell">
          <div className="loading-state-large">
            <Spin size="large" />
          </div>
        </div>
      </ConfigProvider>
    )
  }

  return (
    <ConfigProvider theme={darkTheme}>
      <OrganizationContext.Provider
        value={{ currentOrg, organizations, switchOrganization, loading }}
      >
        <div className="app-shell">
          {/* Navigation Bar */}
          <nav className="app-nav">
            <div className="app-nav-left">
              {/* Logo/Title */}
              <span
                style={{ fontWeight: 600, fontSize: 16, cursor: 'pointer' }}
                onClick={() => router.push('/')}
              >
                Query Space
              </span>

              {/* Organization Selector */}
              {organizations.length > 0 && (
                <Dropdown menu={{ items: orgMenuItems }} trigger={['click']}>
                  <div className="org-selector">
                    <div className="org-selector-icon">
                      <TeamOutlined style={{ fontSize: 12, color: '#fff' }} />
                    </div>
                    <span className="org-selector-name">
                      {currentOrg?.name || 'My Organization'}
                    </span>
                    <DownOutlined style={{ fontSize: 10, color: '#666' }} />
                  </div>
                </Dropdown>
              )}
            </div>

            <div className="app-nav-right">
              {/* Settings Link */}
              <button
                className="nav-icon-button"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '8px',
                  cursor: 'pointer',
                  color: pathname === '/settings' ? '#fff' : '#888',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 44,
                  minHeight: 44,
                  borderRadius: 6,
                }}
                onClick={() => router.push('/settings')}
                aria-label="Settings"
              >
                <SettingOutlined style={{ fontSize: 18 }} />
              </button>

              {/* User Menu */}
              <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
                <div className="user-menu-trigger">
                  <Avatar
                    src={session?.user?.image}
                    icon={!session?.user?.image && <UserOutlined />}
                    size={28}
                    className="user-avatar"
                  />
                </div>
              </Dropdown>
            </div>
          </nav>

          {/* Main Content */}
          <main className="app-body">{children}</main>
        </div>
      </OrganizationContext.Provider>
    </ConfigProvider>
  )
}
