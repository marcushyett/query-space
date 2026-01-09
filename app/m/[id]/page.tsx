'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Typography, Alert, ConfigProvider, theme } from 'antd';
import { TechSpinner } from '@/components/TechSpinner';
import { DashboardGrid } from '@/components/dashboard';
import { useDashboardStore, Dashboard } from '@/stores/dashboardStore';

const { Title, Text } = Typography;

interface PublicData {
  type: 'dashboard' | 'query';
  data: Dashboard;
}

export default function PublicViewPage() {
  const params = useParams();
  const shortId = params.id as string;

  const { setDashboard, clearWidgetData } = useDashboardStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publicData, setPublicData] = useState<PublicData | null>(null);

  // Fetch public data
  useEffect(() => {
    const fetchPublicData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/public/${shortId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError('This link does not exist or has been removed.');
            return;
          }
          if (response.status === 410) {
            setError('This link has expired.');
            return;
          }
          throw new Error('Failed to load content');
        }

        const data: PublicData = await response.json();
        setPublicData(data);

        // If it's a dashboard, set it in the store for DashboardGrid
        if (data.type === 'dashboard') {
          setDashboard(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch public content:', err);
        setError('Failed to load content. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPublicData();

    // Cleanup on unmount
    return () => {
      setDashboard(null);
      clearWidgetData();
    };
  }, [shortId, setDashboard, clearWidgetData]);

  // Wrap in ConfigProvider for dark theme
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0a',
        }}
      >
        {isLoading ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TechSpinner size="large" />
          </div>
        ) : error ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <Alert
              message="Unable to Load"
              description={error}
              type="error"
              showIcon
              style={{ maxWidth: 400 }}
            />
          </div>
        ) : publicData?.type === 'dashboard' ? (
          <>
            {/* Simple header for public view */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #222',
                background: '#111',
              }}
            >
              <Title level={4} style={{ margin: 0, color: '#fff' }}>
                {publicData.data.title}
              </Title>
              {publicData.data.description && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {publicData.data.description}
                </Text>
              )}
            </div>
            {/* Dashboard content - read-only */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              <DashboardGrid readOnly />
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <Alert
              message="Content Type Not Supported"
              description="This type of shared content is not yet supported in the public viewer."
              type="info"
              showIcon
              style={{ maxWidth: 400 }}
            />
          </div>
        )}
      </div>
    </ConfigProvider>
  );
}
