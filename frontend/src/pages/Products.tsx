import { useState, useEffect, useMemo } from 'react';
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

    Badge,
    Thumbnail,
    EmptyState,
    SkeletonBodyText,
    Pagination,
    Checkbox,
} from '@shopify/polaris';
import { DeleteIcon, EditIcon, ChevronRightIcon, ChevronDownIcon, UploadIcon } from '@shopify/polaris-icons';
import api from '../utils/api';
import { formatCurrency } from '../utils/formatCurrency';
import { useDebounce } from '../utils/useDebounce';
import { getGemstoneDisplayName } from '../utils/gemstoneUtils';
import CollectionFilter from '../components/CollectionFilter';
import { useSync } from '../context/SyncContext';

interface ProductGemstone {
    id?: string;
    gemstoneType: string;
    gemstoneCut?: string;
    gemstoneColor?: string;
    gemstoneClarity?: string;
    gemstoneCaratRange?: string;
    gemstoneWeight?: number;
    gemstonePieces?: number;
    discountValue?: number;
    discountType?: string;
    quality?: string;
    shape?: string;
    naturalOrLabgrown?: string;
    isCustom?: boolean;
    pricePerPiece?: number;
    pricePerCarat?: number;
}

interface Product {
    id: string;
    shopifyProductId: string; // Added for correct grouping
    sku: string;
    title: string;
    variantTitle?: string;
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
    stonePieces?: number;
    stoneWeightCarat?: number;
    isManualGemstonePrice?: boolean;
    manualGemstoneWeight?: number;
    manualGemstonePrice?: number;
    currentPrice?: number;
    makingChargeType?: string;
    makingChargeValue?: number;

    // Discount Overrides
    metalDiscountType?: string;
    metalDiscountValue?: number;
    makingDiscountType?: string;
    makingDiscountValue?: number;
    gemstoneDiscountType?: string;
    gemstoneDiscountValue?: number;

    // Enamel fields
    enamelColor?: string;
    enamelWeightGrams?: number;
    enamelDiscountType?: string;
    enamelDiscountValue?: number;

    // Multiple gemstones
    gemstones?: ProductGemstone[];
    discount?: number;
    discountType?: string;
    gemstoneOverridePricePerPiece?: number;
    gemstoneOverridePieces?: number;
    gemstoneOverrideColor?: string;
    grossGoldWeight?: number;
    autoGrossGoldWeight?: boolean;

    makingGroupId?: string | null;
    makingGroup?: { name: string } | null;
    wastagePct?: number;
    gstPct?: number;
}

interface MakingGroup {
    id: string;
    name: string;
}


interface PriceBreakdown {
    metal_name: string;
    metal_rate: number;
    metal_value: number;
    metal_value_original?: number;
    wastage_amount: number;
    wastage_pct: number;
    making_charges: number;
    making_charges_original?: number;
    making_charge_type: string;
    making_charge_rate: number;
    gemstone_name: string;
    gemstone_price?: number;
    gemstone_price_original?: number;
    gemstone_details?: {
        type: string;
        rate?: number;
        weight?: number;
        pieces?: number;
        cost: number;
    };
    enamel_name: string;
    enamel_price?: number;
    enamel_price_original?: number;
    enamel_details?: {
        type: string;
        color?: string;
        rate?: number;
        weight?: number;
        cost: number;
    };
    has_metal_discount?: boolean;
    has_making_discount?: boolean;
    has_gemstone_discount?: boolean;
    has_enamel_discount?: boolean;
    has_any_discount?: boolean;
    subtotal: number;
    gst_amount: number;
    gst_pct: number;
    discount: number;
    global_discount_value?: number;
    global_discount_type?: string;
    product_discount?: number;
    product_discount_value?: number;
    product_discount_type?: string;
    total: number;
    total_original?: number;
}


