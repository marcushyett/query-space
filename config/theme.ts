import type { ThemeConfig } from 'antd';

export const darkTheme: ThemeConfig = {
  token: {
    colorBgBase: '#000000',        // Pure black background
    colorTextBase: '#ffffff',      // White text
    colorPrimary: '#1890ff',       // Blue accent
    colorBgContainer: '#0a0a0a',   // Slightly lighter black for containers
    colorBorder: '#333333',        // Dark border
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 14,
    borderRadius: 4,
  },
  components: {
    Table: {
      colorBgContainer: '#000000',
      colorText: '#ffffff',
      colorTextHeading: '#ffffff',
      headerBg: '#0a0a0a',
      borderColor: '#333333',
    },
    Tree: {
      colorBgContainer: '#000000',
      colorText: '#ffffff',
    },
    Input: {
      colorBgContainer: '#0a0a0a',
      colorText: '#ffffff',
      colorBorder: '#333333',
    },
    Button: {
      defaultBg: '#0a0a0a',
      defaultBorderColor: '#333333',
      defaultColor: '#ffffff',
    },
    Modal: {
      contentBg: '#000000',
      headerBg: '#000000',
    },
    Drawer: {
      colorBgElevated: '#000000',
    },
    Select: {
      colorBgContainer: '#0a0a0a',
      colorText: '#ffffff',
      colorBorder: '#333333',
    },
  },
};
