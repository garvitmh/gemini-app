import { useState, useEffect } from 'react';
import {
    Page,
    Layout,
    Card,
    TextField,
    Button,
    BlockStack,
    InlineStack,
    Text,
    Select,
    Modal,
    Banner,
    RadioButton,
} from '@shopify/polaris';
import api from '../utils/api';

interface MetalRate {
    id: string;
    metal: string;
    karat?: number;
    ratePerGram: number;
    updatedAt: string;
}

interface StoneRate {
    id: string;
    stoneType: string;
    cut?: string;
    color?: string;
    clarity?: string;
    caratRange?: string;
    ratePerCarat?: number;
    ratePerPiece?: number;
    updatedAt: string;
}

export default function Rates() {
    const [metalRates, setMetalRates] = useState<MetalRate[]>([]);
    const [stoneRates, setStoneRates] = useState<StoneRate[]>([]);
    const [showMetalModal, setShowMetalModal] = useState(false);
    const [showStoneModal, setShowStoneModal] = useState(false);

    const [metalEditData, setMetalEditData] = useState({
        metal: 'gold',
        karat: 24,
        ratePerGram: 0,
        reason: '',
    });

    const [stoneEditData, setStoneEditData] = useState({
        stoneType: 'diamond',
        cut: '',
        color: '',
        clarity: '',
        caratRange: '',
        pricingType: 'perCarat', // 'perCarat' or 'perPiece'
        ratePerCarat: 0,
        ratePerPiece: 0,
        reason: '',
    });

    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        fetchRates();
    }, []);

    const fetchRates = async () => {
        try {
            const response = await api.get('/rates');
            setMetalRates(response.data.metalRates);
            setStoneRates(response.data.stoneRates || []);
        } catch (error) {
            console.error('Error fetching rates:', error);
        }
    };

    const handleUpdateMetalRate = async () => {
        setLoading(true);
        try {
            await api.post('/rates/update', metalEditData);
            setSuccessMessage('Metal rate updated successfully!');
            setShowMetalModal(false);
            fetchRates();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Error updating rate:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStoneRate = async () => {
        setLoading(true);
        try {
            const payload = {
                ...stoneEditData,
                ratePerCarat: stoneEditData.pricingType === 'perCarat' ? stoneEditData.ratePerCarat : null,
                ratePerPiece: stoneEditData.pricingType === 'perPiece' ? stoneEditData.ratePerPiece : null,
            };
            await api.post('/stone-rates/update', payload);
            setSuccessMessage('Gemstone rate updated successfully!');
            setShowStoneModal(false);
            fetchRates();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Error updating stone rate:', error);
        } finally {
            setLoading(false);
        }
    };

    const openMetalModal = (rate?: MetalRate) => {
        if (rate) {
            setMetalEditData({
                metal: rate.metal,
                karat: rate.karat || 24,
                ratePerGram: rate.ratePerGram,
                reason: '',
            });
        }
        setShowMetalModal(true);
    };

    const openStoneModal = (rate?: StoneRate) => {
        if (rate) {
            setStoneEditData({
                stoneType: rate.stoneType,
                cut: rate.cut || '',
                color: rate.color || '',
                clarity: rate.clarity || '',
                caratRange: rate.caratRange || '',
                pricingType: rate.ratePerCarat ? 'perCarat' : 'perPiece',
                ratePerCarat: rate.ratePerCarat || 0,
                ratePerPiece: rate.ratePerPiece || 0,
                reason: '',
            });
        } else {
            setStoneEditData({
                stoneType: 'diamond',
                cut: '',
                color: '',
                clarity: '',
                caratRange: '',
                pricingType: 'perCarat',
                ratePerCarat: 0,
                ratePerPiece: 0,
                reason: '',
            });
        }
        setShowStoneModal(true);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
        }).format(amount);
    };

    const formatStoneRateDisplay = (rate: StoneRate) => {
        const parts = [rate.stoneType.toUpperCase()];
        if (rate.cut) parts.push(rate.cut);
        if (rate.color) parts.push(rate.color);
        if (rate.clarity) parts.push(rate.clarity);
        if (rate.caratRange) parts.push(`(${rate.caratRange}ct)`);
        return parts.join(' / ');
    };

    return (
        <Page
            title="Rates Management"
            subtitle="Update metal and gemstone rates"
        >
            <Layout>
                {successMessage && (
                    <Layout.Section>
                        <Banner tone="success" onDismiss={() => setSuccessMessage('')}>
                            {successMessage}
                        </Banner>
                    </Layout.Section>
                )}

                {/* Metal Rates Section */}
                <Layout.Section>
                    <Card>
                        <BlockStack gap="400">
                            <InlineStack align="space-between" blockAlign="center">
                                <Text variant="headingMd" as="h3">
                                    Metal Rates
                                </Text>
                                <Button onClick={() => openMetalModal()}>Add Metal Rate</Button>
                            </InlineStack>
                            <BlockStack gap="300">
                                {metalRates.map((rate) => (
                                    <Card key={rate.id}>
                                        <InlineStack align="space-between" blockAlign="center">
                                            <BlockStack gap="100">
                                                <Text variant="headingMd" as="h4">
                                                    {rate.metal.toUpperCase()}
                                                    {rate.karat ? ` ${rate.karat}K` : ''}
                                                </Text>
                                                <Text variant="bodyLg" as="p" fontWeight="bold">
                                                    {formatCurrency(rate.ratePerGram)} / gram
                                                </Text>
                                            </BlockStack>
                                            <Button onClick={() => openMetalModal(rate)}>Edit</Button>
                                        </InlineStack>
                                    </Card>
                                ))}
                            </BlockStack>
                        </BlockStack>
                    </Card>
                </Layout.Section>

                {/* Gemstone Rates Section */}
                <Layout.Section>
                    <Card>
                        <BlockStack gap="400">
                            <InlineStack align="space-between" blockAlign="center">
                                <Text variant="headingMd" as="h3">
                                    Gemstone & Diamond Rates
                                </Text>
                                <Button onClick={() => openStoneModal()}>Add Gemstone Rate</Button>
                            </InlineStack>
                            <BlockStack gap="300">
                                {stoneRates.length === 0 ? (
                                    <Text as="p" tone="subdued">
                                        No gemstone rates added yet. Click "Add Gemstone Rate" to get started.
                                    </Text>
                                ) : (
                                    stoneRates.map((rate) => (
                                        <Card key={rate.id}>
                                            <InlineStack align="space-between" blockAlign="center">
                                                <BlockStack gap="100">
                                                    <Text variant="headingMd" as="h4">
                                                        {formatStoneRateDisplay(rate)}
                                                    </Text>
                                                    <Text variant="bodyLg" as="p" fontWeight="bold">
                                                        {rate.ratePerCarat
                                                            ? `${formatCurrency(rate.ratePerCarat)} / carat`
                                                            : `${formatCurrency(rate.ratePerPiece || 0)} / piece`
                                                        }
                                                    </Text>
                                                </BlockStack>
                                                <Button onClick={() => openStoneModal(rate)}>Edit</Button>
                                            </InlineStack>
                                        </Card>
                                    ))
                                )}
                            </BlockStack>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>

            {/* Metal Rate Modal */}
            <Modal
                open={showMetalModal}
                onClose={() => setShowMetalModal(false)}
                title="Update Metal Rate"
                primaryAction={{
                    content: 'Update',
                    onAction: handleUpdateMetalRate,
                    loading,
                }}
                secondaryActions={[
                    {
                        content: 'Cancel',
                        onAction: () => setShowMetalModal(false),
                    },
                ]}
            >
                <Modal.Section>
                    <BlockStack gap="400">
                        <Select
                            label="Metal"
                            options={[
                                { label: 'Gold', value: 'gold' },
                                { label: 'Silver', value: 'silver' },
                                { label: 'Platinum', value: 'platinum' },
                            ]}
                            value={metalEditData.metal}
                            onChange={(value) => setMetalEditData({ ...metalEditData, metal: value })}
                        />

                        {metalEditData.metal === 'gold' && (
                            <Select
                                label="Karat"
                                options={[
                                    { label: '24K (Pure Gold)', value: '24' },
                                    { label: '23K', value: '23' },
                                    { label: '22K (Crown Gold)', value: '22' },
                                    { label: '21K', value: '21' },
                                    { label: '20K', value: '20' },
                                    { label: '18K (75%)', value: '18' },
                                    { label: '16K', value: '16' },
                                    { label: '14K (58.5%)', value: '14' },
                                    { label: '12K (50%)', value: '12' },
                                    { label: '10K (41.7%)', value: '10' },
                                    { label: '9K (37.5%)', value: '9' },
                                ]}
                                value={String(metalEditData.karat)}
                                onChange={(value) => setMetalEditData({ ...metalEditData, karat: parseInt(value) })}
                            />
                        )}

                        <TextField
                            label="Rate per Gram (₹)"
                            type="number"
                            value={String(metalEditData.ratePerGram)}
                            onChange={(value) => setMetalEditData({ ...metalEditData, ratePerGram: parseFloat(value) })}
                            autoComplete="off"
                        />

                        <TextField
                            label="Reason for Update"
                            value={metalEditData.reason}
                            onChange={(value) => setMetalEditData({ ...metalEditData, reason: value })}
                            placeholder="e.g., Market rate change"
                            autoComplete="off"
                        />
                    </BlockStack>
                </Modal.Section>
            </Modal>

            {/* Gemstone Rate Modal */}
            <Modal
                open={showStoneModal}
                onClose={() => setShowStoneModal(false)}
                title="Update Gemstone Rate"
                primaryAction={{
                    content: 'Update',
                    onAction: handleUpdateStoneRate,
                    loading,
                }}
                secondaryActions={[
                    {
                        content: 'Cancel',
                        onAction: () => setShowStoneModal(false),
                    },
                ]}
            >
                <Modal.Section>
                    <BlockStack gap="400">
                        <Select
                            label="Gemstone Type"
                            options={[
                                { label: 'Diamond', value: 'diamond' },
                                { label: 'Lab Grown Diamond', value: 'lab_grown_diamond' },
                                { label: 'Ruby', value: 'ruby' },
                                { label: 'Sapphire', value: 'sapphire' },
                                { label: 'Emerald', value: 'emerald' },
                            ]}
                            value={stoneEditData.stoneType}
                            onChange={(value) => setStoneEditData({ ...stoneEditData, stoneType: value })}
                        />

                        <Select
                            label="Cut (Optional)"
                            options={[
                                { label: 'None', value: '' },
                                { label: 'Excellent', value: 'Excellent' },
                                { label: 'Very Good', value: 'Very Good' },
                                { label: 'Good', value: 'Good' },
                                { label: 'Fair', value: 'Fair' },
                            ]}
                            value={stoneEditData.cut}
                            onChange={(value) => setStoneEditData({ ...stoneEditData, cut: value })}
                        />

                        {(stoneEditData.stoneType === 'diamond' || stoneEditData.stoneType === 'lab_grown_diamond') && (
                            <>
                                <Select
                                    label="Color (Optional)"
                                    options={[
                                        { label: 'None', value: '' },
                                        { label: 'D (Colorless)', value: 'D' },
                                        { label: 'E (Colorless)', value: 'E' },
                                        { label: 'F (Colorless)', value: 'F' },
                                        { label: 'G (Near Colorless)', value: 'G' },
                                        { label: 'H (Near Colorless)', value: 'H' },
                                    ]}
                                    value={stoneEditData.color}
                                    onChange={(value) => setStoneEditData({ ...stoneEditData, color: value })}
                                />

                                <Select
                                    label="Clarity (Optional)"
                                    options={[
                                        { label: 'None', value: '' },
                                        { label: 'IF (Internally Flawless)', value: 'IF' },
                                        { label: 'VVS1', value: 'VVS1' },
                                        { label: 'VVS2', value: 'VVS2' },
                                        { label: 'VS1', value: 'VS1' },
                                        { label: 'VS2', value: 'VS2' },
                                    ]}
                                    value={stoneEditData.clarity}
                                    onChange={(value) => setStoneEditData({ ...stoneEditData, clarity: value })}
                                />
                            </>
                        )}

                        <Select
                            label="Carat Range (Optional)"
                            options={[
                                { label: 'None', value: '' },
                                { label: '0.25-0.5 ct', value: '0.25-0.5' },
                                { label: '0.5-1.0 ct', value: '0.5-1.0' },
                                { label: '1.0-2.0 ct', value: '1.0-2.0' },
                                { label: '2.0+ ct', value: '2.0+' },
                            ]}
                            value={stoneEditData.caratRange}
                            onChange={(value) => setStoneEditData({ ...stoneEditData, caratRange: value })}
                        />

                        <Text as="h3" variant="headingMd">Pricing Method</Text>

                        <RadioButton
                            label="Per Carat (Weight-based)"
                            checked={stoneEditData.pricingType === 'perCarat'}
                            id="perCarat"
                            onChange={() => setStoneEditData({ ...stoneEditData, pricingType: 'perCarat' })}
                        />

                        {stoneEditData.pricingType === 'perCarat' && (
                            <TextField
                                label="Rate per Carat (₹)"
                                type="number"
                                value={String(stoneEditData.ratePerCarat)}
                                onChange={(value) => setStoneEditData({ ...stoneEditData, ratePerCarat: parseFloat(value) })}
                                autoComplete="off"
                                helpText="Price will be calculated as: Rate × Weight in carats"
                            />
                        )}

                        <RadioButton
                            label="Per Piece (Fixed Price)"
                            checked={stoneEditData.pricingType === 'perPiece'}
                            id="perPiece"
                            onChange={() => setStoneEditData({ ...stoneEditData, pricingType: 'perPiece' })}
                        />

                        {stoneEditData.pricingType === 'perPiece' && (
                            <TextField
                                label="Price per Piece (₹)"
                                type="number"
                                value={String(stoneEditData.ratePerPiece)}
                                onChange={(value) => setStoneEditData({ ...stoneEditData, ratePerPiece: parseFloat(value) })}
                                autoComplete="off"
                                helpText="Fixed price regardless of weight"
                            />
                        )}

                        <TextField
                            label="Reason for Update"
                            value={stoneEditData.reason}
                            onChange={(value) => setStoneEditData({ ...stoneEditData, reason: value })}
                            placeholder="e.g., Market rate change"
                            autoComplete="off"
                        />
                    </BlockStack>
                </Modal.Section>
            </Modal>
        </Page>
    );
}
