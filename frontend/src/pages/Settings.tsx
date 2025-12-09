import { useState, useEffect } from 'react';
import {
    Page,
    Layout,
    Card,
    TextField,
    Select,
    Button,
    BlockStack,
    Banner,
    Text,
} from '@shopify/polaris';
import api from '../utils/api';

interface Settings {
    defaultMakingFlat: number;
    defaultMakingPct: number;
    defaultWastagePct: number;
    defaultGstPct: number;
    defaultDiscount: number;
    emailNotifications: boolean;
    notificationEmail?: string;
}

export default function Settings() {
    const [settings, setSettings] = useState<Settings>({
        defaultMakingFlat: 0,
        defaultMakingPct: 0,
        defaultWastagePct: 0,
        defaultGstPct: 3,
        defaultDiscount: 0,
        emailNotifications: true,
    });
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

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

    return (
        <Page
            title="Settings"
            subtitle="Configure default pricing rules and preferences"
            primaryAction={{
                content: 'Save',
                onAction: handleSave,
                loading,
            }}
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

                            <TextField
                                label="Making Charge (Flat) ₹"
                                type="number"
                                value={String(settings.defaultMakingFlat)}
                                onChange={(value) =>
                                    setSettings({ ...settings, defaultMakingFlat: parseFloat(value) || 0 })
                                }
                                autoComplete="off"
                            />

                            <TextField
                                label="Making Charge (%)"
                                type="number"
                                value={String(settings.defaultMakingPct)}
                                onChange={(value) =>
                                    setSettings({ ...settings, defaultMakingPct: parseFloat(value) || 0 })
                                }
                                autoComplete="off"
                            />

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

                            <TextField
                                label="Default Discount ₹"
                                type="number"
                                value={String(settings.defaultDiscount)}
                                onChange={(value) =>
                                    setSettings({ ...settings, defaultDiscount: parseFloat(value) || 0 })
                                }
                                autoComplete="off"
                            />
                        </BlockStack>
                    </Card>
                </Layout.Section>

                <Layout.Section>
                    <Card>
                        <BlockStack gap="400">
                            <Text variant="headingMd" as="h3">
                                Notifications
                            </Text>

                            <TextField
                                label="Notification Email"
                                type="email"
                                value={settings.notificationEmail || ''}
                                onChange={(value) =>
                                    setSettings({ ...settings, notificationEmail: value })
                                }
                                placeholder="your@email.com"
                                autoComplete="off"
                            />
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