export default function Products() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 300);
    const [successMessage, setSuccessMessage] = useState('');


    // Grouping State
    // Grouping State (Single Accordion Logic)
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalServerItems, setTotalServerItems] = useState(0);
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all');
    const [collectionId, setCollectionId] = useState('');
    const ITEMS_PER_PAGE = 50;

    // Reset pagination when filter changes
    useEffect(() => {
        setCurrentPage(1);
        setExpandedGroupId(null); // Reset expanded group
    }, [statusFilter, collectionId, searchQuery]);

    const toggleGroup = (baseName: string) => {
        setExpandedGroupId(prev => prev === baseName ? null : baseName);
    };

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
    const [editDiscount, setEditDiscount] = useState('');
    const [editDiscountType, setEditDiscountType] = useState('flat');

    const [editGemstoneCaratRange, setEditGemstoneCaratRange] = useState('');
    const [editStonePieces, setEditStonePieces] = useState('');
    const [editStoneWeight, setEditStoneWeight] = useState('');

    // Making Charge Overrides
    const [editMakingChargeType, setEditMakingChargeType] = useState('');
    const [editMakingChargeValue, setEditMakingChargeValue] = useState('');
    const [makingGroups, setMakingGroups] = useState<MakingGroup[]>([]);
    const [editMakingGroupId, setEditMakingGroupId] = useState('');

    // Discount Overrides
    const [editMetalDiscountType, setEditMetalDiscountType] = useState('none');
    const [editMetalDiscountValue, setEditMetalDiscountValue] = useState('');
    const [editMakingDiscountType, setEditMakingDiscountType] = useState('none');
    const [editMakingDiscountValue, setEditMakingDiscountValue] = useState('');
    const [editGemstoneDiscountType, setEditGemstoneDiscountType] = useState('none');
    const [editGemstoneDiscountValue, setEditGemstoneDiscountValue] = useState('');

    // Enamel state
    const [editEnamelColor, setEditEnamelColor] = useState('');
    const [editEnamelWeightGrams, setEditEnamelWeightGrams] = useState('');
    const [editEnamelDiscountType, setEditEnamelDiscountType] = useState('none');
    const [editEnamelDiscountValue, setEditEnamelDiscountValue] = useState('');

    // Multiple gemstones state
    const [productGemstones, setProductGemstones] = useState<ProductGemstone[]>([]);
    const [showGemstoneModal, setShowGemstoneModal] = useState(false);
    const [editingGemstoneIndex, setEditingGemstoneIndex] = useState<number | null>(null);
    const [gemstoneModalType, setGemstoneModalType] = useState('');
    const [gemstoneModalCut, setGemstoneModalCut] = useState('');
    const [gemstoneModalColor, setGemstoneModalColor] = useState('');
    const [gemstoneModalClarity, setGemstoneModalClarity] = useState('');
    const [gemstoneModalCaratRange, setGemstoneModalCaratRange] = useState('');
    const [gemstoneModalWeight, setGemstoneModalWeight] = useState('');
    const [gemstoneModalPieces, setGemstoneModalPieces] = useState('');
    const [gemstoneModalPricingType, setGemstoneModalPricingType] = useState<'perCarat' | 'perPiece' | null>(null);
    const [gemstoneModalQuality, setGemstoneModalQuality] = useState('');
    const [gemstoneModalShape, setGemstoneModalShape] = useState('');
    const [gemstoneModalDiscountType, setGemstoneModalDiscountType] = useState('');
    const [gemstoneModalDiscountValue, setGemstoneModalDiscountValue] = useState('');

    const [gemstoneModalNaturalOrLabgrown, setGemstoneModalNaturalOrLabgrown] = useState('');
    const [gemstoneModalIsCustom, setGemstoneModalIsCustom] = useState(false);
    const [gemstoneModalPricePerPiece, setGemstoneModalPricePerPiece] = useState('');
    const [gemstoneModalPricePerCarat, setGemstoneModalPricePerCarat] = useState('');

    // All configured gemstone rates for dynamic dropdowns
    const [allGemstoneRates, setAllGemstoneRates] = useState<any[]>([]);



    const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);
    const [editWastagePct, setEditWastagePct] = useState<number | null>(null);
    const [editGstPct, setEditGstPct] = useState<number | null>(null);

    const [editIsManualGemstonePrice, setEditIsManualGemstonePrice] = useState(false);
    const [editManualGemstoneWeight, setEditManualGemstoneWeight] = useState('');
    const [editManualGemstonePrice, setEditManualGemstonePrice] = useState('');


    const [editGrossGoldWeight, setEditGrossGoldWeight] = useState<string>('');
    const [editAutoGrossGoldWeight, setEditAutoGrossGoldWeight] = useState<boolean>(false);

    // Import state
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importResult, setImportResult] = useState<{ updatedCount: number, errors: any[] } | null>(null);

    // Selected products for bulk actions
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [pushingBreakdown, setPushingBreakdown] = useState(false);

    // Handler for pushing price breakdowns to Shopify
    const handlePushBreakdown = async () => {
        if (selectedProducts.length === 0) {
            setError('Please select at least one product');
            setTimeout(() => setError(''), 3000);
            return;
        }

        setPushingBreakdown(true);
        setError('');
        setSuccessMessage('');

        try {
            const response = await api.post('/products/push-breakdown', {
                productIds: selectedProducts
            });

            if (response.data.success) {
                setSuccessMessage(`✓ Pushed ${response.data.successCount} products to Shopify!`);
                setSelectedProducts([]); // Clear selection
                await fetchProducts(); // Refresh to show updated lastPushedAt
                setTimeout(() => setSuccessMessage(''), 5000);
            } else {
                setError('Failed to push price breakdowns');
            }
        } catch (err: any) {
            console.error('Error pushing breakdowns:', err);
            const msg = err.response?.data?.error || err.message || 'Unknown error';
            setError(`Push failed: ${msg}`);
        } finally {
            setPushingBreakdown(false);
        }
    };

    // Handler for pushing single product to Shopify
    const handlePushSingleProduct = async (productId: string, sku: string) => {
        setError('');
        setSuccessMessage('');

        try {
            const response = await api.post('/products/push-breakdown', {
                productIds: [productId]
            });

            if (response.data.success && response.data.successCount > 0) {
                setSuccessMessage(`✓ Pushed ${sku} to Shopify!`);
                await fetchProducts(); // Refresh to show updated lastPushedAt
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setError(`Failed to push ${sku}`);
                setTimeout(() => setError(''), 3000);
            }
        } catch (err: any) {
            console.error('Error pushing product:', err);
            const msg = err.response?.data?.error || err.message || 'Unknown error';
            setError(`Push failed for ${sku}: ${msg}`);
            setTimeout(() => setError(''), 3000);
        }
    };



    useEffect(() => {
        setExpandedGroupId(null); // Reset expanded group on page change
        fetchProducts();
    }, [debouncedSearch, currentPage, collectionId, statusFilter]);

    useEffect(() => {
        fetchAllGemstoneRates();
        fetchMakingGroups();
    }, []);

    const fetchMakingGroups = async () => {
        try {
            const res = await api.get('/making-groups', { params: { limit: 100 } });
            setMakingGroups(res.data.makingGroups || []);
        } catch (e) {
            console.error('Error fetching making groups', e);
        }
    };

    // Fetch all gemstone rates for dynamic dropdowns
    const fetchAllGemstoneRates = async () => {
        try {
            const response = await api.get('/rates');
            setAllGemstoneRates(response.data.stoneRates || []);
        } catch (error) {
            console.error('Error fetching gemstone rates:', error);
            setAllGemstoneRates([]);
        }
    };

    // Fetch gemstone rate type when properties change
    useEffect(() => {
        const fetchGemstoneRateType = async () => {
            if (!gemstoneModalType) {
                setGemstoneModalPricingType(null);
                return;
            }

            try {
                const response = await api.get('/rates', {
                    params: {
                        stoneType: gemstoneModalType,
                        cut: gemstoneModalCut || undefined,
                        color: gemstoneModalColor || undefined,
                        clarity: gemstoneModalClarity || undefined,
                        caratRange: gemstoneModalCaratRange || undefined,
                    }
                });

                const stoneRates = response.data.stoneRates || [];
                const matchingRates = stoneRates.filter((rate: any) => {
                    return rate.stoneType === gemstoneModalType &&
                        (!gemstoneModalCut || rate.cut === gemstoneModalCut || !rate.cut) &&
                        (!gemstoneModalColor || rate.color === gemstoneModalColor || !rate.color) &&
                        (!gemstoneModalClarity || rate.clarity === gemstoneModalClarity || !rate.clarity) &&
                        (!gemstoneModalCaratRange || rate.caratRange === gemstoneModalCaratRange || !rate.caratRange);
                });

                if (matchingRates.length > 0) {
                    const rate = matchingRates[0];
                    if (rate.ratePerCarat) {
                        setGemstoneModalPricingType('perCarat');
                    } else if (rate.ratePerPiece) {
                        setGemstoneModalPricingType('perPiece');
                    } else {
                        setGemstoneModalPricingType(null);
                    }
                } else {
                    setGemstoneModalPricingType(null);
                }
            } catch (error) {
                console.error('Error fetching gemstone rate:', error);
                setGemstoneModalPricingType(null);
            }
        };

        fetchGemstoneRateType();
    }, [gemstoneModalType, gemstoneModalCut, gemstoneModalColor, gemstoneModalClarity, gemstoneModalCaratRange]);

    // Helper functions to generate dynamic dropdown options
    const getUniqueGemstoneTypes = () => {
        const types = new Set(allGemstoneRates.map(rate => rate.stoneType));
        return [
            { label: 'Select type', value: '' },
            ...Array.from(types).map(type => ({
                label: getGemstoneDisplayName(type),
                value: type
            }))
        ];
    };

    const getAvailableCuts = () => {
        if (!gemstoneModalType) return [{ label: 'None', value: '' }];

        const filtered = allGemstoneRates.filter(rate => rate.stoneType === gemstoneModalType);
        const cuts = new Set(filtered.map(rate => rate.cut).filter(Boolean));

        return [
            { label: 'None', value: '' },
            ...Array.from(cuts).map(cut => ({ label: cut, value: cut }))
        ];
    };



    const getAvailableClarities = () => {
        if (!gemstoneModalType) return [{ label: 'None', value: '' }];

        const filtered = allGemstoneRates.filter(rate => {
            return rate.stoneType === gemstoneModalType &&
                (!gemstoneModalCut || rate.cut === gemstoneModalCut || !rate.cut) &&
                (!gemstoneModalColor || rate.color === gemstoneModalColor || !rate.color);
        });
        const clarities = new Set(filtered.map(rate => rate.clarity).filter(Boolean));

        return [
            { label: 'None', value: '' },
            ...Array.from(clarities).map(clarity => ({ label: clarity, value: clarity }))
        ];
    };

    const getAvailableCaratRanges = () => {
        if (!gemstoneModalType) return [{ label: 'None', value: '' }];

        const filtered = allGemstoneRates.filter(rate => {
            return rate.stoneType === gemstoneModalType &&
                (!gemstoneModalCut || rate.cut === gemstoneModalCut || !rate.cut) &&
                (!gemstoneModalColor || rate.color === gemstoneModalColor || !rate.color) &&
                (!gemstoneModalClarity || rate.clarity === gemstoneModalClarity || !rate.clarity);
        });
        const ranges = new Set(filtered.map(rate => rate.caratRange).filter(Boolean));

        return [
            { label: 'None', value: '' },
            ...Array.from(ranges).map(range => ({ label: range, value: range }))
        ];
    };


    const fetchProducts = async () => {
        setLoading(true);
        setError('');
        try {
            // PHASE 1: PAGINATED FETCH ONLY
            // Fetch only the current page (managed by currentPage state) - Defaulting to Page 1 for this function if not parameterized, 
            // but relying on currentPage effect is better. 
            // Correct approach: fetchProducts should use currentPage, OR useEffect calls fetchProducts with currentPage.
            // Looking at useEffect, it calls fetchProducts on mount/debounce search.
            // Let's rely on currentPage state if possible, but the original code passed params.

            // Actually, the original useEffect just calls fetchProducts() without args.
            // So we should use currentPage state here.

            const response = await api.get('/products', {
                params: {
                    page: currentPage,
                    limit: ITEMS_PER_PAGE,
                    search: debouncedSearch,
                    collectionId: collectionId || undefined,
                    status: statusFilter !== 'all' ? statusFilter : undefined
                },
            });

            // Update state with SINGLE PAGE dataset
            if (response.data.products) {
                setProducts(response.data.products);
                setTotalServerItems(response.data.pagination.total);
            }

            // We need to hack the groupedInfo return to support server side total if we change to server side pagination.
            // The current UI relies on "grouping" implementation which happens ON THE FRONTEND (getGroupedRows).
            // IF we stop fetching all, getGroupedRows only has access to 50 items.
            // This effectively means "Page 1 of groups" is just "Groups found in Page 1 of raw products".
            // This is acceptable for a "Safe Optimization" as long as the user can page through.

            // BUT: The pagination component relies on groupedInfo.totalGroups.
            // If we only have 50 items, groupedInfo.totalGroups will be <= 50.
            // So pagination breaks unless we pass the SERVER TOTAL to the pagination component.

            // Since this is a "Safe Optimization" step, simply removing the "Fetch All" 
            // means standard pagination works, but "Grouped" pagination might be slightly weird 
            // (e.g. variants of a product might be split across pages).
            // However, the "Fetch All" was causing the crash.
            // Let's stick to: preventing the loop.

        } catch (error: any) {
            console.error('Error fetching products:', error);
            setError(error.userMessage || 'Failed to fetch products. Please try again.');
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchPriceBreakdown = async (product: Product) => {
        try {
            console.log('fetchPriceBreakdown - product.gemstones:', product.gemstones);
            // Map gemstones to plain objects to ensure proper serialization
            const gemstonesToSend = (product.gemstones || []).map(g => ({
                gemstoneType: g.gemstoneType,
                gemstoneCut: g.gemstoneCut,
                gemstoneColor: g.gemstoneColor,
                gemstoneClarity: g.gemstoneClarity,
                gemstoneCaratRange: g.gemstoneCaratRange,
                gemstoneWeight: g.gemstoneWeight,
                gemstonePieces: g.gemstonePieces,
                discountType: g.discountType,
                discountValue: g.discountValue,
            }));
            console.log('fetchPriceBreakdown - sending gemstones:', gemstonesToSend);
            const response = await api.post('/products/calculate-price', {
                weightGrams: product.weightGrams,
                metal: product.metal,
                karat: product.karat,
                gemstoneType: product.gemstoneType,
                gemstoneCut: product.gemstoneCut,
                gemstoneColor: product.gemstoneColor,
                gemstoneClarity: product.gemstoneClarity,
                gemstoneCaratRange: product.gemstoneCaratRange,
                stonePieces: product.stonePieces,
                stoneWeightCarat: product.stoneWeightCarat,
                isManualGemstonePrice: product.isManualGemstonePrice,
                manualGemstoneWeight: product.manualGemstoneWeight,
                manualGemstonePrice: product.manualGemstonePrice,
                makingChargeType: product.makingChargeType,
                makingChargeValue: product.makingChargeValue,
                metalDiscountType: product.metalDiscountType,
                metalDiscountValue: product.metalDiscountValue,
                makingDiscountType: product.makingDiscountType,
                makingDiscountValue: product.makingDiscountValue,
                gemstoneDiscountType: product.gemstoneDiscountType,
                gemstoneDiscountValue: product.gemstoneDiscountValue,
                enamelColor: product.enamelColor,
                enamelWeightGrams: product.enamelWeightGrams,
                enamelDiscountType: product.enamelDiscountType,
                enamelDiscountValue: product.enamelDiscountValue,
                discount: product.discount,
                discountType: product.discountType,
                wastagePct: product.wastagePct,
                gstPct: product.gstPct,
                makingGroupId: product.makingGroupId,
                gemstoneOverridePieces: product.gemstoneOverridePieces,
                gemstoneOverrideColor: product.gemstoneOverrideColor,
                grossGoldWeight: product.grossGoldWeight,
                autoGrossGoldWeight: product.autoGrossGoldWeight,
                gemstones: gemstonesToSend,
            });

            console.log('fetchPriceBreakdown - response gemstones:', response.data.breakdown?.gemstone_details);
            setPriceBreakdown(response.data.breakdown);
        } catch (error) {
            console.error('Error fetching price breakdown:', error);
        }
    };

    // Recalculate price breakdown with current form values
    const recalculatePriceBreakdown = async () => {
        console.log('recalculatePriceBreakdown called with productGemstones:', productGemstones);
        if (!editWeight || !editMetal) {
            setPriceBreakdown(null);
            return;
        }

        try {
            const response = await api.post('/products/calculate-price', {
                weightGrams: editWeight,
                metal: editMetal,
                karat: editKarat,
                gemstoneType: editGemstoneType,
                gemstoneCut: editGemstoneCut,
                gemstoneColor: editGemstoneColor,
                gemstoneClarity: editGemstoneClarity,
                gemstoneCaratRange: editGemstoneCaratRange,
                stonePieces: editStonePieces,
                stoneWeightCarat: editStoneWeight,
                isManualGemstonePrice: editIsManualGemstonePrice,
                manualGemstoneWeight: editManualGemstoneWeight,
                manualGemstonePrice: editManualGemstonePrice,
                makingGroupId: editMakingGroupId || undefined,
                makingChargeType: editMakingChargeType || undefined,
                makingChargeValue: editMakingChargeValue && parseFloat(editMakingChargeValue) > 0 ? parseFloat(editMakingChargeValue) : undefined,
                metalDiscountType: editMetalDiscountType !== 'none' ? editMetalDiscountType : null,
                metalDiscountValue: editMetalDiscountValue ? parseFloat(editMetalDiscountValue) : null,
                makingDiscountType: editMakingDiscountType !== 'none' ? editMakingDiscountType : null,
                makingDiscountValue: editMakingDiscountValue ? parseFloat(editMakingDiscountValue) : null,
                gemstoneDiscountType: editGemstoneDiscountType !== 'none' ? editGemstoneDiscountType : null,
                gemstoneDiscountValue: editGemstoneDiscountValue ? parseFloat(editGemstoneDiscountValue) : null,
                enamelColor: editEnamelColor,
                enamelWeightGrams: editEnamelWeightGrams ? parseFloat(editEnamelWeightGrams) : null,
                enamelDiscountType: editEnamelDiscountType !== 'none' ? editEnamelDiscountType : null,
                enamelDiscountValue: editEnamelDiscountValue ? parseFloat(editEnamelDiscountValue) : null,
                discount: editDiscount ? parseFloat(editDiscount) : 0,
                discountType: editDiscountType,
                grossGoldWeight: editGrossGoldWeight ? parseFloat(editGrossGoldWeight) : null,
                autoGrossGoldWeight: editAutoGrossGoldWeight,
                gemstones: productGemstones,
            });

            console.log('Price breakdown response:', response.data.breakdown);
            console.log('Gemstones sent:', productGemstones);
            setPriceBreakdown(response.data.breakdown);
        } catch (error) {
            console.error('Error recalculating price breakdown:', error);
        }
    };

    // Gemstone handlers
    const handleAddGemstone = () => {
        setEditingGemstoneIndex(null);
        setGemstoneModalType('');
        setGemstoneModalCut('');
        setGemstoneModalColor('');
        setGemstoneModalClarity('');
        setGemstoneModalCaratRange('');
        setGemstoneModalWeight('');
        setGemstoneModalPieces('');
        setGemstoneModalQuality('');
        setGemstoneModalShape('');
        setGemstoneModalNaturalOrLabgrown('');
        setGemstoneModalDiscountType('');
        setGemstoneModalDiscountValue('');
        setGemstoneModalIsCustom(false);
        setGemstoneModalPricePerPiece('');
        setGemstoneModalPricePerCarat('');
        setGemstoneModalPricingType(null);
        setShowGemstoneModal(true);
    };

    const handleEditGemstone = (index: number) => {
        const gem = productGemstones[index];
        setEditingGemstoneIndex(index);
        setGemstoneModalType(gem.gemstoneType);
        setGemstoneModalCut(gem.gemstoneCut || '');
        setGemstoneModalColor(gem.gemstoneColor || '');
        setGemstoneModalClarity(gem.gemstoneClarity || '');
        setGemstoneModalCaratRange(gem.gemstoneCaratRange || '');
        setGemstoneModalWeight(gem.gemstoneWeight?.toString() || '');
        setGemstoneModalPieces(gem.gemstonePieces?.toString() || '');
        setGemstoneModalQuality((gem as any).quality || '');
        setGemstoneModalShape((gem as any).shape || '');
        setGemstoneModalNaturalOrLabgrown((gem as any).naturalOrLabgrown || '');
        setGemstoneModalDiscountType(gem.discountType || '');
        setGemstoneModalDiscountValue(gem.discountValue?.toString() || '');
        setGemstoneModalIsCustom(gem.isCustom || false);
        setGemstoneModalPricePerPiece(gem.pricePerPiece?.toString() || '');
        setGemstoneModalPricePerCarat(gem.pricePerCarat?.toString() || '');

        // Determine pricing type for custom gems
        if (gem.isCustom) {
            if (gem.pricePerCarat) {
                setGemstoneModalPricingType('perCarat');
            } else {
                setGemstoneModalPricingType('perPiece');
            }
        }

        setShowGemstoneModal(true);
    };

    const handleSaveGemstone = () => {
        if (!gemstoneModalType) return;

        // Validation for custom gemstones
        if (gemstoneModalIsCustom) {
            if (gemstoneModalPricingType === 'perCarat') {
                const price = parseFloat(gemstoneModalPricePerCarat);
                const weight = parseFloat(gemstoneModalWeight);
                if (isNaN(price) || price <= 0 || isNaN(weight) || weight <= 0) {
                    return;
                }
            } else {
                const price = parseFloat(gemstoneModalPricePerPiece);
                const pieces = parseInt(gemstoneModalPieces);
                if (isNaN(price) || price <= 0 || isNaN(pieces) || pieces <= 0) {
                    return;
                }
            }
        }

        const newGemstone: ProductGemstone = {
            gemstoneType: gemstoneModalType,
            gemstoneCut: gemstoneModalCut || undefined,
            gemstoneColor: gemstoneModalColor || undefined,
            gemstoneClarity: gemstoneModalClarity || undefined,
            gemstoneCaratRange: gemstoneModalCaratRange || undefined,
            gemstoneWeight: gemstoneModalWeight ? parseFloat(gemstoneModalWeight) : undefined,
            gemstonePieces: gemstoneModalPieces ? parseInt(gemstoneModalPieces) : undefined,
            quality: gemstoneModalQuality || undefined,
            shape: gemstoneModalShape || undefined,
            naturalOrLabgrown: gemstoneModalNaturalOrLabgrown || undefined,
            discountType: (gemstoneModalDiscountType as any) || undefined,
            discountValue: gemstoneModalDiscountValue ? parseFloat(gemstoneModalDiscountValue) : undefined,
            isCustom: gemstoneModalIsCustom,
            pricePerPiece: gemstoneModalIsCustom && gemstoneModalPricingType !== 'perCarat' ? parseFloat(gemstoneModalPricePerPiece) : undefined,
            pricePerCarat: gemstoneModalIsCustom && gemstoneModalPricingType === 'perCarat' ? parseFloat(gemstoneModalPricePerCarat) : undefined,
        };

        if (editingGemstoneIndex !== null) {
            // Edit existing
            const updated = [...productGemstones];
            updated[editingGemstoneIndex] = newGemstone;
            setProductGemstones(updated);
        } else {
            // Add new
            setProductGemstones([...productGemstones, newGemstone]);
        }

        setShowGemstoneModal(false);

        // Recalculate price breakdown after adding/editing gemstone
        setTimeout(() => recalculatePriceBreakdown(), 100);
    };

    const handleDeleteGemstone = (index: number) => {
        setProductGemstones(productGemstones.filter((_, i) => i !== index));

        // Recalculate price breakdown after deleting gemstone
        setTimeout(() => recalculatePriceBreakdown(), 100);
    };

    const { triggerSync, syncStatus } = useSync();

    // Auto-refresh products on sync success
    useEffect(() => {
        if (syncStatus === 'success') {
            fetchProducts();
        }
    }, [syncStatus]);

    const handleSyncProducts = async () => {
        // Trigger global sync context action
        await triggerSync();
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
        setEditStonePieces(product.stonePieces?.toString() || '');
        setEditStoneWeight(product.stoneWeightCarat?.toString() || '');

        setEditMakingChargeType(product.makingChargeType || '');
        setEditMakingChargeValue(product.makingChargeValue?.toString() || '');
        setEditMakingGroupId(product.makingGroupId || '');

        setEditIsManualGemstonePrice(product.isManualGemstonePrice || false);
        setEditManualGemstoneWeight(product.manualGemstoneWeight?.toString() || '');
        setEditManualGemstonePrice(product.manualGemstonePrice?.toString() || '');
        setEditGrossGoldWeight(product.grossGoldWeight?.toString() || '0');
        setEditAutoGrossGoldWeight(product.autoGrossGoldWeight || false);
        setEditWastagePct(product.wastagePct !== undefined ? product.wastagePct : null);
        setEditGstPct(product.gstPct !== undefined ? product.gstPct : null);

        // Discount state (moved above gemstones to avoid duplication)
        setEditMetalDiscountType(product.metalDiscountType || 'none');
        setEditMetalDiscountValue(product.metalDiscountValue?.toString() || '');
        setEditMakingDiscountType(product.makingDiscountType || 'none');
        setEditMakingDiscountValue(product.makingDiscountValue?.toString() || '');
        setEditGemstoneDiscountType(product.gemstoneDiscountType || 'none');
        setEditGemstoneDiscountValue(product.gemstoneDiscountValue?.toString() || '');
        setEditDiscount(product.discount?.toString() || '');
        setEditDiscountType(product.discountType || 'flat');


        setEditEnamelColor(product.enamelColor || '');
        setEditEnamelWeightGrams(product.enamelWeightGrams?.toString() || '');
        setEditEnamelDiscountType(product.enamelDiscountType || 'none');
        setEditEnamelDiscountValue(product.enamelDiscountValue?.toString() || '');

        // Load gemstones
        setProductGemstones(product.gemstones || []);
        console.log('handleEditProduct - product.gemstones:', product.gemstones);

        setShowEditModal(true);

        // Fetch price breakdown - product already has gemstones loaded
        if (product.weightGrams && product.metal) {
            fetchPriceBreakdown(product);
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
                stonePieces: editStonePieces ? parseInt(editStonePieces) : null,
                stoneWeightCarat: editStoneWeight ? parseFloat(editStoneWeight) : null,
                isManualGemstonePrice: editIsManualGemstonePrice,
                manualGemstoneWeight: editManualGemstoneWeight ? parseFloat(editManualGemstoneWeight) : null,
                manualGemstonePrice: editManualGemstonePrice ? parseFloat(editManualGemstonePrice) : null,
                makingGroupId: editMakingGroupId || null,
                makingChargeType: editMakingChargeType || null,
                makingChargeValue: editMakingChargeValue ? parseFloat(editMakingChargeValue) : undefined,
                metalDiscountType: editMetalDiscountType !== 'none' ? editMetalDiscountType : null,
                metalDiscountValue: editMetalDiscountValue ? parseFloat(editMetalDiscountValue) : null,
                makingDiscountType: editMakingDiscountType !== 'none' ? editMakingDiscountType : null,
                makingDiscountValue: editMakingDiscountValue ? parseFloat(editMakingDiscountValue) : null,
                gemstoneDiscountType: editGemstoneDiscountType !== 'none' ? editGemstoneDiscountType : null,
                gemstoneDiscountValue: editGemstoneDiscountValue ? parseFloat(editGemstoneDiscountValue) : null,
                discount: editDiscount ? parseFloat(editDiscount) : null,
                discountType: editDiscountType,
                enamelColor: editEnamelColor || null,

                enamelWeightGrams: editEnamelWeightGrams ? parseFloat(editEnamelWeightGrams) : null,
                enamelDiscountType: editEnamelDiscountType !== 'none' ? editEnamelDiscountType : null,
                enamelDiscountValue: editEnamelDiscountValue ? parseFloat(editEnamelDiscountValue) : null,
                gemstones: productGemstones.map(g => ({
                    ...g,
                    gemstoneWeight: g.gemstoneWeight ? parseFloat(g.gemstoneWeight.toString()) : null,
                    discountValue: g.discountValue ? parseFloat(g.discountValue.toString()) : null,
                })),
                grossGoldWeight: editGrossGoldWeight ? parseFloat(editGrossGoldWeight.toString()) : null,
                autoGrossGoldWeight: editAutoGrossGoldWeight,
                wastagePct: editWastagePct,
                gstPct: editGstPct,
            });
            setSuccessMessage('Product updated successfully!');
            // Modal stays open as requested by user
            // setShowEditModal(false); // REMOVED
            await fetchProducts(); // Wait for refresh to sync updated price
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            console.error('Error updating product:', err);
            const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Unknown error';
            setError(`Update failed: ${msg}`);
            setSuccessMessage('');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProduct = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this product?')) return;
        setLoading(true);
        try {
            await api.delete(`/products/${id}`);
            setSuccessMessage('Product deleted successfully');
            fetchProducts();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error: any) {
            console.error('Error deleting product:', error);
            setError(error.response?.data?.error || 'Failed to delete product. Delete route might not be implemented.');
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
        setImportResult(null);

        try {
            // Helper to read file as base64
            const reader = new FileReader();
            const filePromise = new Promise((resolve, reject) => {
                reader.onload = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
            });
            reader.readAsDataURL(importFile);

            const fileData = await filePromise;
            const fileType = importFile.name.endsWith('.csv') ? 'csv' : 'xlsx';

            const response = await api.post('/products/import', {
                fileData,
                fileType
            });

            if (response.data.success) {
                setImportResult({
                    updatedCount: response.data.imported || 0,
                    errors: response.data.details?.errors || []
                });

                if (response.data.errors > 0) {
                    setSuccessMessage(`Import processed: ${response.data.imported} success, ${response.data.errors} failed.`);
                } else {
                    setSuccessMessage(`Imported ${response.data.imported} products successfully!`);
                }
                fetchProducts();
            } else {
                setImportResult({
                    updatedCount: 0,
                    errors: [{ sku: 'ERROR', error: response.data.error || 'Import failed' }]
                });
            }
        } catch (error: any) {
            console.error('Import error:', error);
            const errorMsg = error.response?.data?.error || error.message || 'Import failed';
            setSuccessMessage(errorMsg);
            setImportResult({
                updatedCount: 0,
                errors: [{ sku: 'FAIL', error: errorMsg }]
            });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format: 'csv' | 'xlsx') => {
        try {
            setLoading(true);
            setSuccessMessage(`Exporting ${format.toUpperCase()}...`);

            // FIX BUG-01: Include JWT auth header in raw fetch call
            const token = localStorage.getItem('gemini_auth_token');
            const response = await fetch(`/api/products/export?format=${format}&t=${Date.now()}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });

            // FIX: Check for auth/server errors before treating as blob
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Export failed' }));
                throw new Error(errorData.error || `Export failed with status ${response.status}`);
            }

            const blob = await response.blob();

            // Extract filename from Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `products.${format}`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '');
                }
            }

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            setSuccessMessage('Export successful');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error: any) {
            console.error('Export error:', error);
            setError(error.message || `Failed to export ${format.toUpperCase()}`);
        } finally {
            setLoading(false);
        }
    };

    // Real-time price breakdown update
    useEffect(() => {
        const calculatePrice = async () => {
            if (!editWeight || !editMetal) {
                setPriceBreakdown(null);
                return;
            }

            try {
                const response = await api.post('/products/calculate-price', {
                    weightGrams: editWeight,
                    metal: editMetal,
                    karat: editKarat,
                    gemstoneType: editGemstoneType,
                    gemstoneCut: editGemstoneCut,
                    gemstoneColor: editGemstoneColor,
                    gemstoneClarity: editGemstoneClarity,
                    gemstoneCaratRange: editGemstoneCaratRange,
                    stonePieces: editStonePieces,
                    stoneWeightCarat: editStoneWeight,
                    isManualGemstonePrice: editIsManualGemstonePrice,
                    manualGemstoneWeight: editManualGemstoneWeight,
                    manualGemstonePrice: editManualGemstonePrice,
                    makingGroupId: editMakingGroupId || undefined,
                    makingChargeType: editMakingChargeType,
                    makingChargeValue: editMakingChargeValue,
                    metalDiscountType: editMetalDiscountType !== 'none' ? editMetalDiscountType : null,
                    metalDiscountValue: editMetalDiscountValue ? parseFloat(editMetalDiscountValue) : null,
                    makingDiscountType: editMakingDiscountType !== 'none' ? editMakingDiscountType : null,
                    makingDiscountValue: editMakingDiscountValue ? parseFloat(editMakingDiscountValue) : null,
                    gemstoneDiscountType: editGemstoneDiscountType !== 'none' ? editGemstoneDiscountType : null,
                    gemstoneDiscountValue: editGemstoneDiscountValue ? parseFloat(editGemstoneDiscountValue) : null,
                    enamelColor: editEnamelColor,
                    enamelWeightGrams: editEnamelWeightGrams ? parseFloat(editEnamelWeightGrams) : null,
                    enamelDiscountType: editEnamelDiscountType !== 'none' ? editEnamelDiscountType : null,
                    enamelDiscountValue: editEnamelDiscountValue ? parseFloat(editEnamelDiscountValue) : null,
                    discount: editDiscount ? parseFloat(editDiscount) : 0,
                    discountType: editDiscountType,
                    grossGoldWeight: editGrossGoldWeight,
                    autoGrossGoldWeight: editAutoGrossGoldWeight,
                    wastagePct: editWastagePct,
                    gstPct: editGstPct,
                    gemstones: productGemstones.map(g => ({
                        ...g,
                        discountValue: g.discountValue ? parseFloat(g.discountValue.toString()) : null,
                    })), // Include gemstones array with parsed values
                });

                if (response.data.breakdown) {
                    setPriceBreakdown(response.data.breakdown);
                } else if (response.data.error) {
                    // console.warn(response.data.error); 
                    // Optional: set specific error state, for now null hides the table
                    setPriceBreakdown(null);
                }
            } catch (error) {
                console.error('Error calculating price:', error);
                // Keep previous breakdown or set null? null prevents stale data.
                setPriceBreakdown(null);
            }
        };

        const timer = setTimeout(() => {
            calculatePrice();
        }, 300); // Debounce to prevent too many API calls

        return () => clearTimeout(timer);
    }, [
        editWeight, editMetal, editKarat,
        editGemstoneType, editGemstoneCut, editGemstoneColor, editGemstoneClarity, editGemstoneCaratRange,
        editStonePieces, editStoneWeight,
        editIsManualGemstonePrice, editManualGemstoneWeight, editManualGemstonePrice,
        editMakingChargeType, editMakingChargeValue,
        editMetalDiscountType, editMetalDiscountValue,
        editMakingDiscountType, editMakingDiscountValue,
        editGemstoneDiscountType, editGemstoneDiscountValue,
        editEnamelColor, editEnamelWeightGrams, editEnamelDiscountType, editEnamelDiscountValue,
        editDiscount, editDiscountType,
        productGemstones, editMakingGroupId,
        editGrossGoldWeight, editAutoGrossGoldWeight,
        editWastagePct, editGstPct
    ]);


    // FIX BUG-23: Using shared formatCurrency from utils/formatCurrency.ts

    // Grouping Helper
    // Grouping Helper (Canonical Rule: No Orphans)
    // Grouping Helper (Canonical Rule: Group by Shopify Product ID)
    const groupedInfo = useMemo(() => {
        // Map<shopifyProductId, Product[]>
        const groups = new Map<string, Product[]>();

        products.forEach(product => {
            const key = product.shopifyProductId || product.title;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)?.push(product);
        });

        const visibleGroups = Array.from(groups.entries());
        const totalGroups = visibleGroups.length;

        // Backend already handles pagination and filtering.
        const paginatedGroups = visibleGroups;
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

        const displayRows: any[] = [];

        paginatedGroups.forEach(([groupId, groupProducts], index) => {
            const globalIndex = startIndex + index + 1;
            const representative = groupProducts[0];
            const baseName = representative.title.trim() || 'Untitled Product';
            const isExpanded = expandedGroupId === groupId;

            // Check if all variants in this group are selected
            const allVariantsSelected = groupProducts.every(p => selectedProducts.includes(p.id));

            displayRows.push([
                <Checkbox
                    label=""
                    checked={allVariantsSelected}
                    onChange={(checked) => {
                        if (checked) {
                            // Select all variants in this group
                            const newSelected = [...selectedProducts];
                            groupProducts.forEach(p => {
                                if (!newSelected.includes(p.id)) {
                                    newSelected.push(p.id);
                                }
                            });
                            setSelectedProducts(newSelected);
                        } else {
                            // Deselect all variants in this group
                            const variantIds = groupProducts.map(p => p.id);
                            setSelectedProducts(selectedProducts.filter(id => !variantIds.includes(id)));
                        }
                    }}
                />,
                globalIndex.toString(),
                <Thumbnail
                    source={representative.imageUrl || 'https://via.placeholder.com/50'}
                    alt={baseName}
                    size="small"
                />,
                '',
                '',
                <div key={groupId} style={{ padding: '8px 0', minWidth: '280px' }}>
                    <InlineStack align="start" gap="300" blockAlign="center">
                        <Button
                            plain
                            onClick={() => toggleGroup(groupId)}
                            icon={isExpanded ? ChevronDownIcon : ChevronRightIcon}
                        />
                        <div style={{ whiteSpace: 'normal', textAlign: 'left', maxWidth: '400px', cursor: 'pointer' }} onClick={() => toggleGroup(groupId)}>
                            <Text as="span" variant="bodyLg" fontWeight="semibold">{baseName}</Text>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                            <Badge tone="info">{`${groupProducts.length} variants`}</Badge>
                        </div>
                    </InlineStack>
                </div>,
                '', '', '', '', '', '',
            ]);

            if (isExpanded) {
                groupProducts.forEach((variant) => {
                    const isSelected = selectedProducts.includes(variant.id);
                    displayRows.push([
                        <Checkbox
                            label=""
                            checked={isSelected}
                            onChange={(checked) => {
                                if (checked) {
                                    setSelectedProducts([...selectedProducts, variant.id]);
                                } else {
                                    setSelectedProducts(selectedProducts.filter(id => id !== variant.id));
                                }
                            }}
                        />,
                        '',
                        '',
                        <div key={variant.id}>
                            <Badge tone={variant.status === 'active' ? 'success' : 'attention'}>
                                {variant.status?.toUpperCase()}
                            </Badge>
                        </div>,
                        <Text as="span" variant="bodyMd" tone="subdued">{variant.sku}</Text>,
                        <Text as="span" variant="bodyMd">{variant.variantTitle || 'Default Title'}</Text>,
                        variant.metal || '-',
                        variant.karat ? `${variant.karat}K` : '-',
                        variant.weightGrams ? `${variant.weightGrams}g` : '-',
                        variant.gemstoneType || (variant.gemstones && variant.gemstones.length > 0 ? variant.gemstones[0].gemstoneType : '-'),
                        formatCurrency(variant.currentPrice || 0),
                        <InlineStack gap="200">
                            <Button
                                icon={UploadIcon}
                                onClick={() => handlePushSingleProduct(variant.id, variant.sku)}
                                accessibilityLabel="Push to Shopify"
                            />
                            <Button icon={EditIcon} onClick={() => handleEditProduct(variant)} />
                            <Button tone="critical" icon={DeleteIcon} onClick={() => handleDeleteProduct(variant.id)} />
                        </InlineStack>,
                    ]);
                });
            }
        });

        return { displayRows, totalGroups };
    }, [products, statusFilter, currentPage, expandedGroupId, selectedProducts]);





    // Memoized grouping is already defined above

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
                    content: 'Download Template',
                    onAction: async () => {
                        try {
                            setLoading(true);
                            setSuccessMessage('Generating template...');

                            // FIX BUG-02: Include JWT auth header in raw fetch call
                            const token = localStorage.getItem('gemini_auth_token');
                            const response = await fetch(`/api/products/template?format=xlsx&t=${Date.now()}`, {
                                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                            });

                            // FIX: Check for auth/server errors before treating as blob
                            if (!response.ok) {
                                const errorData = await response.json().catch(() => ({ error: 'Template download failed' }));
                                throw new Error(errorData.error || `Download failed with status ${response.status}`);
                            }

                            const blob = await response.blob();

                            // Extract filename from Content-Disposition header
                            const contentDisposition = response.headers.get('Content-Disposition');
                            let filename = 'products_template.xlsx';
                            if (contentDisposition) {
                                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                                if (filenameMatch && filenameMatch[1]) {
                                    filename = filenameMatch[1].replace(/['"]/g, '');
                                }
                            }

                            // Create download link
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);

                            setSuccessMessage('Template downloaded successfully');
                            setTimeout(() => setSuccessMessage(''), 3000);
                        } catch (error: any) {
                            console.error('Download error:', error);
                            setError(error.message || 'Failed to download template');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
                {
                    content: `Push Prices to Shopify${selectedProducts.length > 0 ? ` (${selectedProducts.length})` : ''}`,
                    helpText: 'Recalculates and pushes current database prices to Shopify for selected products',
                    onAction: handlePushBreakdown,
                    loading: pushingBreakdown,
                    disabled: selectedProducts.length === 0,
                },
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

                {error && (
                    <Layout.Section>
                        <Banner
                            tone="critical"
                            title={error.includes('Update failed') ? "Update Error" : "Error loading products"}
                            action={{ content: 'Retry', onAction: fetchProducts }}
                            onDismiss={() => setError('')}
                        >
                            <p>{error}</p>
                        </Banner>
                    </Layout.Section>
                )}

                <Layout.Section>
                    <Card>
                        <BlockStack gap="400">
                            <InlineStack gap="400" align="start" blockAlign="end">
                                <div style={{ flexGrow: 1 }}>
                                    <TextField
                                        label="Search products"
                                        value={searchQuery}
                                        onChange={setSearchQuery}
                                        placeholder="Search by SKU or title"
                                        autoComplete="off"
                                        clearButton
                                        onClearButtonClick={() => setSearchQuery('')}
                                    />
                                </div>
                                <CollectionFilter
                                    selectedCollectionId={collectionId}
                                    onCollectionChange={setCollectionId}
                                    disabled={loading}
                                />
                                <div style={{ minWidth: '150px' }}>
                                    <Select
                                        label="Status"
                                        options={[
                                            { label: 'All', value: 'all' },
                                            { label: 'Active', value: 'active' },
                                            { label: 'Draft', value: 'draft' },
                                        ]}
                                        value={statusFilter}
                                        onChange={(val) => setStatusFilter(val as any)}
                                    />
                                </div>
                            </InlineStack>

                            {loading ? (
                                <SkeletonBodyText lines={10} />
                            ) : products.length === 0 && !error ? (
                                <EmptyState
                                    heading="No products found"
                                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                                >
                                    <p>
                                        {debouncedSearch
                                            ? 'Try adjusting your search terms'
                                            : 'Sync products from Shopify to get started'}
                                    </p>
                                </EmptyState>
                            ) : (
                                <>
                                    {/* FIX BUG-05: Select All / Deselect All bar */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', borderBottom: '1px solid #dfe3e8', background: selectedProducts.length > 0 ? '#f1f8ff' : 'transparent' }}>
                                        <Checkbox
                                            label=""
                                            checked={products.length > 0 && products.every(p => selectedProducts.includes(p.id))}
                                            onChange={(checked) => {
                                                if (checked) {
                                                    const allIds = products.map(p => p.id);
                                                    setSelectedProducts(prev => {
                                                        const newSet = new Set([...prev, ...allIds]);
                                                        return Array.from(newSet);
                                                    });
                                                } else {
                                                    const currentPageIds = products.map(p => p.id);
                                                    setSelectedProducts(prev => prev.filter(id => !currentPageIds.includes(id)));
                                                }
                                            }}
                                        />
                                        <Text as="span" variant="bodySm" tone="subdued">
                                            {selectedProducts.length > 0
                                                ? `${selectedProducts.length} selected`
                                                : 'Select all on this page'}
                                        </Text>
                                        {selectedProducts.length > 0 && (
                                            <Button size="slim" onClick={() => setSelectedProducts([])}>
                                                Deselect All
                                            </Button>
                                        )}
                                    </div>
                                    <DataTable
                                        columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text']}
                                        headings={['Select', '#', 'Image', 'Status', 'SKU', 'Title', 'Metal', 'Karat', 'Weight', 'Gemstone', 'Current Price', 'Action']}
                                        rows={groupedInfo.displayRows}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                                        <Pagination
                                            hasPrevious={currentPage > 1}
                                            onPrevious={() => setCurrentPage(c => c - 1)}
                                            hasNext={currentPage * ITEMS_PER_PAGE < totalServerItems}
                                            onNext={() => setCurrentPage(c => c + 1)}
                                            label={`Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, totalServerItems)} of ${totalServerItems} items`}
                                        />
                                    </div>
                                </>
                            )}
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

                        <Card>
                            <BlockStack gap="400">
                                <Text as="h3" variant="headingMd">Weight Configuration</Text>
                                <InlineStack align="space-between">
                                    <Text as="p">Auto Calculate Gross Weight</Text>
                                    <Button
                                        pressed={editAutoGrossGoldWeight}
                                        onClick={() => setEditAutoGrossGoldWeight(!editAutoGrossGoldWeight)}
                                        size="slim"
                                    >
                                        {editAutoGrossGoldWeight ? 'Enabled' : 'Disabled'}
                                    </Button>
                                </InlineStack>

                                <TextField
                                    label="Net Gold Weight (grams)"
                                    type="number"
                                    value={editWeight}
                                    onChange={setEditWeight}
                                    placeholder="Enter net weight"
                                    autoComplete="off"
                                />

                                <TextField
                                    label="Gross Gold Weight (grams)"
                                    type="number"
                                    value={editAutoGrossGoldWeight ?
                                        ((parseFloat(editWeight) || 0) +
                                            (productGemstones.reduce((sum, g) => sum + (g.gemstoneWeight || 0), 0) * 0.2) +
                                            ((parseFloat(editStoneWeight) || 0) * 0.2) +
                                            (parseFloat(editEnamelWeightGrams) || 0)).toFixed(3)
                                        : editGrossGoldWeight
                                    }
                                    onChange={setEditGrossGoldWeight}
                                    disabled={editAutoGrossGoldWeight}
                                    placeholder="Enter gross weight"
                                    autoComplete="off"
                                    helpText={editAutoGrossGoldWeight ? "Calculated: Net + Stones + Enamel" : "Manual override for total weight"}
                                />

                                <InlineStack gap="400">
                                    <div style={{ flex: 1 }}>
                                        <TextField
                                            label="Stone Weight (ct)"
                                            type="number"
                                            value={editStoneWeight}
                                            onChange={setEditStoneWeight}
                                            placeholder="Enter stone weight"
                                            autoComplete="off"
                                            helpText="Used for single gemstone products"
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <TextField
                                            label="Stone Pieces"
                                            type="number"
                                            value={editStonePieces}
                                            onChange={setEditStonePieces}
                                            placeholder="Enter stone pieces"
                                            autoComplete="off"
                                            helpText="Number of stones"
                                        />
                                    </div>
                                </InlineStack>
                            </BlockStack>
                        </Card>

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

                        {editMetal === 'silver' && (
                            <Select
                                label="Purity"
                                options={[
                                    { label: 'Select purity', value: '' },
                                    { label: '999 - Fine Silver', value: '999' },
                                    { label: '980 - High-Purity', value: '980' },
                                    { label: '958 - Britannia', value: '958' },
                                    { label: '950 - High-Grade Sterling', value: '950' },
                                    { label: '935 - European Standard', value: '935' },
                                    { label: '925 - Sterling Silver', value: '925' },
                                    { label: '900 - Coin Silver', value: '900' },
                                    { label: '800 - European Coin', value: '800' },
                                ]}
                                value={editKarat}
                                onChange={setEditKarat}
                            />
                        )}

                        {editMetal === 'platinum' && (
                            <Select
                                label="Purity"
                                options={[
                                    { label: 'Select purity', value: '' },
                                    { label: '999 - Ultra-Pure', value: '999' },
                                    { label: '950 - Standard Jewelry', value: '950' },
                                    { label: '900 - Traditional', value: '900' },
                                    { label: '850 - Lower-Grade', value: '850' },
                                    { label: '800 - Industrial', value: '800' },
                                ]}
                                value={editKarat}
                                onChange={setEditKarat}
                            />
                        )}


                        <Text as="h3" variant="headingMd">Enamel Details (Optional)</Text>


                        <Select
                            label="Enamel Color"
                            options={[
                                { label: 'None', value: '' },
                                { label: 'Red', value: 'Red' },
                                { label: 'Blue', value: 'Blue' },
                                { label: 'Green', value: 'Green' },
                                { label: 'Yellow', value: 'Yellow' },
                                { label: 'White', value: 'White' },
                                { label: 'Black', value: 'Black' },
                                { label: 'Multi-color', value: 'Multi-color' },
                            ]}
                            value={editEnamelColor}
                            onChange={setEditEnamelColor}
                        />

                        {editEnamelColor && (
                            <TextField
                                label="Enamel Weight (grams)"
                                type="number"
                                value={editEnamelWeightGrams}
                                onChange={setEditEnamelWeightGrams}
                                placeholder="Enter weight in grams"
                                autoComplete="off"
                                helpText="Weight of enamel pigment"
                            />
                        )}

                        <Card>
                            <BlockStack gap="400">
                                <InlineStack align="space-between" blockAlign="center">
                                    <Text as="h3" variant="headingMd">Gemstones</Text>
                                    <Button onClick={handleAddGemstone} size="slim">+ Add Gemstone</Button>
                                </InlineStack>

                                {productGemstones.length === 0 ? (
                                    <Text as="p" tone="subdued">No gemstones added. Click "+ Add Gemstone" to add one.</Text>
                                ) : (
                                    <BlockStack gap="300">
                                        {productGemstones.map((gem, index) => (
                                            <Card key={index} background="bg-surface-secondary">
                                                <InlineStack align="space-between" blockAlign="center">
                                                    <BlockStack gap="100">
                                                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                                                            {gem.isCustom && <Badge tone="attention">CUSTOM</Badge>}
                                                            {getGemstoneDisplayName(gem.gemstoneType)}
                                                            {gem.gemstoneClarity && ` (${gem.gemstoneClarity})`}
                                                            {gem.gemstoneColor && ` ${gem.gemstoneColor}`}
                                                            {gem.gemstoneCut && ` ${gem.gemstoneCut}`}
                                                        </Text>
                                                        <Text as="p" variant="bodySm" tone="subdued">
                                                            {gem.gemstoneWeight && `${gem.gemstoneWeight}ct `}
                                                            {gem.gemstonePieces && `${gem.gemstonePieces}pcs `}
                                                            {(gem.isCustom && gem.pricePerPiece) && `(₹${gem.pricePerPiece}/pc) `}
                                                            {gem.gemstoneCaratRange && `• Range: ${gem.gemstoneCaratRange} `}
                                                            {gem.discountType && `• Discount: ${gem.discountValue}${gem.discountType === 'percent' ? '%' : '₹'}`}
                                                        </Text>
                                                    </BlockStack>
                                                    <InlineStack gap="200">
                                                        <Button
                                                            size="slim"
                                                            onClick={() => handleEditGemstone(index)}
                                                            icon={EditIcon}
                                                        />
                                                        <Button
                                                            size="slim"
                                                            tone="critical"
                                                            onClick={() => handleDeleteGemstone(index)}
                                                            icon={DeleteIcon}
                                                        />
                                                    </InlineStack>
                                                </InlineStack>
                                            </Card>
                                        ))}
                                    </BlockStack>
                                )}
                            </BlockStack>
                        </Card>



                        <Card>
                            <BlockStack gap="400">
                                <Text as="h3" variant="headingMd">Making Charges Configuration</Text>

                                <Select
                                    label="Assigned Making Group"
                                    options={[
                                        { label: 'None (Use Shop Default)', value: '' },
                                        ...makingGroups.map(g => ({ label: g.name, value: g.id }))
                                    ]}
                                    value={editMakingGroupId}
                                    onChange={setEditMakingGroupId}
                                    helpText="Select a Making Group to apply its pricing rules. Can be overriden below."
                                />

                                <Text as="h4" variant="headingSm">Override (Optional)</Text>
                                <Select
                                    label="Charge Type"
                                    options={[
                                        { label: 'Use Shop Default', value: '' },
                                        { label: 'Per Gram', value: 'per_gram' },
                                        { label: 'Percentage', value: 'percent' },
                                        { label: 'Flat Rate', value: 'flat' },
                                    ]}
                                    value={editMakingChargeType}
                                    onChange={setEditMakingChargeType}
                                />
                                {editMakingChargeType && (
                                    <TextField
                                        label="Value"
                                        type="number"
                                        value={editMakingChargeValue}
                                        onChange={setEditMakingChargeValue}
                                        autoComplete="off"
                                        prefix={editMakingChargeType === 'percent' ? '' : '₹'}
                                        suffix={editMakingChargeType === 'percent' ? '%' : ''}
                                        helpText={
                                            editMakingChargeType === 'per_gram' ? '₹ per gram' :
                                                editMakingChargeType === 'percent' ? '% of metal value' : 'Fixed amount'
                                        }
                                    />
                                )}
                            </BlockStack>
                        </Card>

                        <Card>
                            <BlockStack gap="400">
                                <Text as="h3" variant="headingMd">Discount Overrides</Text>

                                <BlockStack gap="200">
                                    <Text variant="headingSm" as="h4">Metal Discount</Text>
                                    <Select
                                        label="Type"
                                        options={[
                                            { label: 'Use Shop Default', value: 'none' },
                                            { label: 'Percentage (%)', value: 'percent' },
                                            { label: 'Flat Amount (₹)', value: 'flat' },
                                        ]}
                                        value={editMetalDiscountType}
                                        onChange={setEditMetalDiscountType}
                                    />
                                    {editMetalDiscountType !== 'none' && (
                                        <TextField
                                            label="Value"
                                            type="number"
                                            value={editMetalDiscountValue}
                                            onChange={setEditMetalDiscountValue}
                                            prefix={editMetalDiscountType === 'flat' ? '₹' : ''}
                                            suffix={editMetalDiscountType === 'percent' ? '%' : ''}
                                            autoComplete="off"
                                        />
                                    )}
                                </BlockStack>

                                <BlockStack gap="200">
                                    <Text variant="headingSm" as="h4">Making Charge Discount</Text>
                                    <Select
                                        label="Type"
                                        options={[
                                            { label: 'Use Shop Default', value: 'none' },
                                            { label: 'Percentage (%)', value: 'percent' },
                                            { label: 'Flat Amount (₹)', value: 'flat' },
                                        ]}
                                        value={editMakingDiscountType}
                                        onChange={setEditMakingDiscountType}
                                    />
                                    {editMakingDiscountType !== 'none' && (
                                        <TextField
                                            label="Value"
                                            type="number"
                                            value={editMakingDiscountValue}
                                            onChange={setEditMakingDiscountValue}
                                            prefix={editMakingDiscountType === 'flat' ? '₹' : ''}
                                            suffix={editMakingDiscountType === 'percent' ? '%' : ''}
                                            autoComplete="off"
                                        />
                                    )}
                                </BlockStack>

                                <BlockStack gap="200">
                                    <Text variant="headingSm" as="h4">Gemstone Discount</Text>
                                    <Select
                                        label="Type"
                                        options={[
                                            { label: 'Use Shop Default', value: 'none' },
                                            { label: 'Percentage (%)', value: 'percent' },
                                            { label: 'Flat Amount (₹)', value: 'flat' },
                                        ]}
                                        value={editGemstoneDiscountType}
                                        onChange={setEditGemstoneDiscountType}
                                    />
                                    {editGemstoneDiscountType !== 'none' && (
                                        <TextField
                                            label="Value"
                                            type="number"
                                            value={editGemstoneDiscountValue}
                                            onChange={setEditGemstoneDiscountValue}
                                            prefix={editGemstoneDiscountType === 'flat' ? '₹' : ''}
                                            suffix={editGemstoneDiscountType === 'percent' ? '%' : ''}
                                            autoComplete="off"
                                        />
                                    )}
                                </BlockStack>

                                <BlockStack gap="200">
                                    <Text variant="headingSm" as="h4">Enamel Discount</Text>
                                    <Select
                                        label="Type"
                                        options={[
                                            { label: 'Use Shop Default', value: 'none' },
                                            { label: 'Percentage (%)', value: 'percent' },
                                            { label: 'Flat Amount (₹)', value: 'flat' },
                                        ]}
                                        value={editEnamelDiscountType}
                                        onChange={setEditEnamelDiscountType}
                                    />
                                    {editEnamelDiscountType !== 'none' && (
                                        <TextField
                                            label="Value"
                                            type="number"
                                            value={editEnamelDiscountValue}
                                            onChange={setEditEnamelDiscountValue}
                                            prefix={editEnamelDiscountType === 'flat' ? '₹' : ''}
                                            suffix={editEnamelDiscountType === 'percent' ? '%' : ''}
                                            autoComplete="off"
                                        />
                                    )}
                                </BlockStack>

                                <BlockStack gap="200">
                                    <Text variant="headingSm" as="h4">Overall Product Discount</Text>
                                    <InlineStack gap="300" wrap={false}>
                                        <div style={{ flex: 1 }}>
                                            <Select
                                                label="Type"
                                                options={[
                                                    { label: 'Amount (₹)', value: 'flat' },
                                                    { label: 'Percentage (%)', value: 'percent' },
                                                ]}
                                                value={editDiscountType}
                                                onChange={setEditDiscountType}
                                            />
                                        </div>
                                        <div style={{ flex: 2 }}>
                                            <TextField
                                                label="Value"
                                                type="number"
                                                value={editDiscount}
                                                onChange={setEditDiscount}
                                                prefix={editDiscountType === 'flat' ? '₹' : ''}
                                                suffix={editDiscountType === 'percent' ? '%' : ''}
                                                autoComplete="off"
                                                helpText={`Applied as ${editDiscountType} discount after GST.`}
                                            />
                                        </div>
                                    </InlineStack>
                                </BlockStack>


                            </BlockStack>
                        </Card>

                        <>
                            <Text as="h3" variant="headingMd">Price Breakdown (Updated)</Text>
                            <Card>
                                {priceBreakdown ? (
                                    <>
                                        <BlockStack gap="200">
                                            <Text as="p" fontWeight="semibold">Calculation Details</Text>
                                            <div style={{ border: '1px solid #e1e3e5', borderRadius: '8px', overflow: 'hidden' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                    <thead>
                                                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e1e3e5' }}>
                                                            <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Component</th>
                                                            <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr style={{ borderBottom: '1px solid #f1f2f3' }}>
                                                            <td style={{ padding: '8px 16px' }}>
                                                                {priceBreakdown.metal_name || 'Metal'} Price
                                                                {priceBreakdown.has_metal_discount && <Badge tone="critical">Sale</Badge>}
                                                                <div style={{ color: '#6d7175', fontSize: '12px' }}>(₹{(priceBreakdown.metal_rate / 100).toFixed(2)}/g)</div>
                                                            </td>
                                                            <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                                                                {priceBreakdown.has_metal_discount && (
                                                                    <div style={{ textDecoration: 'line-through', color: '#8c9196', fontSize: '12px' }}>
                                                                        ₹{((priceBreakdown.metal_value_original || 0) / 100).toFixed(2)}
                                                                    </div>
                                                                )}
                                                                ₹{(priceBreakdown.metal_value / 100).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                        <tr style={{ borderBottom: '1px solid #f1f2f3' }}>
                                                            <td style={{ padding: '8px 16px' }}>
                                                                Wastage <span style={{ color: '#6d7175', fontSize: '12px' }}>({priceBreakdown.wastage_pct}%)</span>
                                                            </td>
                                                            <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                                                                ₹{(priceBreakdown.wastage_amount / 100).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                        <tr style={{ borderBottom: '1px solid #f1f2f3' }}>
                                                            <td style={{ padding: '8px 16px' }}>
                                                                Making Charges
                                                                {priceBreakdown.has_making_discount && <Badge tone="critical">Sale</Badge>}
                                                                <div style={{ color: '#6d7175', fontSize: '12px' }}>
                                                                    {priceBreakdown.making_charge_type === 'percent'
                                                                        ? `${priceBreakdown.making_charge_rate}% of value`
                                                                        : priceBreakdown.making_charge_type === 'flat'
                                                                            ? 'Flat Rate'
                                                                            : `₹${priceBreakdown.making_charge_rate}/g`
                                                                    }
                                                                </div>
                                                            </td>
                                                            <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                                                                {priceBreakdown.has_making_discount && (
                                                                    <div style={{ textDecoration: 'line-through', color: '#8c9196', fontSize: '12px' }}>
                                                                        ₹{((priceBreakdown.making_charges_original || 0) / 100).toFixed(2)}
                                                                    </div>
                                                                )}
                                                                ₹{(priceBreakdown.making_charges / 100).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                        {priceBreakdown.gemstone_details?.type === 'multiple' && (priceBreakdown.gemstone_details as any).gemstones ? (
                                                            (priceBreakdown.gemstone_details as any).gemstones.map((gem: any, idx: number) => {
                                                                // CZ EXCEPTION: Show in grams if type is CZ Cubic Zirconia
                                                                const gemTypeSafe = (gem.type || '').toLowerCase();
                                                                const isCZ = gemTypeSafe.includes('cubic zirconia') || gemTypeSafe.includes('cz');
                                                                const weightUnit = isCZ ? 'gm' : 'ct';
                                                                const rateUnit = isCZ ? 'gm' : 'ct';

                                                                return (
                                                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f2f3' }}>
                                                                        <td style={{ padding: '8px 16px' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                                                <span style={{ fontWeight: 500 }}>
                                                                                    {getGemstoneDisplayName(gem.type || '').replace(/_/g, ' ')} {gem.clarity && `(${gem.clarity})`} {gem.color} {gem.cut}
                                                                                </span>
                                                                                {gem.hasDiscount && <Badge tone="critical">Sale</Badge>}
                                                                                {gem.isCustom && <Badge tone="info" size="small">CUSTOM</Badge>}
                                                                            </div>
                                                                            {gem.rateNotSet ? (
                                                                                <div style={{ color: '#d72c0d', fontSize: '12px', fontWeight: 600 }}>
                                                                                    ⚠️ Rate not set - Add in Rates page
                                                                                </div>
                                                                            ) : gem.weight ? (
                                                                                <div style={{ color: '#6d7175', fontSize: '12px' }}>
                                                                                    {gem.weight}{weightUnit} × ₹{((gem.cost / 100 / gem.weight) || 0).toLocaleString()}/{rateUnit}
                                                                                </div>
                                                                            ) : gem.pieces ? (
                                                                                <div style={{ color: '#6d7175', fontSize: '12px' }}>
                                                                                    {gem.pieces} pcs × ₹{((gem.cost / 100 / gem.pieces) || 0).toLocaleString()}/pc
                                                                                </div>
                                                                            ) : null}
                                                                        </td>
                                                                        <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                                                                            {gem.rateNotSet ? (
                                                                                <span style={{ color: '#d72c0d' }}>₹0.00</span>
                                                                            ) : (
                                                                                <>
                                                                                    {gem.hasDiscount && (
                                                                                        <div style={{ textDecoration: 'line-through', color: '#8c9196', fontSize: '12px' }}>
                                                                                            ₹{(gem.cost / 100).toFixed(2)}
                                                                                        </div>
                                                                                    )}
                                                                                    ₹{(gem.finalCost / 100).toFixed(2)}
                                                                                </>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            })
                                                        ) : (priceBreakdown.gemstone_price !== undefined || priceBreakdown.gemstone_price_original !== undefined) ? (
                                                            <tr style={{ borderBottom: '1px solid #f1f2f3' }}>
                                                                <td style={{ padding: '8px 16px' }}>
                                                                    {priceBreakdown.gemstone_name || 'Gemstone'}
                                                                    {priceBreakdown.has_gemstone_discount && <Badge tone="critical">Sale</Badge>}
                                                                    {(() => {
                                                                        const isCZ = (priceBreakdown.gemstone_name?.toLowerCase().includes('cubic zirconia') || priceBreakdown.gemstone_name?.toLowerCase().includes('cz'));
                                                                        const weightUnit = isCZ ? 'gm' : 'ct';
                                                                        const rateUnit = isCZ ? 'gm' : 'ct';

                                                                        return (
                                                                            <>
                                                                                {priceBreakdown.gemstone_details?.type === 'per_carat' && (
                                                                                    <div style={{ color: '#6d7175', fontSize: '12px' }}>
                                                                                        {priceBreakdown.gemstone_details.weight}{weightUnit} × ₹{(priceBreakdown.gemstone_details.rate || 0).toLocaleString()}/{rateUnit}
                                                                                    </div>
                                                                                )}
                                                                                {priceBreakdown.gemstone_details?.type === 'per_piece' && (
                                                                                    <div style={{ color: '#6d7175', fontSize: '12px' }}>
                                                                                        {priceBreakdown.gemstone_details.pieces} pcs × ₹{(priceBreakdown.gemstone_details.rate || 0).toLocaleString()}/pc
                                                                                    </div>
                                                                                )}
                                                                                {priceBreakdown.gemstone_details?.type === 'manual' && (
                                                                                    <div style={{ color: '#6d7175', fontSize: '12px' }}>
                                                                                        Gemstone Pricing Source: Manual (Per Piece)
                                                                                    </div>
                                                                                )}
                                                                                {priceBreakdown.gemstone_details?.type !== 'manual' && (
                                                                                    <div style={{ color: '#6d7175', fontSize: '12px' }}>
                                                                                        Gemstone Pricing Source: Rate-Based
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </td>
                                                                <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                                                                    {priceBreakdown.has_gemstone_discount && (
                                                                        <div style={{ textDecoration: 'line-through', color: '#8c9196', fontSize: '12px' }}>
                                                                            ₹{((priceBreakdown.gemstone_price_original || 0) / 100).toFixed(2)}
                                                                        </div>
                                                                    )}
                                                                    ₹{((priceBreakdown.gemstone_price || 0) / 100).toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        ) : null}
                                                        <tr style={{ backgroundColor: '#fafbfb', borderTop: '1px solid #e1e3e5' }}>
                                                            <td style={{ padding: '8px 16px', fontWeight: 600 }}>Subtotal</td>
                                                            <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600 }}>
                                                                ₹{(priceBreakdown.subtotal / 100).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style={{ padding: '8px 16px' }}>
                                                                GST <span style={{ color: '#6d7175', fontSize: '12px' }}>({priceBreakdown.gst_pct}%)</span>
                                                            </td>
                                                            <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                                                                ₹{(priceBreakdown.gst_amount / 100).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                        {priceBreakdown.discount > 0 && (
                                                            <tr>
                                                                <td style={{ padding: '8px 16px', color: '#d82c0d' }}>
                                                                    Shop Discount ({priceBreakdown.global_discount_value || 0}{priceBreakdown.global_discount_type === 'percent' ? '%' : '₹'})
                                                                </td>
                                                                <td style={{ padding: '8px 16px', textAlign: 'right', color: '#d82c0d' }}>
                                                                    -₹{(priceBreakdown.discount / 100).toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        )}
                                                        {(priceBreakdown.product_discount || 0) > 0 ? (
                                                            <tr>
                                                                <td style={{ padding: '8px 16px', color: '#d82c0d' }}>
                                                                    Product Discount ({priceBreakdown.product_discount_value || 0}{priceBreakdown.product_discount_type === 'percent' ? '%' : '₹'})
                                                                </td>
                                                                <td style={{ padding: '8px 16px', textAlign: 'right', color: '#d82c0d' }}>
                                                                    -₹{((priceBreakdown.product_discount || 0) / 100).toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        ) : null}


                                                        <tr style={{ backgroundColor: '#f0fdf4', borderTop: '1px solid #ced4da' }}>
                                                            <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '15px', color: '#008060' }}>Final Price</td>
                                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: '15px', color: '#008060' }}>
                                                                {priceBreakdown.has_any_discount && (
                                                                    <div style={{ textDecoration: 'line-through', color: '#8c9196', fontSize: '12px', fontWeight: 400 }}>
                                                                        ₹{((priceBreakdown.total_original || 0) / 100).toFixed(2)}
                                                                    </div>
                                                                )}
                                                                ₹{(priceBreakdown.total / 100).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </BlockStack>
                                    </>
                                ) : (
                                    <div style={{ padding: '24px', textAlign: 'center' }}>
                                        <BlockStack gap="200" align="center">
                                            <Text as="p" variant="bodyMd" tone="subdued" fontWeight="bold">
                                                Price breakdown unavailable
                                            </Text>
                                            <Text as="p" variant="bodySm" tone="subdued">
                                                Map the product's Weight, Metal, and Karat to see the cost analysis.
                                            </Text>
                                        </BlockStack>
                                    </div>
                                )}
                            </Card>
                        </>
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

            {/* Gemstone Modal */}
            <Modal
                open={showGemstoneModal}
                onClose={() => setShowGemstoneModal(false)}
                title={editingGemstoneIndex !== null ? "Edit Gemstone" : "Add Gemstone"}
                primaryAction={{
                    content: 'Save Gemstone',
                    onAction: handleSaveGemstone,
                }}
                secondaryActions={[{
                    content: 'Cancel',
                    onAction: () => setShowGemstoneModal(false),
                }]}
            >
                <Modal.Section>
                    <BlockStack gap="400">
                        <div style={{ padding: '8px 0' }}>
                            <Checkbox
                                label="Custom Gemstone (Manual Price)"
                                checked={gemstoneModalIsCustom}
                                onChange={(value: boolean) => setGemstoneModalIsCustom(value)}
                            />
                        </div>

                        {gemstoneModalIsCustom ? (
                            <BlockStack gap="400">
                                <TextField
                                    label="Custom Name"
                                    value={gemstoneModalType}
                                    onChange={setGemstoneModalType}
                                    placeholder="e.g. Blue Accent Stone"
                                    autoComplete="off"
                                />
                                <Select
                                    label="Pricing Method"
                                    options={[
                                        { label: 'Per Carat (Weight Based)', value: 'perCarat' },
                                        { label: 'Per Piece (Quantity Based)', value: 'perPiece' },
                                    ]}
                                    value={gemstoneModalPricingType || 'perPiece'} // Default to perPiece if null
                                    onChange={(val) => setGemstoneModalPricingType(val as any)}
                                />
                            </BlockStack>
                        ) : (
                            <Select
                                label="Gemstone Type"
                                options={getUniqueGemstoneTypes()}
                                value={gemstoneModalType}
                                onChange={setGemstoneModalType}
                                placeholder="Select gemstone type"
                            />
                        )}

                        <Select
                            label="Stone Type (Optional)"
                            options={[
                                { label: 'None', value: '' },
                                { label: 'Natural', value: 'natural' },
                                { label: 'Labgrown', value: 'labgrown' },
                            ]}
                            value={gemstoneModalNaturalOrLabgrown}
                            onChange={setGemstoneModalNaturalOrLabgrown}
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
                            value={gemstoneModalQuality}
                            onChange={setGemstoneModalQuality}
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
                            value={gemstoneModalShape}
                            onChange={setGemstoneModalShape}
                        />

                        <Select
                            label="Cut (Optional)"
                            options={getAvailableCuts()}
                            value={gemstoneModalCut}
                            onChange={setGemstoneModalCut}
                            disabled={!gemstoneModalType}
                        />

                        <TextField
                            label="Color (Optional/Description)"
                            value={gemstoneModalColor}
                            onChange={setGemstoneModalColor}
                            placeholder="e.g. D-E, Intense Blue, or Mix"
                            autoComplete="off"
                        />

                        <Select
                            label="Clarity (Optional)"
                            options={getAvailableClarities()}
                            value={gemstoneModalClarity}
                            onChange={setGemstoneModalClarity}
                            disabled={!gemstoneModalType}
                        />

                        <Select
                            label="Carat Range (Optional)"
                            options={getAvailableCaratRanges()}
                            value={gemstoneModalCaratRange}
                            onChange={setGemstoneModalCaratRange}
                            helpText="Select the carat range that matches your rate configuration"
                            disabled={!gemstoneModalType}
                        />


                        {gemstoneModalIsCustom && (gemstoneModalPricingType as string) !== 'perCarat' && (
                            <TextField
                                label="Price Per Piece"
                                type="number"
                                value={gemstoneModalPricePerPiece}
                                onChange={setGemstoneModalPricePerPiece}
                                placeholder="Enter manual price per piece"
                                autoComplete="off"
                                prefix="₹"
                                helpText="Total = Price Per Piece × Pieces"
                            />
                        )}

                        {gemstoneModalIsCustom && gemstoneModalPricingType === 'perCarat' && (
                            <TextField
                                label="Price Per Carat"
                                type="number"
                                value={gemstoneModalPricePerCarat}
                                onChange={setGemstoneModalPricePerCarat}
                                placeholder="Enter manual price per carat"
                                autoComplete="off"
                                prefix="₹"
                                helpText="Total = Price Per Carat × Weight"
                            />
                        )}

                        {gemstoneModalType && (
                            <TextField
                                label={
                                    (gemstoneModalType.toLowerCase().includes('cz') || gemstoneModalType.toLowerCase().includes('cubic zirconia'))
                                        ? "Weight (grams)"
                                        : "Weight (carats)"
                                }
                                type="number"
                                value={gemstoneModalWeight}
                                onChange={setGemstoneModalWeight}
                                placeholder={
                                    (gemstoneModalType.toLowerCase().includes('cz') || gemstoneModalType.toLowerCase().includes('cubic zirconia'))
                                        ? "Enter weight in grams"
                                        : "Enter weight in carats"
                                }
                                autoComplete="off"
                                helpText="Enter stone weight for pricing and gross weight calculation"
                            />
                        )}

                        {(gemstoneModalPricingType === 'perPiece' || gemstoneModalIsCustom) && (
                            <TextField
                                label={gemstoneModalIsCustom ? "Number of Pieces (Required)" : "Number of Pieces"}
                                type="number"
                                value={gemstoneModalPieces}
                                onChange={setGemstoneModalPieces}
                                placeholder="Enter number of pieces"
                                autoComplete="off"
                                helpText={gemstoneModalIsCustom ? "Total = Price Per Piece × Pieces" : "Price will be calculated as: Rate × Number of Pieces"}
                            />
                        )}

                        {!gemstoneModalPricingType && gemstoneModalType && !gemstoneModalIsCustom && (
                            <div style={{ padding: '12px', background: '#fef3cd', border: '1px solid #f0e5a1', borderRadius: '4px' }}>
                                <Text as="p" variant="bodyMd" tone="caution">
                                    ⚠️ No rate found for this gemstone combination. Please add a rate in the Rates page first.
                                </Text>
                            </div>
                        )}

                        {!gemstoneModalType && (
                            <TextField
                                label="Weight (carats) or Pieces"
                                type="number"
                                value={gemstoneModalWeight || gemstoneModalPieces}
                                onChange={(value) => {
                                    setGemstoneModalWeight(value);
                                    setGemstoneModalPieces(value);
                                }}
                                placeholder="Select gemstone type first"
                                autoComplete="off"
                                disabled
                            />
                        )}


                        <Text as="h3" variant="headingSm">Discount Override (Optional)</Text>

                        <Select
                            label="Discount Type"
                            options={[
                                { label: 'Use Product Default', value: '' },
                                { label: 'Percentage', value: 'percent' },
                                { label: 'Flat Amount', value: 'flat' },
                            ]}
                            value={gemstoneModalDiscountType}
                            onChange={setGemstoneModalDiscountType}
                        />

                        {gemstoneModalDiscountType && (
                            <TextField
                                label={`Discount Value ${gemstoneModalDiscountType === 'percent' ? '(%)' : '(₹)'}`}
                                type="number"
                                value={gemstoneModalDiscountValue}
                                onChange={setGemstoneModalDiscountValue}
                                placeholder="Enter discount value"
                                autoComplete="off"
                            />
                        )}
                    </BlockStack>
                </Modal.Section>
            </Modal>
        </Page>
    );
}
