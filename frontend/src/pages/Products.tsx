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

    Badge,
    Thumbnail,
    EmptyState,
    SkeletonBodyText,
    Pagination,
} from '@shopify/polaris';
import { DeleteIcon, EditIcon, ChevronRightIcon, ChevronDownIcon } from '@shopify/polaris-icons';
import api from '../utils/api';
import { useDebounce } from '../utils/useDebounce';

interface ProductGemstone {
    id?: string;
    gemstoneType: string;
    gemstoneCut?: string;
    gemstoneColor?: string;
    gemstoneClarity?: string;
    gemstoneCaratRange?: string;
    gemstoneWeight?: number;
    gemstonePieces?: number;
    discountType?: string;
    discountValue?: number;
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
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>('all');
    const ITEMS_PER_PAGE = 50;

    // Reset pagination when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter]);

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
    const [editGemstoneCaratRange, setEditGemstoneCaratRange] = useState('');
    const [editStonePieces, setEditStonePieces] = useState('');
    const [editStoneWeight, setEditStoneWeight] = useState('');

    // Making Charge Overrides
    const [editMakingChargeType, setEditMakingChargeType] = useState('');
    const [editMakingChargeValue, setEditMakingChargeValue] = useState('');

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
    const [gemstoneModalDiscountType, setGemstoneModalDiscountType] = useState('');
    const [gemstoneModalDiscountValue, setGemstoneModalDiscountValue] = useState('');

