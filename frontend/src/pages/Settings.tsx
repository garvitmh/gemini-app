import { useState, useEffect } from 'react';
import {
    Page,
    Layout,
    Card,
    TextField,
    Select,
    BlockStack,
    InlineStack,
    Banner,
    Text,
} from '@shopify/polaris';
import api from '../utils/api';

interface Settings {
    defaultMakingChargeType: string;
    defaultMakingChargeValue: number;

    // Discounts
    defaultMetalDiscountType: string;
    defaultMetalDiscountValue: number;
    defaultMakingDiscountType: string;
    defaultMakingDiscountValue: number;
    defaultGemstoneDiscountType: string;
    defaultGemstoneDiscountValue: number;
    defaultEnamelDiscountType: string;
    defaultEnamelDiscountValue: number;

    defaultWastagePct: number;
    defaultGstPct: number;
    defaultDiscount: number;
    defaultDiscountType: string;
    emailNotifications: boolean;
    notificationEmail?: string;
}

export default function Settings() {
    const [settings, setSettings] = useState<Settings>({
        defaultMakingChargeType: 'per_gram',
        defaultMakingChargeValue: 1500,
        defaultMetalDiscountType: 'none',
        defaultMetalDiscountValue: 0,
        defaultMakingDiscountType: 'none',
        defaultMakingDiscountValue: 0,
        defaultGemstoneDiscountType: 'none',
        defaultGemstoneDiscountValue: 0,
        defaultEnamelDiscountType: 'none',
        defaultEnamelDiscountValue: 0,
        defaultWastagePct: 0,
        defaultGstPct: 3,
        defaultDiscount: 0,
        defaultDiscountType: 'flat',
        emailNotifications: true,
    });
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [applyingToAll, setApplyingToAll] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get('/settings');
            if (response.data.settings) {
                setSettings(response.data.settings);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.put('/settings', settings);
            setSuccessMessage('Settings saved successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Error saving settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApplyToAll = async () => {
        if (!confirm('This will apply current settings to ALL products and recalculate prices. This may take several minutes. Continue?')) {
            return;
        }

        setApplyingToAll(true);

        try {
            const response = await api.post('/settings/apply-to-all');
            setSuccessMessage(`Successfully applied settings to ${response.data.successCount} products!`);
            setTimeout(() => setSuccessMessage(''), 5000);
        } catch (error) {
            console.error('Error applying settings:', error);
            setSuccessMessage('Failed to apply settings to products');
            setTimeout(() => setSuccessMessage(''), 5000);
        } finally {
            setApplyingToAll(false);
        }
    };

    return (
        <Page
            title="Settings"
            subtitle="Configure default pricing rules and preferences"
            primaryAction={{
                content: 'Save',
                onAction: handleSave,
                loading,
            }}
            secondaryActions={[
                {
                    content: 'Apply to All Products',
                    onAction: handleApplyToAll,
                    loading: applyingToAll,
                    destructive: true,
                }
            ]}
        >
            <Layout>
                {successMessage && (
                    <Layout.Section>
                        <Banner tone="success" onDismiss={() => setSuccessMessage('')}>
                            {successMessage}
                        </Banner>
                    </Layout.Section>
                )}

                <Layout.Section>
                    <Card>
                        <BlockStack gap="400">
                            <Text variant="headingMd" as="h3">
                                Default Pricing Rules
                            </Text>
                            <Text as="p" tone="subdued">
                                These values will be used as defaults for all products unless overridden.
                            </Text>

                            <BlockStack gap="200">
                                <Select
                                    label="Making Charge Type"
                                    options={[
                                        { label: 'Per Gram (e.g. ₹1500/g)', value: 'per_gram' },
                                        { label: 'Percentage (e.g. 10% of metal)', value: 'percent' },
                                        { label: 'Flat Rate (e.g. ₹500 fixed)', value: 'flat' },
                                    ]}
                                    value={settings.defaultMakingChargeType}
                                    onChange={(value) => setSettings({ ...settings, defaultMakingChargeType: value })}
                                />
                                <TextField
                                    label="Making Charge Value"
                                    type="number"
                                    value={String(settings.defaultMakingChargeValue)}
                                    onChange={(value) =>
                                        setSettings({ ...settings, defaultMakingChargeValue: parseFloat(value) || 0 })
                                    }
                                    autoComplete="off"
                                    prefix={settings.defaultMakingChargeType === 'percent' ? '' : '₹'}
                                    suffix={settings.defaultMakingChargeType === 'percent' ? '%' : ''}
                                    helpText={
                                        settings.defaultMakingChargeType === 'per_gram' ? 'Using ₹ X per gram of metal weight' :
                                            settings.defaultMakingChargeType === 'percent' ? 'Using X% of metal value + wastage' :
                                                'Using flat ₹ X per item'
                                    }
                                />
                            </BlockStack>

                            <TextField
                                label="Wastage (%)"
                                type="number"
                                value={String(settings.defaultWastagePct)}
                                onChange={(value) =>
                                    setSettings({ ...settings, defaultWastagePct: parseFloat(value) || 0 })
                                }
                                autoComplete="off"
                            />

                            <TextField
                                label="GST (%)"
                                type="number"
                                value={String(settings.defaultGstPct)}
                                onChange={(value) =>
                                    setSettings({ ...settings, defaultGstPct: parseFloat(value) || 0 })
                                }
                                autoComplete="off"
                            />

                            <BlockStack gap="200">
                                <Text variant="headingSm" as="h4">Default Overall Discount</Text>
                                <InlineStack gap="300" wrap={false}>
                                    <div style={{ flex: 1 }}>
                                        <Select
                                            label="Type"
                                            options={[
                                                { label: 'Amount (₹)', value: 'flat' },
                                                { label: 'Percentage (%)', value: 'percent' },
                                            ]}
                                            value={settings.defaultDiscountType}
                                            onChange={(val) => setSettings({ ...settings, defaultDiscountType: val })}
                                        />
                                    </div>
                                    <div style={{ flex: 2 }}>
                                        <TextField
                                            label="Value"
                                            type="number"
                                            value={settings.defaultDiscount.toString()}
                                            onChange={(val) => setSettings({ ...settings, defaultDiscount: parseFloat(val) || 0 })}
                                            prefix={settings.defaultDiscountType === 'flat' ? '₹' : ''}
                                            suffix={settings.defaultDiscountType === 'percent' ? '%' : ''}
                                            autoComplete="off"
                                        />
                                    </div>
                                </InlineStack>
                            </BlockStack>

                            <Text variant="headingMd" as="h3">Component Discounts</Text>
                            <Text as="p" tone="subdued">Set default discounts for specific components.</Text>

                            {/* Metal Discount */}
                            <BlockStack gap="200">
                                <Text variant="headingSm" as="h4">Metal Discount</Text>
                                <BlockStack inlineAlign="start">
                                    <Select
                                        label="Type"
                                        options={[
                                            { label: 'None', value: 'none' },
                                            { label: 'Percentage (%)', value: 'percent' },
                                            { label: 'Flat Amount (₹)', value: 'flat' },
                                        ]}
                                        value={settings.defaultMetalDiscountType}
                                        onChange={(value) => setSettings({ ...settings, defaultMetalDiscountType: value })}
                                    />
                                    {settings.defaultMetalDiscountType !== 'none' && (
                                        <TextField
                                            label="Value"
                                            type="number"
                                            value={String(settings.defaultMetalDiscountValue)}
                                            onChange={(value) => setSettings({ ...settings, defaultMetalDiscountValue: parseFloat(value) || 0 })}
                                            prefix={settings.defaultMetalDiscountType === 'flat' ? '₹' : ''}
                                            suffix={settings.defaultMetalDiscountType === 'percent' ? '%' : ''}
                                            autoComplete="off"
                                        />
                                    )}
                                </BlockStack>
                            </BlockStack>

                            {/* Making Charge Discount */}
                            <BlockStack gap="200">
                                <Text variant="headingSm" as="h4">Making Charge Discount</Text>
                                <BlockStack inlineAlign="start">
                                    <Select
                                        label="Type"
                                        options={[
                                            { label: 'None', value: 'none' },
                                            { label: 'Percentage (%)', value: 'percent' },
                                            { label: 'Flat Amount (₹)', value: 'flat' },
                                        ]}
                                        value={settings.defaultMakingDiscountType}
                                        onChange={(value) => setSettings({ ...settings, defaultMakingDiscountType: value })}
                                    />
                                    {settings.defaultMakingDiscountType !== 'none' && (
                                        <TextField
                                            label="Value"
                                            type="number"
                                            value={String(settings.defaultMakingDiscountValue)}
                                            onChange={(value) => setSettings({ ...settings, defaultMakingDiscountValue: parseFloat(value) || 0 })}
                                            prefix={settings.defaultMakingDiscountType === 'flat' ? '₹' : ''}
                                            suffix={settings.defaultMakingDiscountType === 'percent' ? '%' : ''}
                                            autoComplete="off"
                                        />
                                    )}
                                </BlockStack>
                            </BlockStack>

                            {/* Gemstone Discount */}
                            <BlockStack gap="200">
                                <Text variant="headingSm" as="h4">Gemstone/Diamond Discount</Text>
                                <BlockStack inlineAlign="start">
                                    <Select
                                        label="Type"
                                        options={[
                                            { label: 'None', value: 'none' },
                                            { label: 'Percentage (%)', value: 'percent' },
                                            { label: 'Flat Amount (₹)', value: 'flat' },
                                        ]}
                                        value={settings.defaultGemstoneDiscountType}
                                        onChange={(value) => setSettings({ ...settings, defaultGemstoneDiscountType: value })}
                                    />
                                    {settings.defaultGemstoneDiscountType !== 'none' && (
                                        <TextField
                                            label="Value"
                                            type="number"
                                            value={String(settings.defaultGemstoneDiscountValue)}
                                            onChange={(value) => setSettings({ ...settings, defaultGemstoneDiscountValue: parseFloat(value) || 0 })}
                                            prefix={settings.defaultGemstoneDiscountType === 'flat' ? '₹' : ''}
                                            suffix={settings.defaultGemstoneDiscountType === 'percent' ? '%' : ''}
                                            autoComplete="off"
                                        />
                                    )}
                                </BlockStack>
                            </BlockStack>

                            {/* Enamel Discount */}
                            <BlockStack gap="200">
                                <Text variant="headingSm" as="h4">Enamel Discount</Text>
                                <BlockStack inlineAlign="start">
                                    <Select
                                        label="Type"
                                        options={[
                                            { label: 'None', value: 'none' },
                                            { label: 'Percentage (%)', value: 'percent' },
                                            { label: 'Flat Amount (₹)', value: 'flat' },
                                        ]}
                                        value={settings.defaultEnamelDiscountType}
                                        onChange={(value) => setSettings({ ...settings, defaultEnamelDiscountType: value })}
                                    />
                                    {settings.defaultEnamelDiscountType !== 'none' && (
                                        <TextField
                                            label="Value"
                                            type="number"
                                            value={String(settings.defaultEnamelDiscountValue)}
                                            onChange={(value) => setSettings({ ...settings, defaultEnamelDiscountValue: parseFloat(value) || 0 })}
                                            prefix={settings.defaultEnamelDiscountType === 'flat' ? '₹' : ''}
                                            suffix={settings.defaultEnamelDiscountType === 'percent' ? '%' : ''}
                                            autoComplete="off"
                                        />
                                    )}
                                </BlockStack>
                            </BlockStack>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
