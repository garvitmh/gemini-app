import { useState, useEffect } from 'react';
import { Banner, ProgressBar, Text, InlineStack } from '@shopify/polaris';
import api from '../utils/api';

interface Job {
    id: string;
    jobType: string;
    status: string;
    totalItems: number | null;
    processedItems: number | null;
    failedItems: number | null;
    createdAt: string;
}

export default function BulkJobProgress() {
    const [activeJobs, setActiveJobs] = useState<Job[]>([]);

    useEffect(() => {
        // Poll for active jobs every 3 seconds
        const fetchActiveJobs = async () => {
            try {
                const response = await api.get('/bulk/active-jobs');
                setActiveJobs(response.data.jobs || []);
            } catch (error) {
                console.error('Error fetching active jobs:', error);
            }
        };

        fetchActiveJobs();
        const interval = setInterval(fetchActiveJobs, 3000);

        return () => clearInterval(interval);
    }, []);

    if (activeJobs.length === 0) {
        return null;
    }

    return (
        <div style={{ marginBottom: '1rem' }}>
            {activeJobs.map((job) => {
                const progress = job.totalItems && job.processedItems
                    ? (job.processedItems / job.totalItems) * 100
                    : 0;

                const remainingItems = (job.totalItems || 0) - (job.processedItems || 0);
                const estimatedMinutes = Math.ceil(remainingItems / 50 * 0.5 / 60); // 50 items/batch * 0.5s/batch

                return (
                    <Banner
                        key={job.id}
                        tone="info"
                        title="Bulk price update in progress"
                    >
                        <InlineStack gap="200" blockAlign="center">
                            <Text as="p">
                                Processing: {job.processedItems || 0} / {job.totalItems || 0} products
                                {job.failedItems ? ` (${job.failedItems} failed)` : ''}
                            </Text>
                            {estimatedMinutes > 0 && (
                                <Text as="p" tone="subdued">
                                    Est. {estimatedMinutes} min remaining
                                </Text>
                            )}
                        </InlineStack>
                        <div style={{ marginTop: '0.5rem' }}>
                            <ProgressBar progress={progress} size="small" />
                        </div>
                    </Banner>
                );
            })}
        </div>
    );
}
