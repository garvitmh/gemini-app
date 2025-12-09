import { useState, useEffect } from 'react';
import {
    Page,
    Layout,
    Card,
    Text,
    BlockStack,
    InlineStack,
    Badge,
} from '@shopify/polaris';
import { format } from 'date-fns';
import api from '../utils/api';
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

export default function Dashboard() {
    const [metalRates, setMetalRates] = useState<MetalRate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRates();
    }, []);

    const fetchRates = async () => {
        try {
            const response = await api.get('/rates');
            setMetalRates(response.data.metalRates);
        } catch (error) {
            console.error('Error fetching rates:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
        }).format(amount);
    };

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
                                        {metalRates.length}
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
