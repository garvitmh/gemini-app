import { useState, useEffect } from 'react';
import {
    Page,
    Layout,
    Card,
    Text,
    BlockStack,
    InlineStack,
    Badge,
    Banner,
} from '@shopify/polaris';
import { format } from 'date-fns';
import api from '../utils/api';
import { formatCurrency } from '../utils/formatCurrency';
import LoadingSpinner from '../components/LoadingSpinner';

interface MetalRate {
    id: string;
    metal: string;
    karat?: number;
    ratePerGram: number;
    ratePer10g: number;
    change24h: number;
    updatedAt: string;
}

interface EnamelRate {
    id: string;
    enamelColor: string;
    ratePerGram: number;
    updatedAt: string;
}

export default function Dashboard() {
    const [metalRates, setMetalRates] = useState<MetalRate[]>([]);
    const [enamelRates, setEnamelRates] = useState<EnamelRate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchRates();
    }, []);

    const fetchRates = async () => {
        setError(null);
        try {
            const response = await api.get('/rates');
            setMetalRates(response.data.metalRates || []);
            setEnamelRates(response.data.enamelRates || []);
        } catch (error) {
            console.error('Error fetching rates:', error);
            setError('Failed to load active rates. Please verify backend connection.');
        } finally {
            setLoading(false);
        }
    };

    // FIX BUG-23: Using shared formatCurrency from utils/formatCurrency.ts

    const getMetalLabel = (metal: string, karat?: number) => {
        if (metal === 'gold' && karat) {
            return `Gold ${karat}K`;
        }
        return metal.charAt(0).toUpperCase() + metal.slice(1);
    };

    if (loading) {
        return (
            <Page title="Dashboard">
                <LoadingSpinner />
            </Page>
        );
    }

    return (
        <Page title="Dashboard" subtitle="Live metal and gemstone rates">
            <Layout>
                <Layout.Section>
                    {error && (
                        <div style={{ marginBottom: '1rem' }}>
                            <Banner tone="critical" onDismiss={() => setError(null)}>
                                <p>{error}</p>
                            </Banner>
                        </div>
                    )}
                    <BlockStack gap="400">
                        <Text variant="headingLg" as="h2">
                            Live Rates
                        </Text>
                        <InlineStack gap="400" wrap={true}>
                            {metalRates.map((rate) => (
                                <Card key={rate.id}>
                                    <BlockStack gap="300">
                                        <InlineStack align="space-between">
                                            <Text variant="headingMd" as="h3">
                                                {getMetalLabel(rate.metal, rate.karat)}
                                            </Text>
                                            <Badge tone={rate.change24h >= 0 ? 'success' : 'critical'}>
                                                {`${rate.change24h >= 0 ? '+' : ''}${rate.change24h.toFixed(2)}%`}
                                            </Badge>
                                        </InlineStack>
                                        <BlockStack gap="200">
                                            <div>
                                                <Text variant="bodyLg" as="p" fontWeight="bold">
                                                    {formatCurrency(rate.ratePerGram)} / g
                                                </Text>
                                                <Text variant="bodySm" as="p" tone="subdued">
                                                    {formatCurrency(rate.ratePer10g)} / 10g
                                                </Text>
                                            </div>
                                            <Text variant="bodySm" as="p" tone="subdued">
                                                Updated: {format(new Date(rate.updatedAt), 'MMM dd, HH:mm')}
                                            </Text>
                                        </BlockStack>
                                    </BlockStack>
                                </Card>
                            ))}
                            {enamelRates.map((rate) => (
                                <Card key={rate.id}>
                                    <BlockStack gap="300">
                                        <Text variant="headingMd" as="h3">
                                            {rate.enamelColor} Enamel
                                        </Text>
                                        <BlockStack gap="200">
                                            <div>
                                                <Text variant="bodyLg" as="p" fontWeight="bold">
                                                    {formatCurrency(rate.ratePerGram)} / g
                                                </Text>
                                            </div>
                                            <Text variant="bodySm" as="p" tone="subdued">
                                                Updated: {format(new Date(rate.updatedAt), 'MMM dd, HH:mm')}
                                            </Text>
                                        </BlockStack>
                                    </BlockStack>
                                </Card>
                            ))}
                        </InlineStack>
                    </BlockStack>
                </Layout.Section>

                <Layout.Section variant="oneThird">
                    <Card>
                        <BlockStack gap="300">
                            <Text variant="headingMd" as="h3">
                                Quick Stats
                            </Text>
                            <BlockStack gap="200">
                                <div>
                                    <Text variant="bodyLg" as="p" fontWeight="bold">
                                        {metalRates.length + enamelRates.length}
                                    </Text>
                                    <Text variant="bodySm" as="p" tone="subdued">
                                        Active Rates
                                    </Text>
                                </div>
                            </BlockStack>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
