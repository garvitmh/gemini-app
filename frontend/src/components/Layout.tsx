import { ReactNode } from 'react';
import { Frame, Navigation } from '@shopify/polaris';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    HomeIcon,
    CashDollarIcon,
    ProductIcon,
    ClockIcon,
    SettingsIcon,
} from '@shopify/polaris-icons';

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
