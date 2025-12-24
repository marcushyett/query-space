'use client';

import { ConfigProvider, App } from 'antd';
import { darkTheme } from '@/config/theme';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={darkTheme}>
      <App
        message={{
          duration: 3,
          maxCount: 3,
          top: 60,
        }}
        notification={{
          placement: 'topRight',
          duration: 3,
        }}
      >
        {children}
      </App>
    </ConfigProvider>
  );
}
