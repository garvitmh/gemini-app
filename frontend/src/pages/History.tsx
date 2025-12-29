import { useState, useEffect } from 'react';
import {
    Page,
    Layout,
    Card,
    DataTable,
    Tabs,
    BlockStack,
    InlineStack,
    Pagination,
    Badge,
} from '@shopify/polaris';
import { format } from 'date-fns';
import api from '../utils/api';

interface AuditLog {
    id: string;
    userId?: string;
    action: string;
    entity: string;
    oldValue?: string;
    newValue?: string;
    reason?: string;
    createdAt: string;
}

interface PriceHistory {
    id: string;
    product: {
        sku: string;
        title: string;
    };
    oldPrice?: number;
    newPrice: number;
    status: string;
    pushedAt: string;
}

export default function History() {
    const [selectedTab, setSelectedTab] = useState(0);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        if (selectedTab === 0) {
            fetchPriceHistory();
        } else {
            fetchAuditLogs();
        }
    }, [selectedTab, page]);

    const fetchAuditLogs = async () => {
        try {
            const response = await api.get('/audit', { params: { page } });
            setAuditLogs(response.data.logs);
            setTotalPages(response.data.pagination.pages);
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        }
    };

    const fetchPriceHistory = async () => {
        try {
            const response = await api.get('/audit/history', { params: { page } });
            setPriceHistory(response.data.history);
            setTotalPages(response.data.pagination.pages);
        } catch (error) {
            console.error('Error fetching price history:', error);
        }
    };

    const formatCurrency = (amount?: number | null) => {
        if (amount === null || amount === undefined) return '-';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
        }).format(amount);
    };

    const priceHistoryRows = priceHistory.map((item) => [
        format(new Date(item.pushedAt), 'MMM dd, yyyy HH:mm'),
        item.product.sku,
        item.product.title,
        formatCurrency(item.oldPrice),
        formatCurrency(item.newPrice),
        <Badge tone={item.status === 'success' ? 'success' : 'critical'}>
            {item.status}
        </Badge>,
    ]);

    const auditLogRows = auditLogs.map((log) => [
        format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm'),
        log.action.replace('_', ' ').toUpperCase(),
        log.entity,
        log.reason || '-',
    ]);

    const tabs = [
        {
            id: 'price-history',
            content: 'Price History',
            panelID: 'price-history-panel',
        },
        {
            id: 'audit-logs',
            content: 'Audit Logs',
            panelID: 'audit-logs-panel',
        },
    ];

    return (
        <Page title="History" subtitle="View price changes and audit logs">
            <Layout>
                <Layout.Section>
                    <Card>
                        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
                            <BlockStack gap="400">
                                {selectedTab === 0 ? (
                                    <>
                                        <DataTable
                                            columnContentTypes={['text', 'text', 'text', 'numeric', 'numeric', 'text']}
                                            headings={['Date', 'SKU', 'Product', 'Old Price', 'New Price', 'Status']}
                                            rows={priceHistoryRows}
                                        />
                                    </>
                                ) : (
                                    <>
                                        <DataTable
                                            columnContentTypes={['text', 'text', 'text', 'text']}
                                            headings={['Date', 'Action', 'Entity', 'Reason']}
                                            rows={auditLogRows}
                                        />
                                    </>
                                )}

                                <InlineStack align="center">
                                    <Pagination
                                        hasPrevious={page > 1}
                                        onPrevious={() => setPage(page - 1)}
                                        hasNext={page < totalPages}
                                        onNext={() => setPage(page + 1)}
                                    />
                                </InlineStack>
                            </BlockStack>
                        </Tabs>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
