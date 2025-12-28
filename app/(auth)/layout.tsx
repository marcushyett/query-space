'use client'

import { ConfigProvider } from 'antd'
import { darkTheme } from '@/config/theme'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConfigProvider theme={darkTheme}>
      <div className="auth-layout">
        <div className="auth-container">
          {children}
        </div>
      </div>
    </ConfigProvider>
  )
}
