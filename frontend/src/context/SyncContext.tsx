import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';

type SyncStatus = 'idle' | 'running' | 'success' | 'error';

interface SyncContextType {
    syncStatus: SyncStatus;
    syncMessage: string;
    startedAt: Date | null;
    completedAt: Date | null;
    triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
    const [syncMessage, setSyncMessage] = useState('');
    const [startedAt, setStartedAt] = useState<Date | null>(null);
    const [completedAt, setCompletedAt] = useState<Date | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const cleanupPolling = () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    };

    const triggerSync = async () => {
        if (syncStatus === 'running') return;

        setSyncStatus('running');
        setSyncMessage('Starting sync...');
        setStartedAt(new Date());
        setCompletedAt(null);

        try {
            await api.post('/products/sync');
            setSyncMessage('Sync in progress...');
            startPolling();
        } catch (error: any) {
            console.error('Error starting sync:', error);
            setSyncStatus('error');
            setSyncMessage('Failed to start sync');
            toast.error('Failed to start sync');
        }
    };

    const startPolling = () => {
        cleanupPolling();
        pollingIntervalRef.current = setInterval(checkSyncStatus, 2000);
    };

    const checkSyncStatus = async () => {
        try {
            const response = await api.get('/products/sync/status');
            const job = response.data.job;

            if (job) {
                if (job.status === 'completed') {
                    setSyncStatus('success');
                    setSyncMessage('Sync completed successfully');
                    setCompletedAt(new Date());
                    cleanupPolling();
                    toast.success('Shopify sync completed successfully');

                    // Reset to idle after a delay to hide the top bar
                    setTimeout(() => {
                        setSyncStatus('idle');
                        setSyncMessage('');
                    }, 5000);
                } else if (job.status === 'failed') {
                    setSyncStatus('error');
                    setSyncMessage('Sync failed. Please retry.');
                    setCompletedAt(new Date());
                    cleanupPolling();
                    toast.error(`Shopify sync failed: ${job.error || 'Unknown error'}`);
                } else {
                    // Still running or pending
                    const processed = job.processedItems || 0;
                    const total = job.totalItems || '?';
                    setSyncMessage(`Sync in progress... (${processed}/${total})`);
                }
            }
        } catch (error) {
            console.error('Error checking sync status:', error);
            // Don't fail immediately on status check error, might be temporary
            // But if it persists, we should probably stop polling to avoid infinite loops if server is down
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return cleanupPolling;
    }, []);

    return (
        <SyncContext.Provider value={{ syncStatus, syncMessage, startedAt, completedAt, triggerSync }}>
            {children}
        </SyncContext.Provider>
    );
};

export const useSync = () => {
    const context = useContext(SyncContext);
    if (context === undefined) {
        throw new Error('useSync must be used within a SyncProvider');
    }
    return context;
};