    // All configured gemstone rates for dynamic dropdowns
    const [allGemstoneRates, setAllGemstoneRates] = useState<any[]>([]);



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
        fetchAllGemstoneRates();
    }, [debouncedSearch]);

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
                label: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '),
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

    const getAvailableColors = () => {
        if (!gemstoneModalType) return [{ label: 'None', value: '' }];

        const filtered = allGemstoneRates.filter(rate => {
            return rate.stoneType === gemstoneModalType &&
                (!gemstoneModalCut || rate.cut === gemstoneModalCut || !rate.cut);
        });
        const colors = new Set(filtered.map(rate => rate.color).filter(Boolean));

        return [
            { label: 'None', value: '' },
            ...Array.from(colors).map(color => ({ label: color, value: color }))
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
            // PHASE 1: FULL DATASET GROUPING
            // Fetch first page to get metadata and initial data
            const response = await api.get('/products', {
                params: { page: 1, limit: 250, search: debouncedSearch },
            });

            let allProducts = response.data.products || [];
            const { total, limit } = response.data.pagination;

            // Fetch remaining pages if any
            if (total > allProducts.length) {
                const totalPages = Math.ceil(total / limit);
                const pagePromises = [];

                // Construct promises for all remaining pages
                for (let i = 2; i <= totalPages; i++) {
                    pagePromises.push(api.get('/products', {
                        params: { page: i, limit, search: debouncedSearch },
                    }));
                }

                // Execute all requests in parallel
                const responses = await Promise.all(pagePromises);

                // Combine results
                responses.forEach(res => {
                    if (res.data.products) {
                        allProducts = [...allProducts, ...res.data.products];
                    }
                });
            }

            // Update state with FULL dataset
            setProducts(allProducts);

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
                makingChargeType: editMakingChargeType || undefined,
                makingChargeValue: editMakingChargeValue && parseFloat(editMakingChargeValue) > 0 ? parseFloat(editMakingChargeValue) : undefined,
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
        setGemstoneModalDiscountType('');
        setGemstoneModalDiscountValue('');
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
        setGemstoneModalDiscountType(gem.discountType || '');
        setGemstoneModalDiscountValue(gem.discountValue?.toString() || '');
        setShowGemstoneModal(true);
    };

    const handleSaveGemstone = () => {
        if (!gemstoneModalType) return;

        const newGemstone: ProductGemstone = {
            gemstoneType: gemstoneModalType,
            gemstoneCut: gemstoneModalCut || undefined,
            gemstoneColor: gemstoneModalColor || undefined,
            gemstoneClarity: gemstoneModalClarity || undefined,
            gemstoneCaratRange: gemstoneModalCaratRange || undefined,
            gemstoneWeight: gemstoneModalWeight ? parseFloat(gemstoneModalWeight) : undefined,
            gemstonePieces: gemstoneModalPieces ? parseInt(gemstoneModalPieces) : undefined,
            discountType: gemstoneModalDiscountType || undefined,
            discountValue: gemstoneModalDiscountValue ? parseFloat(gemstoneModalDiscountValue) : undefined,
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
        setEditStonePieces(product.stonePieces?.toString() || '');
        setEditStoneWeight(product.stoneWeightCarat?.toString() || '');

        setEditMakingChargeType(product.makingChargeType || '');
        setEditMakingChargeValue(product.makingChargeValue?.toString() || '');

        setEditIsManualGemstonePrice(product.isManualGemstonePrice || false);
        setEditManualGemstoneWeight(product.manualGemstoneWeight?.toString() || '');
        setEditManualGemstonePrice(product.manualGemstonePrice?.toString() || '');

        setEditMetalDiscountType(product.metalDiscountType || 'none');
        setEditMetalDiscountValue(product.metalDiscountValue?.toString() || '');
        setEditMakingDiscountType(product.makingDiscountType || 'none');
        setEditMakingDiscountValue(product.makingDiscountValue?.toString() || '');
        setEditGemstoneDiscountType(product.gemstoneDiscountType || 'none');
        setEditGemstoneDiscountValue(product.gemstoneDiscountValue?.toString() || '');

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
                makingChargeType: editMakingChargeType || null,
                makingChargeValue: editMakingChargeValue ? parseFloat(editMakingChargeValue) : undefined,
                metalDiscountType: editMetalDiscountType !== 'none' ? editMetalDiscountType : null,
                metalDiscountValue: editMetalDiscountValue ? parseFloat(editMetalDiscountValue) : null,
                makingDiscountType: editMakingDiscountType !== 'none' ? editMakingDiscountType : null,
                makingDiscountValue: editMakingDiscountValue ? parseFloat(editMakingDiscountValue) : null,
                gemstoneDiscountType: editGemstoneDiscountType !== 'none' ? editGemstoneDiscountType : null,
                gemstoneDiscountValue: editGemstoneDiscountValue ? parseFloat(editGemstoneDiscountValue) : null,
                enamelColor: editEnamelColor || null,
                enamelWeightGrams: editEnamelWeightGrams ? parseFloat(editEnamelWeightGrams) : null,
                enamelDiscountType: editEnamelDiscountType !== 'none' ? editEnamelDiscountType : null,
                enamelDiscountValue: editEnamelDiscountValue ? parseFloat(editEnamelDiscountValue) : null,
                gemstones: productGemstones.map(g => ({
                    ...g,
                    gemstoneWeight: g.gemstoneWeight ? parseFloat(g.gemstoneWeight.toString()) : null,
                    discountValue: g.discountValue ? parseFloat(g.discountValue.toString()) : null,
                })),
            });
            setSuccessMessage('Product updated successfully!');
            // Modal stays open as requested by user
            // setShowEditModal(false); // REMOVED
            await fetchProducts(); // Wait for refresh to sync updated price
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

        // Convert file to Base64
        const reader = new FileReader();
        reader.readAsDataURL(importFile);
        reader.onload = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            const fileType = importFile.name.endsWith('.csv') ? 'csv' : 'xlsx';

            try {
                // Send as JSON with Base64 data (matches backend expectation)
                const response = await api.post('/products/import', {
                    fileData: base64Data,
                    fileType: fileType
                });

                setImportResult(response.data);
                if (response.data.success) {
                    setSuccessMessage(`Imported ${response.data.imported} products successfully!`);
                    fetchProducts();
                }
            } catch (error) {
                console.error('Import error:', error);
                setSuccessMessage('Import failed');
            } finally {
                setLoading(false);
            }
        };
        reader.onerror = () => {
            console.error('File reading failed');
            setLoading(false);
            setSuccessMessage('Failed to read file');
        };
    };

    const handleExport = (format: 'csv' | 'xlsx') => {
        // Create anchor element for reliable download
        const baseUrl = api.defaults.baseURL || '/api';
        const url = `${baseUrl}/products/export?format=${format}&t=${Date.now()}`;

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
                    makingChargeType: editMakingChargeType,
                    makingChargeValue: editMakingChargeValue,
                    gemstones: productGemstones, // Include gemstones array
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
        productGemstones, // Add gemstones to dependency array
    ]);

    const formatCurrency = (amount?: number) => {
        if (amount === null || amount === undefined) return '-';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
        }).format(amount);
    };

    // Grouping Helper
    // Grouping Helper (Canonical Rule: No Orphans)
    // Grouping Helper (Canonical Rule: Group by Shopify Product ID)
    const getGroupedRows = () => {
        // Map<shopifyProductId, Product[]>
        const groups = new Map<string, Product[]>();

        const filteredProducts = products.filter(product => {
            if (statusFilter === 'all') return true;
            return product.status?.toLowerCase() === statusFilter;
        });

        filteredProducts.forEach(product => {
            // Use shopifyProductId as the canonical group key
            // This ensures separate Shopify Products with identical titles are NOT merged
            const key = product.shopifyProductId || product.title;

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)?.push(product);
        });

        // FULL VISIBILITY: Render all groups found
        const visibleGroups = Array.from(groups.entries());

        // PAGINATION SLICING
        const totalGroups = visibleGroups.length;
        // totalPages calculated but unused currently
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const paginatedGroups = visibleGroups.slice(startIndex, endIndex);

        // VALIDATION LOGGING
        if (products.length > 0) {
            console.debug('--- GROUPING DEBUG INFO (FIXED) ---');
            console.debug('Total products (Variants):', products.length);
            console.debug('Total unique Shopify Groups:', groups.size);
        }

        const displayRows: any[] = [];

        paginatedGroups.forEach(([groupId, groupProducts], index) => {
            // Calculate global index for # column
            const globalIndex = startIndex + index + 1;
            // Representative is first product (usually main variant)
            const representative = groupProducts[0];
            const baseName = representative.title.trim() || 'Untitled Product';

            // Use groupId (shopifyProductId) for expansion state
            const isExpanded = expandedGroupId === groupId;

            displayRows.push([
                <Text as="span" variant="bodyMd" tone="subdued">{globalIndex}</Text>,
                <div style={{
                    padding: '8px 0',
                    minWidth: '280px',
                }}>
                    <Button
                        plain
                        onClick={() => toggleGroup(groupId)}
                        icon={isExpanded ? ChevronDownIcon : ChevronRightIcon}
                    >
                        <InlineStack align="start" gap="300" blockAlign="center">
                            <div style={{ whiteSpace: 'normal', textAlign: 'left', maxWidth: '400px' }}>
                                <Text as="span" variant="bodyLg" fontWeight="semibold">{baseName}</Text>
                            </div>
                            <div style={{ flexShrink: 0 }}>
                                <Badge tone="info">{`${groupProducts.length} variants`}</Badge>
                            </div>
                        </InlineStack>
                    </Button>
                </div>,
                '', // Status
                '', // SKU
                '', // Title (merged into first cell visual)
                '', // Metal
                '', // Karat
                '', // Weight
                '', // Gemstone
                '', // Price
                ''  // Edit
            ]);

            // Render Children only if expanded
            if (isExpanded) {
                groupProducts.forEach((product) => {
                    displayRows.push(['', ...renderProductRow(product, true)]);
                });
            }
        });

        return { displayRows, totalGroups };
    };

    const renderProductRow = (product: Product, isChild: boolean) => {

        // Simpler guide: Just left border
        const simplifiedIndentStyle = isChild ? {
            paddingLeft: '24px',
            borderLeft: '2px solid #dfe3e8',
            marginLeft: '12px'
        } : {};

        const displayName = product.title; // ALWAYS use full title for children

        return [
            <div style={simplifiedIndentStyle}>
                <InlineStack gap="200" align="start" blockAlign="center">
                    <Thumbnail
                        source={product.imageUrl || 'https://via.placeholder.com/50'}
                        alt={product.title}
                        size="small"
                    />
                </InlineStack>
            </div>,
            <Badge tone={product.status === 'active' ? 'success' : product.status === 'draft' ? 'attention' : 'info'}>
                {product.status || 'unknown'}
            </Badge>,
            <Text as="span" variant="bodySm" tone="subdued">{product.sku || '-'}</Text>,
            <Text as="span" variant="bodyMd" tone={isChild ? 'subdued' : 'base'}>
                {displayName}
                {product.variantTitle && product.variantTitle !== 'Default Title' && (
                    <Text as="span" tone="subdued"> - {product.variantTitle}</Text>
                )}
            </Text>,
            product.metal || '-',
            product.metal === 'gold' && product.karat ? `${product.karat}K` : (product.karat ? `${product.karat}` : '-'),
            product.weightGrams ? `${product.weightGrams}g` : '-',
            product.gemstoneType || '-',
            formatCurrency(product.currentPrice),
            <Button size="slim" onClick={() => handleEditProduct(product)}>
                Edit
            </Button>,
        ];
    };

    const groupedInfo = getGroupedRows();

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
                    onAction: () => {
                        const baseUrl = api.defaults.baseURL || '/api';
                        const url = `${baseUrl}/products/template?format=xlsx&t=${Date.now()}`;
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `products_template.xlsx`;
                        link.style.display = 'none';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setSuccessMessage('Downloading template...');
                        setTimeout(() => setSuccessMessage(''), 3000);
                    },
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
                            title="Error loading products"
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
                                    <DataTable
                                        columnContentTypes={['numeric', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'numeric', 'text']}
                                        headings={['#', 'Image', 'Status', 'SKU', 'Title', 'Metal', 'Karat', 'Weight', 'Gemstone', 'Current Price', 'Action']}
                                        rows={groupedInfo.displayRows}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                                        <Pagination
                                            hasPrevious={currentPage > 1}
                                            onPrevious={() => setCurrentPage(c => c - 1)}
                                            hasNext={currentPage * ITEMS_PER_PAGE < (groupedInfo.totalGroups || 0)}
                                            onNext={() => setCurrentPage(c => c + 1)}
                                            label={`Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, groupedInfo.totalGroups || 0)} of ${groupedInfo.totalGroups || 0} parent groups`}
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
                                                            {gem.gemstoneType}
                                                            {gem.gemstoneClarity && ` (${gem.gemstoneClarity})`}
                                                            {gem.gemstoneColor && ` ${gem.gemstoneColor}`}
                                                            {gem.gemstoneCut && ` ${gem.gemstoneCut}`}
                                                        </Text>
                                                        <Text as="p" variant="bodySm" tone="subdued">
                                                            {gem.gemstoneWeight && `${gem.gemstoneWeight}ct`}
                                                            {gem.gemstoneCaratRange && ` • Range: ${gem.gemstoneCaratRange}`}
                                                            {gem.discountType && ` • Discount: ${gem.discountValue}${gem.discountType === 'percent' ? '%' : '₹'}`}
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
                                <Text as="h3" variant="headingMd">Making Charges (Override)</Text>
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
                            </BlockStack>
                        </Card>

                        <>
                            <Text as="h3" variant="headingMd">Price Breakdown</Text>
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
                                                            (priceBreakdown.gemstone_details as any).gemstones.map((gem: any, idx: number) => (
                                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f2f3' }}>
                                                                    <td style={{ padding: '8px 16px' }}>
                                                                        {gem.type.charAt(0).toUpperCase() + gem.type.slice(1)} {gem.clarity && `(${gem.clarity})`} {gem.color} {gem.cut}
                                                                        {gem.hasDiscount && <Badge tone="critical">Sale</Badge>}
                                                                        {gem.rateNotSet ? (
                                                                            <div style={{ color: '#d72c0d', fontSize: '12px', fontWeight: 600 }}>
                                                                                ⚠️ Rate not set - Add in Rates page
                                                                            </div>
                                                                        ) : gem.weight && (
                                                                            <div style={{ color: '#6d7175', fontSize: '12px' }}>
                                                                                {gem.weight}ct × ₹{((gem.cost / gem.weight) || 0).toLocaleString()}/ct
                                                                            </div>
                                                                        )}
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
                                                            ))
                                                        ) : (priceBreakdown.gemstone_price !== undefined || priceBreakdown.gemstone_price_original !== undefined) ? (
                                                            <tr style={{ borderBottom: '1px solid #f1f2f3' }}>
                                                                <td style={{ padding: '8px 16px' }}>
                                                                    {priceBreakdown.gemstone_name || 'Gemstone'}
                                                                    {priceBreakdown.has_gemstone_discount && <Badge tone="critical">Sale</Badge>}
                                                                    {priceBreakdown.gemstone_details?.type === 'per_carat' && (
                                                                        <div style={{ color: '#6d7175', fontSize: '12px' }}>
                                                                            {priceBreakdown.gemstone_details.weight}ct × ₹{(priceBreakdown.gemstone_details.rate || 0).toLocaleString()}/ct
                                                                        </div>
                                                                    )}
                                                                    {priceBreakdown.gemstone_details?.type === 'per_piece' && (
                                                                        <div style={{ color: '#6d7175', fontSize: '12px' }}>
                                                                            {priceBreakdown.gemstone_details.pieces} pcs × ₹{(priceBreakdown.gemstone_details.rate || 0).toLocaleString()}/pc
                                                                        </div>
                                                                    )}
                                                                    {priceBreakdown.gemstone_details?.type === 'manual' && (
                                                                        <div style={{ color: '#6d7175', fontSize: '12px' }}>
                                                                            Manual Price
                                                                        </div>
                                                                    )}
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
                                                                <td style={{ padding: '8px 16px', color: '#d82c0d' }}>Discount</td>
                                                                <td style={{ padding: '8px 16px', textAlign: 'right', color: '#d82c0d' }}>
                                                                    -₹{(priceBreakdown.discount / 100).toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        )}
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
                        <Select
                            label="Gemstone Type"
                            options={getUniqueGemstoneTypes()}
                            value={gemstoneModalType}
                            onChange={setGemstoneModalType}
                        />

                        <Select
                            label="Cut (Optional)"
                            options={getAvailableCuts()}
                            value={gemstoneModalCut}
                            onChange={setGemstoneModalCut}
                            disabled={!gemstoneModalType}
                        />

                        <Select
                            label="Color (Optional)"
                            options={getAvailableColors()}
                            value={gemstoneModalColor}
                            onChange={setGemstoneModalColor}
                            disabled={!gemstoneModalType}
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


                        {gemstoneModalPricingType === 'perCarat' && (
                            <TextField
                                label="Weight (carats)"
                                type="number"
                                value={gemstoneModalWeight}
                                onChange={setGemstoneModalWeight}
                                placeholder="Enter weight in carats"
                                autoComplete="off"
                                helpText="Price will be calculated as: Rate × Weight"
                            />
                        )}

                        {gemstoneModalPricingType === 'perPiece' && (
                            <TextField
                                label="Number of Pieces"
                                type="number"
                                value={gemstoneModalPieces}
                                onChange={setGemstoneModalPieces}
                                placeholder="Enter number of pieces"
                                autoComplete="off"
                                helpText="Price will be calculated as: Rate × Number of Pieces"
                            />
                        )}

                        {!gemstoneModalPricingType && gemstoneModalType && (
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
