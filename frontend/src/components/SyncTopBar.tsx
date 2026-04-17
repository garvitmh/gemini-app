import React from 'react';
import { Banner, ProgressBar } from '@shopify/polaris';
import { useSync } from '../context/SyncContext';

export const SyncTopBar: React.FC = () => {
    const { syncStatus, syncMessage } = useSync();

    if (syncStatus === 'idle') {
        return null;
    }

    const tone = syncStatus === 'error' ? 'critical' : syncStatus === 'success' ? 'success' : 'info';

    return (
        <div style={{ position: 'sticky', top: 0, zIndex: 500, marginBottom: '16px' }}>
            <Banner tone={tone}>
                <p>{syncMessage}</p>
                {syncStatus === 'running' && (
                    <div style={{ marginTop: '8px' }}>
                        <ProgressBar size="small" tone="highlight" />
                    </div>
                )}
            </Banner>
        </div>
    );
};
