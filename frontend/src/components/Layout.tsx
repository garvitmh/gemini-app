import { ReactNode } from 'react';
import { Frame, Navigation } from '@shopify/polaris';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    HomeIcon,
    CashDollarIcon,
    ProductIcon,
    ClockIcon,
    SettingsIcon,
    CollectionIcon,
} from '@shopify/polaris-icons';
import { SyncStatusIndicator } from './SyncStatusIndicator';

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const navigationItems = [
        {
            label: 'Dashboard',
            icon: HomeIcon,
            url: '/',
            selected: location.pathname === '/',
            onClick: () => navigate('/'),
        },
        {
            label: 'Rates',
            icon: CashDollarIcon,
            url: '/rates',
            selected: location.pathname === '/rates',
            onClick: () => navigate('/rates'),
        },
        {
            label: 'Making Groups',
            icon: CollectionIcon,
            url: '/making-groups',
            selected: location.pathname === '/making-groups',
            onClick: () => navigate('/making-groups'),
        },
        {
            label: 'Products',
            icon: ProductIcon,
            url: '/products',
            selected: location.pathname === '/products',
            onClick: () => navigate('/products'),
        },
        {
            label: 'History',
            icon: ClockIcon,
            url: '/history',
            selected: location.pathname === '/history',
            onClick: () => navigate('/history'),
        },
        {
            label: 'Settings',
            icon: SettingsIcon,
            url: '/settings',
            selected: location.pathname === '/settings',
            onClick: () => navigate('/settings'),
        },
    ];

    return (
        <Frame
            topBar={
                <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', height: '56px', background: '#fff', borderBottom: '1px solid #dfe3e8' }}>
                    <div style={{ marginRight: '16px' }}>
                        <SyncStatusIndicator />
                    </div>
                </div>
            }
            navigation={
                <Navigation location="/">
                    <Navigation.Section items={navigationItems} />
                </Navigation>
            }
        >
            {children}
        </Frame>
    );
}
