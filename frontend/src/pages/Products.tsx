import { useState, useEffect } from 'react';
import {
    Page,
    Layout,
    Card,
    DataTable,
    Button,
    TextField,
    Select,
    Modal,
    BlockStack,
    InlineStack,
    Text,
    Banner,
    Pagination,
    Badge,
    Thumbnail,
    Checkbox,
} from '@shopify/polaris';
import api from '../utils/api';
import BulkJobProgress from '../components/BulkJobProgress';

interface Product {
    id: string;
    sku: string;
    title: string;
    imageUrl?: string;
    status?: string;
    weightGrams?: number;
    metal?: string;
    karat?: number;
    gemstoneType?: string;
    gemstoneCut?: string;
    gemstoneColor?: string;
    gemstoneClarity?: string;
    gemstoneCaratRange?: string;
    isManualGemstonePrice?: boolean;
    manualGemstoneWeight?: number;
    manualGemstonePrice?: number;
    currentPrice?: number;
}

interface PriceBreakdown {
    metal_rate: number;
    metal_value: number;
    wastage_amount: number;
    wastage_pct: number;
    making_charges: number;
    making_charge_per_gram: number;
    gemstone_price?: number;
    subtotal: number;
    gst: number;
    gst_pct: number;
    discount: number;
    total: number;
}

