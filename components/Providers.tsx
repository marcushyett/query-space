'use client';

import { ConfigProvider } from 'antd';
import { darkTheme } from '@/config/theme';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={darkTheme}>
      {children}
    </ConfigProvider>
  );
}
