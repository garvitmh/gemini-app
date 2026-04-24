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
import { formatCurrency } from '../utils/formatCurrency';
import { getGemstoneDisplayName } from '../utils/gemstoneUtils';

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

interface EnamelRate {
    id: string;
    enamelColor: string;
    ratePerGram: number;
    updatedAt: string;
}

export default function Rates() {
    const [metalRates, setMetalRates] = useState<MetalRate[]>([]);
    const [stoneRates, setStoneRates] = useState<StoneRate[]>([]);
    const [enamelRates, setEnamelRates] = useState<EnamelRate[]>([]);
    const [showMetalModal, setShowMetalModal] = useState(false);
    const [showStoneModal, setShowStoneModal] = useState(false);
    const [showEnamelModal, setShowEnamelModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'metal' | 'stone' | 'enamel', id: string } | null>(null);

    const [metalEditData, setMetalEditData] = useState({
        metal: 'gold',
        karat: 24,
        ratePerGram: 0,
        reason: '',
    });

    const [stoneEditData, setStoneEditData] = useState({
        id: null as string | null,
        stoneType: 'diamond',
        naturalOrLabgrown: '',
        quality: '',
        shape: '',
        cut: '',
        color: '',
        clarity: '',
        caratRange: '',
        pricingType: 'perCarat', // 'perCarat', 'perPiece', or 'perGram'
        ratePerCarat: 0,
        ratePerPiece: 0,
        ratePerGram: 0, // Virtual field for frontend-only
        reason: '',
    });

    const [enamelEditData, setEnamelEditData] = useState({
        enamelColor: 'Red',
        ratePerGram: 0,
        reason: '',
    });

    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [pendingUpdates, setPendingUpdates] = useState(false);
    const [updatingPrices, setUpdatingPrices] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchRates();
    }, []);

    const fetchRates = async () => {
        try {
            setError('');
            const response = await api.get('/rates');
            setMetalRates(response.data.metalRates || []);
            setStoneRates(response.data.stoneRates || []);
            setEnamelRates(response.data.enamelRates || []);
        } catch (error) {
            console.error('Error fetching rates:', error);
            setError('Failed to load rates. Please check your connection.');
        }
    };

    const handleUpdateMetalRate = async () => {
        setLoading(true);
        try {
            await api.post('/rates/update', metalEditData);
            setSuccessMessage('Metal rate updated successfully!');
            setPendingUpdates(true);
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
            // Conversion Logic:
            // Input: ratePerGram (e.g. 500/g)
            // Storage: ratePerCarat (1g = 5ct). So Price/ct = Price/g / 5.
            const finalRatePerCarat = stoneEditData.pricingType === 'perGram'
                ? (stoneEditData.ratePerGram || 0) / 5
                : stoneEditData.ratePerCarat;

            const payload = {
                ...stoneEditData,
                ratePerCarat: (stoneEditData.pricingType === 'perCarat' || stoneEditData.pricingType === 'perGram') ? finalRatePerCarat : null,
                ratePerPiece: stoneEditData.pricingType === 'perPiece' ? stoneEditData.ratePerPiece : null,
            };
            await api.post('/stone-rates/update', payload);
            setSuccessMessage('Gemstone rate updated successfully!');
            setPendingUpdates(true);
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
            // Check if CZ to set virtual 'perGram' mode
            const isCZ = rate.stoneType.toLowerCase().includes('cz') || rate.stoneType.toLowerCase().includes('cubic zirconia');
            // ratePerCarat to ratePerGram: 100/ct * 5 = 500/g
            const virtualRatePerGram = (rate.ratePerCarat || 0) * 5;

            setStoneEditData({
                id: rate.id,
                stoneType: rate.stoneType,
                naturalOrLabgrown: (rate as any).naturalOrLabgrown || '',
                quality: (rate as any).quality || '',
                shape: (rate as any).shape || '',
                cut: rate.cut || '',
                color: rate.color || '',
                clarity: rate.clarity || '',
                caratRange: rate.caratRange || '',
                pricingType: isCZ ? 'perGram' : (rate.ratePerCarat ? 'perCarat' : 'perPiece'),
                ratePerCarat: rate.ratePerCarat || 0,
                ratePerPiece: rate.ratePerPiece || 0,
                ratePerGram: isCZ ? virtualRatePerGram : 0,
                reason: '',
            });
        } else {
            setStoneEditData({
                id: null,
                stoneType: 'diamond',
                naturalOrLabgrown: '',
                quality: '',
                shape: '',
                cut: '',
                color: '',
                clarity: '',
                caratRange: '',
                pricingType: 'perCarat',
                ratePerCarat: 0,
                ratePerPiece: 0,
                ratePerGram: 0,
                reason: '',
            });
        }
        setShowStoneModal(true);
    };

    const handleDeleteRate = async () => {
        if (!deleteTarget) return;

        setLoading(true);
        try {
            let endpoint = '';
            if (deleteTarget.type === 'metal') endpoint = '/rates';
            else if (deleteTarget.type === 'stone') endpoint = '/stone-rates';
            else if (deleteTarget.type === 'enamel') endpoint = '/enamel-rates';

            await api.delete(`${endpoint}/${deleteTarget.id}`);
            const typeName = deleteTarget.type === 'metal' ? 'Metal' : deleteTarget.type === 'stone' ? 'Gemstone' : 'Enamel';
            setSuccessMessage(`${typeName} rate deleted successfully!`);
            setShowDeleteModal(false);
            setDeleteTarget(null);
            fetchRates();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Error deleting rate:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateEnamelRate = async () => {
        setLoading(true);
        try {
            await api.post('/enamel-rates/update', enamelEditData);
            setSuccessMessage('Enamel rate updated successfully!');
            setPendingUpdates(true);
            setShowEnamelModal(false);
            fetchRates();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Error updating enamel rate:', error);
        } finally {
            setLoading(false);
        }
    };

    const openEnamelModal = (rate?: EnamelRate) => {
        if (rate) {
            setEnamelEditData({
                enamelColor: rate.enamelColor,
                ratePerGram: rate.ratePerGram,
                reason: '',
            });
        } else {
            setEnamelEditData({
                enamelColor: 'Red',
                ratePerGram: 0,
                reason: '',
            });
        }
        setShowEnamelModal(true);
    };

    const openDeleteModal = (type: 'metal' | 'stone' | 'enamel', id: string) => {
        setDeleteTarget({ type, id });
        setShowDeleteModal(true);
    };

    // FIX BUG-23: Using shared formatCurrency from utils/formatCurrency.ts

    const formatStoneRateDisplay = (rate: StoneRate) => {
        const parts = [getGemstoneDisplayName(rate.stoneType)];
        if (rate.cut) parts.push(rate.cut);
        if (rate.color) parts.push(rate.color);
        if (rate.clarity) parts.push(rate.clarity);
        if (rate.caratRange) parts.push(`(${rate.caratRange}ct)`);
        return parts.join(' / ');
    };

    const handleUpdateAllPrices = async () => {
        setUpdatingPrices(true);
        try {
            const response = await api.post('/products/update-all-prices');
            setSuccessMessage(response.data.message || 'All product prices updated successfully!');
            setPendingUpdates(false);
            setTimeout(() => setSuccessMessage(''), 5000);
        } catch (error) {
            console.error('Error updating all prices:', error);
            setSuccessMessage('Failed to update prices. Please try again.');
            setTimeout(() => setSuccessMessage(''), 3000);
        } finally {
            setUpdatingPrices(false);
        }
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

                {pendingUpdates && (
                    <Layout.Section>
                        <Banner
                            tone="warning"
                            title="Product prices need to be updated"
                            action={{
                                content: 'Update All Prices',
                                onAction: handleUpdateAllPrices,
                                loading: updatingPrices,
                            }}
                        >
                            <p>
                                You've updated one or more rates. Click "Update All Prices" to recalculate product prices based on the new rates.
                            </p>
                        </Banner>
                    </Layout.Section>
                )}

                {error && (
                    <Layout.Section>
                        <Banner tone="critical" onDismiss={() => setError('')}>
                            {error}
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
                                                    {rate.metal === 'gold' && rate.karat ? ` ${rate.karat}K` : ''}
                                                    {rate.metal !== 'gold' && rate.karat ? ` ${rate.karat}` : ''}
                                                </Text>
                                                <Text variant="bodyLg" as="p" fontWeight="bold">
                                                    {formatCurrency(rate.ratePerGram)} / gram
                                                </Text>
                                            </BlockStack>
                                            <InlineStack gap="200">
                                                <Button onClick={() => openMetalModal(rate)}>Edit</Button>
                                                <Button tone="critical" onClick={() => openDeleteModal('metal', rate.id)}>Delete</Button>
                                            </InlineStack>
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
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #dfe3e8' }}>
                                            <th style={{ padding: '12px', fontWeight: 600 }}>Gemstone Details</th>
                                            <th style={{ padding: '12px', fontWeight: 600 }}>Rate</th>
                                            <th style={{ padding: '12px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stoneRates.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#637381' }}>
                                                    No gemstone rates added yet. Click "Add Gemstone Rate" to get started.
                                                </td>
                                            </tr>
                                        ) : (
                                            stoneRates.map((rate) => (
                                                <tr key={rate.id} style={{ borderBottom: '1px solid #dfe3e8' }}>
                                                    <td style={{ padding: '12px' }}>
                                                        <Text variant="bodyMd" fontWeight="semibold" as="span">
                                                            {formatStoneRateDisplay(rate)}
                                                        </Text>
                                                    </td>
                                                    <td style={{ padding: '12px' }}>
                                                        <Text variant="bodyMd" as="span">
                                                            {(() => {
                                                                if (rate.ratePerCarat) {
                                                                    const isCZ = rate.stoneType.toLowerCase().includes('cz') || rate.stoneType.toLowerCase().includes('cubic zirconia');
                                                                    if (isCZ) {
                                                                        return `${formatCurrency(rate.ratePerCarat * 5)} / gram`;
                                                                    }
                                                                    return `${formatCurrency(rate.ratePerCarat)} / carat`;
                                                                }
                                                                return `${formatCurrency(rate.ratePerPiece || 0)} / piece`;
                                                            })()}
                                                        </Text>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                                        <InlineStack gap="200" align="end">
                                                            <Button size="slim" onClick={() => openStoneModal(rate)}>Edit</Button>
                                                            <Button size="slim" tone="critical" onClick={() => openDeleteModal('stone', rate.id)}>Delete</Button>
                                                        </InlineStack>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </BlockStack>
                    </Card>
                </Layout.Section>

                {/* Enamel Rates Section */}
                <Layout.Section>
                    <Card>
                        <BlockStack gap="400">
                            <InlineStack align="space-between" blockAlign="center">
                                <Text variant="headingMd" as="h3">
                                    Enamel Rates
                                </Text>
                                <Button onClick={() => openEnamelModal()}>Add Enamel Rate</Button>
                            </InlineStack>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #dfe3e8' }}>
                                            <th style={{ padding: '12px', fontWeight: 600 }}>Color</th>
                                            <th style={{ padding: '12px', fontWeight: 600 }}>Rate</th>
                                            <th style={{ padding: '12px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {enamelRates.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#637381' }}>
                                                    No enamel rates added yet. Click "Add Enamel Rate" to get started.
                                                </td>
                                            </tr>
                                        ) : (
                                            enamelRates.map((rate) => (
                                                <tr key={rate.id} style={{ borderBottom: '1px solid #dfe3e8' }}>
                                                    <td style={{ padding: '12px' }}>
                                                        <Text variant="bodyMd" fontWeight="semibold" as="span">
                                                            {rate.enamelColor}
                                                        </Text>
                                                    </td>
                                                    <td style={{ padding: '12px' }}>
                                                        <Text variant="bodyMd" as="span">
                                                            {formatCurrency(rate.ratePerGram)} / gram
                                                        </Text>
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                                        <InlineStack gap="200" align="end">
                                                            <Button size="slim" onClick={() => openEnamelModal(rate)}>Edit</Button>
                                                            <Button size="slim" tone="critical" onClick={() => openDeleteModal('enamel', rate.id)}>Delete</Button>
                                                        </InlineStack>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
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

                        {metalEditData.metal === 'silver' && (
                            <Select
                                label="Purity"
                                options={[
                                    { label: '999 - Fine Silver', value: '999' },
                                    { label: '980 - High-Purity', value: '980' },
                                    { label: '958 - Britannia', value: '958' },
                                    { label: '950 - High-Grade Sterling', value: '950' },
                                    { label: '935 - European Standard', value: '935' },
                                    { label: '925 - Sterling Silver', value: '925' },
                                    { label: '900 - Coin Silver', value: '900' },
                                    { label: '800 - European Coin', value: '800' },
                                ]}
                                value={String(metalEditData.karat)}
                                onChange={(value) => setMetalEditData({ ...metalEditData, karat: parseInt(value) })}
                            />
                        )}

                        {metalEditData.metal === 'platinum' && (
                            <Select
                                label="Purity"
                                options={[
                                    { label: '999 - Ultra-Pure', value: '999' },
                                    { label: '950 - Standard Jewelry', value: '950' },
                                    { label: '900 - Traditional', value: '900' },
                                    { label: '850 - Lower-Grade', value: '850' },
                                    { label: '800 - Industrial', value: '800' },
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
                                { label: 'Ruby (Manik)', value: 'ruby' },
                                { label: 'Diamond (Heera)', value: 'diamond' },
                                { label: 'Pearl (Moti)', value: 'pearl' },
                                { label: 'Black Beeds', value: 'black_beeds' },
                                { label: 'Yellow Sapphire (Pukhraj)', value: 'yellow_sapphire' },
                                { label: 'Blue Sapphire (Neelam)', value: 'blue_sapphire' },
                                { label: 'Emerald (Panna)', value: 'emerald' },
                                { label: 'Red Coral (Moonga)', value: 'red_coral' },
                                { label: 'Cat\'s Eye (Lehsunia)', value: 'cats_eye' },
                                { label: 'Hessonite (Gomed)', value: 'hessonite' },
                                { label: 'Opal', value: 'opal' },
                                { label: 'Garnet', value: 'garnet' },
                                { label: 'Aquamarine', value: 'aquamarine' },
                                { label: 'Topaz', value: 'topaz' },
                                { label: 'Navratan', value: 'navratan' },
                                { label: 'Mother of Pearl', value: 'mother_of_pearl' },
                                { label: 'Moissanite', value: 'moissanite' },
                                { label: 'CZ Cubic Zirconia', value: 'cz' },
                            ]}
                            value={stoneEditData.stoneType}
                            onChange={(value) => {
                                const isCZ = value.toLowerCase().includes('cz') || value.toLowerCase().includes('cubic zirconia');
                                setStoneEditData({
                                    ...stoneEditData,
                                    stoneType: value,
                                    pricingType: isCZ ? 'perGram' : 'perCarat'
                                });
                            }}
                        />

                        <Select
                            label="Stone Type (Optional)"
                            options={[
                                { label: 'None', value: '' },
                                { label: 'Natural', value: 'natural' },
                                { label: 'Labgrown', value: 'labgrown' },
                            ]}
                            value={stoneEditData.naturalOrLabgrown}
                            onChange={(value) => setStoneEditData({ ...stoneEditData, naturalOrLabgrown: value })}
                        />

                        <Select
                            label="Quality (Optional)"
                            options={[
                                { label: 'None', value: '' },
                                { label: 'Precious', value: 'precious' },
                                { label: 'Semi-Precious', value: 'semi_precious' },
                                { label: 'Kundan', value: 'kundan' },
                                { label: 'Gemstone', value: 'gemstone' },
                            ]}
                            value={stoneEditData.quality}
                            onChange={(value) => setStoneEditData({ ...stoneEditData, quality: value })}
                        />

                        <Select
                            label="Shape (Optional)"
                            options={[
                                { label: 'None', value: '' },
                                { label: 'Oval', value: 'oval' },
                                { label: 'Round', value: 'round' },
                                { label: 'Square', value: 'square' },
                                { label: 'Rectangle', value: 'rectangle' },
                                { label: 'Pear', value: 'pear' },
                            ]}
                            value={stoneEditData.shape}
                            onChange={(value) => setStoneEditData({ ...stoneEditData, shape: value })}
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

                        <Text as="p" variant="bodyMd">Carat Range (Optional)</Text>
                        <InlineStack gap="200" blockAlign="center">
                            <div style={{ flex: 1 }}>
                                <TextField
                                    label="From"
                                    type="number"
                                    value={stoneEditData.caratRange ? stoneEditData.caratRange.split('-')[0] : ''}
                                    onChange={(value) => {
                                        const endValue = stoneEditData.caratRange ? stoneEditData.caratRange.split('-')[1] : '';
                                        setStoneEditData({ ...stoneEditData, caratRange: value && endValue ? `${value}-${endValue}` : value || endValue || '' });
                                    }}
                                    placeholder="0.25"
                                    autoComplete="off"
                                />
                            </div>
                            <Text as="span" variant="bodyMd">to</Text>
                            <div style={{ flex: 1 }}>
                                <TextField
                                    label="To"
                                    type="number"
                                    value={stoneEditData.caratRange ? stoneEditData.caratRange.split('-')[1] : ''}
                                    onChange={(value) => {
                                        const startValue = stoneEditData.caratRange ? stoneEditData.caratRange.split('-')[0] : '';
                                        setStoneEditData({ ...stoneEditData, caratRange: startValue && value ? `${startValue}-${value}` : startValue || value || '' });
                                    }}
                                    placeholder="0.5"
                                    autoComplete="off"
                                />
                            </div>
                        </InlineStack>


                        <Text as="h3" variant="headingMd">Pricing Method</Text>

                        {((stoneEditData.stoneType || '').toLowerCase().includes('cz') || (stoneEditData.stoneType || '').toLowerCase().includes('cubic zirconia')) ? (
                            <RadioButton
                                label="Per Gram (Weight-based)"
                                checked={stoneEditData.pricingType === 'perGram'}
                                id="perGram"
                                onChange={() => setStoneEditData({ ...stoneEditData, pricingType: 'perGram' })}
                            />
                        ) : (
                            <RadioButton
                                label="Per Carat (Weight-based)"
                                checked={stoneEditData.pricingType === 'perCarat'}
                                id="perCarat"
                                onChange={() => setStoneEditData({ ...stoneEditData, pricingType: 'perCarat' })}
                            />
                        )}

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

                        {stoneEditData.pricingType === 'perGram' && (
                            <TextField
                                label="Rate per Gram (₹)"
                                type="number"
                                value={String(stoneEditData.ratePerGram)}
                                onChange={(value) => setStoneEditData({ ...stoneEditData, ratePerGram: parseFloat(value) })}
                                autoComplete="off"
                                helpText="Price will be calculated as: Rate × Weight in grams (Storage: Converted to Carats)"
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

            {/* Enamel Rate Modal */}
            <Modal
                open={showEnamelModal}
                onClose={() => setShowEnamelModal(false)}
                title="Update Enamel Rate"
                primaryAction={{
                    content: 'Update',
                    onAction: handleUpdateEnamelRate,
                    loading,
                }}
                secondaryActions={[
                    {
                        content: 'Cancel',
                        onAction: () => setShowEnamelModal(false),
                    },
                ]}
            >
                <Modal.Section>
                    <BlockStack gap="400">
                        <Select
                            label="Enamel Color"
                            options={[
                                { label: 'Red', value: 'Red' },
                                { label: 'Blue', value: 'Blue' },
                                { label: 'Green', value: 'Green' },
                                { label: 'Yellow', value: 'Yellow' },
                                { label: 'White', value: 'White' },
                                { label: 'Black', value: 'Black' },
                                { label: 'Multi-color', value: 'Multi-color' },
                            ]}
                            value={enamelEditData.enamelColor}
                            onChange={(value) => setEnamelEditData({ ...enamelEditData, enamelColor: value })}
                        />

                        <TextField
                            label="Rate per Gram (₹)"
                            type="number"
                            value={String(enamelEditData.ratePerGram)}
                            onChange={(value) => setEnamelEditData({ ...enamelEditData, ratePerGram: parseFloat(value) })}
                            autoComplete="off"
                            helpText="Price per gram for this enamel color"
                        />

                        <TextField
                            label="Reason for Update"
                            value={enamelEditData.reason}
                            onChange={(value) => setEnamelEditData({ ...enamelEditData, reason: value })}
                            placeholder="e.g., Market rate change"
                            autoComplete="off"
                        />
                    </BlockStack>
                </Modal.Section>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                open={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Confirm Deletion"
                primaryAction={{
                    content: 'Delete',
                    onAction: handleDeleteRate,
                    loading,
                    destructive: true,
                }}
                secondaryActions={[
                    {
                        content: 'Cancel',
                        onAction: () => setShowDeleteModal(false),
                    },
                ]}
            >
                <Modal.Section>
                    <Text as="p">
                        Are you sure you want to delete this {deleteTarget?.type === 'metal' ? 'metal' : deleteTarget?.type === 'stone' ? 'gemstone' : 'enamel'} rate? This action cannot be undone.
                    </Text>
                </Modal.Section>
            </Modal>
        </Page>
    );
}