export default function Products() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [successMessage, setSuccessMessage] = useState('');

    // Edit modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editWeight, setEditWeight] = useState('');
    const [editMetal, setEditMetal] = useState('');
    const [editKarat, setEditKarat] = useState('');
    const [editGemstoneType, setEditGemstoneType] = useState('');
    const [editGemstoneCut, setEditGemstoneCut] = useState('');
    const [editGemstoneColor, setEditGemstoneColor] = useState('');
    const [editGemstoneClarity, setEditGemstoneClarity] = useState('');
    const [editGemstoneCaratRange, setEditGemstoneCaratRange] = useState('');
    const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);

    const [editIsManualGemstonePrice, setEditIsManualGemstonePrice] = useState(false);
    const [editManualGemstoneWeight, setEditManualGemstoneWeight] = useState('');
    const [editManualGemstonePrice, setEditManualGemstonePrice] = useState('');

    // Import state
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importResult, setImportResult] = useState<{ updatedCount: number, errors: any[] } | null>(null);

    useEffect(() => {
        fetchProducts();
    }, [page, searchQuery]);

    const fetchProducts = async () => {
        try {
            const response = await api.get('/products', {
                params: { page, search: searchQuery },
            });
            setProducts(response.data.products);
            setTotalPages(response.data.pagination.pages);
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    const fetchPriceBreakdown = async (productId: string) => {
        try {
            const response = await api.get(`/products/${productId}/price-breakdown`);
            setPriceBreakdown(response.data.breakdown);
        } catch (error) {
            console.error('Error fetching price breakdown:', error);
            setPriceBreakdown(null);
        }
    };

    const handleSyncProducts = async () => {
        setLoading(true);
        try {
            await api.post('/products/sync');
            setSuccessMessage('Products synced from Shopify!');
            fetchProducts();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Error syncing products:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditProduct = (product: Product) => {
        setEditingProduct(product);
        setEditWeight(product.weightGrams?.toString() || '');
        setEditMetal(product.metal || '');
        setEditKarat(product.karat?.toString() || '');
        setEditGemstoneType(product.gemstoneType || '');
        setEditGemstoneCut(product.gemstoneCut || '');
        setEditGemstoneColor(product.gemstoneColor || '');
        setEditGemstoneClarity(product.gemstoneClarity || '');
        setEditGemstoneCaratRange(product.gemstoneCaratRange || '');

        setEditIsManualGemstonePrice(product.isManualGemstonePrice || false);
        setEditManualGemstoneWeight(product.manualGemstoneWeight?.toString() || '');
        setEditManualGemstonePrice(product.manualGemstonePrice?.toString() || '');

        setShowEditModal(true);

        // Fetch price breakdown if product has weight and metal
        if (product.weightGrams && product.metal) {
            fetchPriceBreakdown(product.id);
        } else {
            setPriceBreakdown(null);
        }
    };

    const handleSaveProduct = async () => {
        if (!editingProduct) return;

        setLoading(true);
        try {
            await api.put(`/products/${editingProduct.id}`, {
                weightGrams: editWeight ? parseFloat(editWeight) : null,
                metal: editMetal || null,
                karat: editKarat ? parseInt(editKarat) : null,
                gemstoneType: editGemstoneType || null,
                gemstoneCut: editGemstoneCut || null,
                gemstoneColor: editGemstoneColor || null,
                gemstoneClarity: editGemstoneClarity || null,
                gemstoneCaratRange: editGemstoneCaratRange || null,
                isManualGemstonePrice: editIsManualGemstonePrice,
                manualGemstoneWeight: editManualGemstoneWeight ? parseFloat(editManualGemstoneWeight) : null,
                manualGemstonePrice: editManualGemstonePrice ? parseFloat(editManualGemstonePrice) : null,
            });
            setSuccessMessage('Product updated successfully!');
            setShowEditModal(false);
            fetchProducts();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Error updating product:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setImportFile(event.target.files[0]);
            setImportResult(null);
        }
    };

    const handleImportProducts = async () => {
        if (!importFile) return;
        setLoading(true);
        const formData = new FormData();
        formData.append('file', importFile);

        try {
            const response = await api.post('/products/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportResult(response.data);
            if (response.data.success) {
                setSuccessMessage(`Imported ${response.data.updatedCount} products successfully!`);
                fetchProducts();
            }
        } catch (error) {
            console.error('Import error:', error);
            setSuccessMessage('Import failed');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = (format: 'csv' | 'xlsx') => {
        // Create anchor element for reliable download
        const url = `/api/products/export?format=${format}&t=${Date.now()}`;

        const link = document.createElement('a');
        link.href = url;
        link.download = `products_${Date.now()}.${format}`;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setSuccessMessage(`Exporting ${format.toUpperCase()}...`);
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    // Real-time price breakdown update
    useEffect(() => {
        if (priceBreakdown) {
            const currentWeight = parseFloat(editWeight) || 0;
            const gemstoneCost = (editIsManualGemstonePrice && editManualGemstonePrice)
                ? (parseFloat(editManualGemstonePrice) || 0)
                : (priceBreakdown.gemstone_price || 0);

            // Calculate components using rates
            const metalCostRaw = priceBreakdown.metal_rate * currentWeight;
            const wastageCost = metalCostRaw * (priceBreakdown.wastage_pct / 100);
            const metalCost = metalCostRaw + wastageCost;
            const makingCost = priceBreakdown.making_charge_per_gram * currentWeight;

            const subtotal = metalCost + makingCost + gemstoneCost;
            const gstAmount = subtotal * (priceBreakdown.gst_pct / 100);
            const finalPrice = subtotal + gstAmount - priceBreakdown.discount;

            setPriceBreakdown(prev => prev ? ({
                ...prev,
                metal_value: metalCost,
                wastage_amount: wastageCost,
                making_charges: makingCost,
                gemstone_price: gemstoneCost,
                subtotal: subtotal,
                gst: gstAmount,
                total: finalPrice
            }) : null);
        }
    }, [editManualGemstonePrice, editIsManualGemstonePrice, editWeight]);

    const formatCurrency = (amount?: number) => {
        if (!amount) return '-';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
        }).format(amount);
    };

    const rows = products.map((product) => [
        <Thumbnail
            source={product.imageUrl || 'https://via.placeholder.com/50'}
            alt={product.title}
            size="small"
        />,
        <Badge tone={product.status === 'active' ? 'success' : product.status === 'draft' ? 'attention' : 'info'}>
            {product.status || 'unknown'}
        </Badge>,
        product.sku || '-',
        product.title,
        product.metal || '-',
        product.karat ? `${product.karat}K` : '-',
        product.weightGrams ? `${product.weightGrams}g` : '-',
        product.gemstoneType || '-',
        formatCurrency(product.currentPrice),
        <Button size="slim" onClick={() => handleEditProduct(product)}>
            Edit
        </Button>,
    ]);

    return (
        <Page
            title="Products"
            subtitle="Manage product mappings and pricing"
            primaryAction={{
                content: 'Sync from Shopify',
                onAction: handleSyncProducts,
                loading,
            }}
            secondaryActions={[
                {
                    content: 'Import CSV/Excel',
                    onAction: () => {
                        setShowImportModal(true);
                        setImportFile(null);
                        setImportResult(null);
                    },
                },
                {
                    content: 'Export Excel',
                    onAction: () => handleExport('xlsx'),
                },
                {
                    content: 'Export CSV',
                    onAction: () => handleExport('csv'),
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
                            <TextField
                                label="Search products"
                                value={searchQuery}
                                onChange={setSearchQuery}
                                placeholder="Search by SKU or title"
                                autoComplete="off"
                                clearButton
                                onClearButtonClick={() => setSearchQuery('')}
                            />

                            <DataTable
                                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'numeric', 'text']}
                                headings={['Image', 'Status', 'SKU', 'Title', 'Metal', 'Karat', 'Weight', 'Gemstone', 'Current Price', 'Action']}
                                rows={rows}
                            />

                            <InlineStack align="center">
                                <Pagination
                                    hasPrevious={page > 1}
                                    onPrevious={() => setPage(page - 1)}
                                    hasNext={page < totalPages}
                                    onNext={() => setPage(page + 1)}
                                />
                            </InlineStack>
                        </BlockStack>
                    </Card>
                </Layout.Section>
            </Layout>

            <Modal
                open={showEditModal}
                onClose={() => setShowEditModal(false)}
                title={`Edit Product: ${editingProduct?.title}`}
                primaryAction={{
                    content: 'Save',
                    onAction: handleSaveProduct,
                    loading,
                }}
                secondaryActions={[
                    {
                        content: 'Cancel',
                        onAction: () => setShowEditModal(false),
                    },
                ]}
            >
                <Modal.Section>
                    <BlockStack gap="400">
                        <Text as="p" tone="subdued">
                            SKU: {editingProduct?.sku || 'N/A'}
                        </Text>

                        <TextField
                            label="Weight (grams)"
                            type="number"
                            value={editWeight}
                            onChange={setEditWeight}
                            placeholder="Enter weight in grams"
                            autoComplete="off"
                        />

                        <Select
                            label="Metal Type"
                            options={[
                                { label: 'Select metal', value: '' },
                                { label: 'Gold', value: 'gold' },
                                { label: 'Silver', value: 'silver' },
                                { label: 'Platinum', value: 'platinum' },
                            ]}
                            value={editMetal}
                            onChange={setEditMetal}
                        />

                        {editMetal === 'gold' && (
                            <Select
                                label="Karat"
                                options={[
                                    { label: 'Select karat', value: '' },
                                    { label: '24K', value: '24' },
                                    { label: '22K', value: '22' },
                                    { label: '18K', value: '18' },
                                    { label: '14K', value: '14' },
                                ]}
                                value={editKarat}
                                onChange={setEditKarat}
                            />
                        )}

                        <Text as="h3" variant="headingMd">Gemstone Details (Optional)</Text>

                        <Checkbox
                            label="Manual Gemstone Pricing"
                            checked={editIsManualGemstonePrice}
                            onChange={(newChecked) => setEditIsManualGemstonePrice(newChecked)}
                        />

                        {editIsManualGemstonePrice ? (
                            <InlineStack gap="400">
                                <div style={{ flex: 1 }}>
                                    <TextField
                                        label="Gemstone Weight (carats/grams)"
                                        type="number"
                                        value={editManualGemstoneWeight}
                                        onChange={setEditManualGemstoneWeight}
                                        autoComplete="off"
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <TextField
                                        label="Gemstone Price (Total)"
                                        type="number"
                                        value={editManualGemstonePrice}
                                        onChange={setEditManualGemstonePrice}
                                        prefix="₹"
                                        autoComplete="off"
                                    />
                                </div>
                            </InlineStack>
                        ) : (
                            <>
                                <Select
                                    label="Gemstone Type"
                                    options={[
                                        { label: 'None', value: '' },
                                        { label: 'Diamond', value: 'diamond' },
                                        { label: 'Lab Grown Diamond', value: 'lab_grown_diamond' },
                                        { label: 'Ruby', value: 'ruby' },
                                        { label: 'Sapphire', value: 'sapphire' },
                                        { label: 'Emerald', value: 'emerald' },
                                    ]}
                                    value={editGemstoneType}
                                    onChange={setEditGemstoneType}
                                />

                                {editGemstoneType && (
                                    <>
                                        <Select
                                            label="Cut"
                                            options={[
                                                { label: 'Select cut', value: '' },
                                                { label: 'Excellent', value: 'Excellent' },
                                                { label: 'Very Good', value: 'Very Good' },
                                                { label: 'Good', value: 'Good' },
                                                { label: 'Fair', value: 'Fair' },
                                            ]}
                                            value={editGemstoneCut}
                                            onChange={setEditGemstoneCut}
                                        />

                                        {(editGemstoneType === 'diamond' || editGemstoneType === 'lab_grown_diamond') && (
                                            <>
                                                <Select
                                                    label="Color"
                                                    options={[
                                                        { label: 'Select color', value: '' },
                                                        { label: 'D (Colorless)', value: 'D' },
                                                        { label: 'E (Colorless)', value: 'E' },
                                                        { label: 'F (Colorless)', value: 'F' },
                                                        { label: 'G (Near Colorless)', value: 'G' },
                                                        { label: 'H (Near Colorless)', value: 'H' },
                                                        { label: 'I (Near Colorless)', value: 'I' },
                                                        { label: 'J (Near Colorless)', value: 'J' },
                                                    ]}
                                                    value={editGemstoneColor}
                                                    onChange={setEditGemstoneColor}
                                                />

                                                <Select
                                                    label="Clarity"
                                                    options={[
                                                        { label: 'Select clarity', value: '' },
                                                        { label: 'IF (Internally Flawless)', value: 'IF' },
                                                        { label: 'VVS1 (Very Very Slightly Included)', value: 'VVS1' },
                                                        { label: 'VVS2', value: 'VVS2' },
                                                        { label: 'VS1 (Very Slightly Included)', value: 'VS1' },
                                                        { label: 'VS2', value: 'VS2' },
                                                        { label: 'SI1 (Slightly Included)', value: 'SI1' },
                                                        { label: 'SI2', value: 'SI2' },
                                                    ]}
                                                    value={editGemstoneClarity}
                                                    onChange={setEditGemstoneClarity}
                                                />
                                            </>
                                        )}

                                        <Select
                                            label="Carat Range"
                                            options={[
                                                { label: 'Select range', value: '' },
                                                { label: '0.25-0.5 ct', value: '0.25-0.5' },
                                                { label: '0.5-1.0 ct', value: '0.5-1.0' },
                                                { label: '1.0-2.0 ct', value: '1.0-2.0' },
                                                { label: '2.0-3.0 ct', value: '2.0-3.0' },
                                                { label: '3.0+ ct', value: '3.0+' },
                                            ]}
                                            value={editGemstoneCaratRange}
                                            onChange={setEditGemstoneCaratRange}
                                        />
                                    </>
                                )}
                            </>
                        )}

                        {priceBreakdown && (
                            <>
                                <Text as="h3" variant="headingMd">Price Breakdown</Text>
                                <Card>
                                    <BlockStack gap="200">
                                        <InlineStack align="space-between">
                                            <Text as="p">Metal Rate:</Text>
                                            <Text as="p" fontWeight="semibold">₹{priceBreakdown.metal_rate.toFixed(2)}/g</Text>
                                        </InlineStack>
                                        <InlineStack align="space-between">
                                            <Text as="p">Metal Value:</Text>
                                            <Text as="p">₹{priceBreakdown.metal_value.toFixed(2)}</Text>
                                        </InlineStack>
                                        <InlineStack align="space-between">
                                            <Text as="p">Wastage ({priceBreakdown.wastage_pct}%):</Text>
                                            <Text as="p">₹{priceBreakdown.wastage_amount.toFixed(2)}</Text>
                                        </InlineStack>
                                        <InlineStack align="space-between">
                                            <Text as="p">Making Charge (₹{priceBreakdown.making_charge_per_gram}/g × {editWeight || 0}g):</Text>
                                            <Text as="p">₹{priceBreakdown.making_charges.toFixed(2)}</Text>
                                        </InlineStack>
                                        {(priceBreakdown.gemstone_price && priceBreakdown.gemstone_price > 0) ? (
                                            <InlineStack align="space-between">
                                                <Text as="p">Gemstone Price:</Text>
                                                <Text as="p">₹{priceBreakdown.gemstone_price.toFixed(2)}</Text>
                                            </InlineStack>
                                        ) : null}
                                        <InlineStack align="space-between">
                                            <Text as="p" fontWeight="semibold">Subtotal:</Text>
                                            <Text as="p" fontWeight="semibold">₹{priceBreakdown.subtotal.toFixed(2)}</Text>
                                        </InlineStack>
                                        <InlineStack align="space-between">
                                            <Text as="p">GST ({priceBreakdown.gst_pct}%):</Text>
                                            <Text as="p">₹{priceBreakdown.gst.toFixed(2)}</Text>
                                        </InlineStack>
                                        {priceBreakdown.discount > 0 && (
                                            <InlineStack align="space-between">
                                                <Text as="p">Discount:</Text>
                                                <Text as="p" tone="critical">-₹{priceBreakdown.discount.toFixed(2)}</Text>
                                            </InlineStack>
                                        )}
                                        <InlineStack align="space-between">
                                            <Text as="p" variant="headingMd">Final Price:</Text>
                                            <Text as="p" variant="headingMd" tone="success">₹{priceBreakdown.total.toFixed(2)}</Text>
                                        </InlineStack>
                                    </BlockStack>
                                </Card>
                            </>
                        )}
                    </BlockStack>
                </Modal.Section>
            </Modal>

            <Modal
                open={showImportModal}
                onClose={() => setShowImportModal(false)}
                title="Import Products"
                primaryAction={{
                    content: 'Import',
                    onAction: handleImportProducts,
                    loading,
                    disabled: !importFile
                }}
                secondaryActions={[{ content: 'Close', onAction: () => setShowImportModal(false) }]}
            >
                <Modal.Section>
                    <BlockStack gap="400">
                        <Text as="p">
                            Upload a CSV or Excel file to bulk update product details.
                            Supported columns: SKU, weightGrams, metal, karat, etc.
                        </Text>

                        <div style={{ padding: '20px', border: '2px dashed #ccc', borderRadius: '4px', textAlign: 'center' }}>
                            <input
                                type="file"
                                accept=".csv, .xlsx, .xls"
                                onChange={handleImportFileChange}
                                style={{ display: 'block', margin: '0 auto' }}
                            />
                            {importFile && <Text as="p" tone="success">Selected: {importFile.name}</Text>}
                        </div>

                        {importResult && (
                            <Banner
                                tone={importResult.updatedCount > 0 ? "success" : "critical"}
                                title={`Processed with ${importResult.updatedCount} updates`}
                            >
                                {importResult.errors.length > 0 && (
                                    <BlockStack gap="200">
                                        <Text as="p" fontWeight="bold">Errors ({importResult.errors.length}):</Text>
                                        <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                            {importResult.errors.map((err, i) => (
                                                <Text key={i} as="p" tone="critical">{err.sku}: {err.error}</Text>
                                            ))}
                                        </div>
                                    </BlockStack>
                                )}
                            </Banner>
                        )}
                    </BlockStack>
                </Modal.Section>
            </Modal>
        </Page>
    );
}
