import { useEffect, useState, useRef } from 'react';
import { Spinner, Badge, Tooltip, Icon, Text, InlineStack } from '@shopify/polaris';
import { AlertCircleIcon, CheckCircleIcon } from '@shopify/polaris-icons';
import api from '../utils/api';

interface SyncCounts {
    fetched: number;
    created: number;
    updated: number;
    deleted: number;
    unchanged: number;
}

interface SyncJob {
    id: string;
    status: 'processing' | 'completed' | 'failed';
    createdAt: string;
    completedAt?: string;
    error?: string;
    result?: string; // JSON string of counts
}

export const SyncStatusIndicator = () => {
    const [job, setJob] = useState<SyncJob | null>(null);
    const [counts, setCounts] = useState<SyncCounts | null>(null);
    const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    const fetchStatus = async () => {
        try {
            const response = await api.get('/sync/status');
            if (response.data?.job) {
                const fetchedJob = response.data.job;
                setJob(fetchedJob);

                if (fetchedJob.result) {
                    try {
                        const parsed = JSON.parse(fetchedJob.result);
                        if (parsed.counts) setCounts(parsed.counts);
                    } catch (e) {
                        console.error("Error parsing sync result", e);
                    }
                }

                // Logic to show/hide based on status/time
                if (fetchedJob.status === 'processing') {
                    setIsVisible(true);
                } else if (fetchedJob.status === 'completed') {
                    // Show for 15 seconds after completion
                    const completedTime = new Date(fetchedJob.completedAt!).getTime();
                    const now = new Date().getTime();
                    if (now - completedTime < 15000) {
                        setIsVisible(true);
                    } else {
                        setIsVisible(false);
                    }
                } else if (fetchedJob.status === 'failed') {
                    // Show for 30 seconds after failure
                    const completedTime = new Date(fetchedJob.completedAt || fetchedJob.createdAt).getTime();
                    const now = new Date().getTime();
                    if (now - completedTime < 30000) {
                        setIsVisible(true);
                    } else {
                        setIsVisible(false);
                    }
                }
            } else {
                setIsVisible(false);
            }
        } catch (error) {
            console.error('Failed to fetch sync status', error);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchStatus();

        // Start polling
        pollInterval.current = setInterval(fetchStatus, 2000);

        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, []);

    if (!isVisible || !job) return null;

    if (job.status === 'processing') {
        return (
            <InlineStack gap="200" align="center" blockAlign="center">
                <Spinner size="small" />
                <Text as="span" variant="bodySm" tone="subdued">
                    Syncing... {counts ? `(${counts.fetched} checked)` : ''}
                </Text>
            </InlineStack>
        );
    }

    if (job.status === 'completed') {
        return (
            <Tooltip content={
                <div>
                    <div>Fetched: {counts?.fetched || 0}</div>
                    <div>Created: {counts?.created || 0}</div>
                    <div>Updated: {counts?.updated || 0}</div>
                    <div>Deleted: {counts?.deleted || 0}</div>
                    <div>Unchanged: {counts?.unchanged || 0}</div>
                </div>
            }>
                <InlineStack gap="200" align="center" blockAlign="center">
                    <Icon source={CheckCircleIcon} tone="success" />
                    <Text as="span" variant="bodySm" tone="success">
                        Sync Complete
                    </Text>
                    {counts && (
                        <Badge tone="success">
                            {`+${counts.created} / ~${counts.updated}`}
                        </Badge>
                    )}
                </InlineStack>
            </Tooltip>
        );
    }

    if (job.status === 'failed') {
        return (
            <Tooltip content={job.error || "Unknown error"}>
                <InlineStack gap="200" align="center" blockAlign="center">
                    <Icon source={AlertCircleIcon} tone="critical" />
                    <Text as="span" variant="bodySm" tone="critical">
                        Sync Failed
                    </Text>
                </InlineStack>
            </Tooltip>
        );
    }

    return null;
};
