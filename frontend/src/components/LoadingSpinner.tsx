import { Spinner } from '@shopify/polaris';

interface LoadingSpinnerProps {
    size?: 'small' | 'large';
    overlay?: boolean;
}

export default function LoadingSpinner({ size = 'large', overlay = false }: LoadingSpinnerProps) {
    if (overlay) {
        return (
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }}
            >
                <Spinner accessibilityLabel="Loading" size={size} />
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Spinner accessibilityLabel="Loading" size={size} />
        </div>
    );
}
