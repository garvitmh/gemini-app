import { useState, useCallback, useEffect } from 'react';
import {
    Page,
    Card,
    DataTable,
    Button,
    Modal,
    TextField,
    Select,
    Banner,
    Text,
    EmptyState,
    ButtonGroup,
    InlineStack,
    BlockStack,
    Thumbnail,
    Checkbox,
    Spinner,
    Badge,
    Pagination,
    Tooltip,
    Icon,
} from '@shopify/polaris';
import { PlusIcon, SearchIcon } from '@shopify/polaris-icons';
import api from '../utils/api';
import CollectionFilter from '../components/CollectionFilter';

interface MakingGroup {
    id: string;
    name: string;
    type: string;
    value: number;
    createdAt: string;
    _count?: {
        products: number;
    };
}

interface ProductForAssignment {
    id: string;
    sku: string | null;
    title: string;
    imageUrl: string | null;
    makingGroupId: string | null;
    isAssigned: boolean;
    assignedToCurrentGroup: boolean;
    assignedToOtherGroup: boolean;
    assignedGroupName: string | null;
}

export default function MakingGroups() {
    const [makingGroups, setMakingGroups] = useState<MakingGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Create/Edit Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState<MakingGroup | null>(null);
    const [formName, setFormName] = useState('');
    const [formType, setFormType] = useState('per_gram');
    const [formValue, setFormValue] = useState('');

    // Delete confirmation
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingGroup, setDeletingGroup] = useState<MakingGroup | null>(null);

    // Product Assignment Modal state
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assigningGroup, setAssigningGroup] = useState<MakingGroup | null>(null);
    const [assignProducts, setAssignProducts] = useState<ProductForAssignment[]>([]);
    const [assignLoading, setAssignLoading] = useState(false);
    const [assignSearch, setAssignSearch] = useState('');
    const [assignCollectionId, setAssignCollectionId] = useState('');
    const [assignPage, setAssignPage] = useState(1);
    const [assignTotalPages, setAssignTotalPages] = useState(1);
    const [assignTotal, setAssignTotal] = useState(0);
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
    const [originalAssignedIds, setOriginalAssignedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchMakingGroups();
    }, []);

    const fetchMakingGroups = async () => {
        try {
            setLoading(true);
            const response = await api.get('/making-groups');
            setMakingGroups(response.data.makingGroups || []);
        } catch (err: any) {
            console.error('Error fetching making groups:', err);
            setError(err.response?.data?.error || 'Failed to fetch making groups');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingGroup(null);
        setFormName('');
        setFormType('per_gram');
        setFormValue('');
        setShowModal(true);
    };

    const handleEdit = (group: MakingGroup) => {
        setEditingGroup(group);
        setFormName(group.name);
        setFormType(group.type);
        setFormValue(group.value.toString());
        setShowModal(true);
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            setError('');

            const data = {
                name: formName.trim(),
                type: formType,
                value: parseFloat(formValue),
            };

            if (editingGroup) {
                await api.put(`/making-groups/${editingGroup.id}`, data);
                setSuccessMessage('Making group updated successfully');
            } else {
                await api.post('/making-groups', data);
                setSuccessMessage('Making group created successfully');
            }

            setShowModal(false);
            fetchMakingGroups();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            console.error('Error saving making group:', err);
            setError(err.response?.data?.error || 'Failed to save making group');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (group: MakingGroup) => {
        setDeletingGroup(group);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deletingGroup) return;

        try {
            setLoading(true);
            setError('');
            await api.delete(`/making-groups/${deletingGroup.id}`);
            setSuccessMessage('Making group deleted successfully');
            setShowDeleteModal(false);
            setDeletingGroup(null);
            fetchMakingGroups();
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err: any) {
            console.error('Error deleting making group:', err);
            setError(err.response?.data?.error || 'Failed to delete making group');
        } finally {
            setLoading(false);
        }
    };

    // ==================== PRODUCT ASSIGNMENT HANDLERS ====================

    const handleManageProducts = async (group: MakingGroup) => {
        setAssigningGroup(group);
        setAssignSearch('');
        setAssignCollectionId('');
        setAssignPage(1);
        setSelectedProductIds(new Set());
        setOriginalAssignedIds(new Set());
        setShowAssignModal(true);
        await fetchProductsForAssignment(group.id, 1, '');
    };

    const fetchProductsForAssignment = async (groupId: string, page: number, search: string) => {
        try {
            setAssignLoading(true);
            const response = await api.get('/products/for-assignment', {
                params: {
                    page,
                    limit: 10,
                    search: search || undefined,
                    excludeGroupId: groupId,
                    collectionId: assignCollectionId || undefined,
                }
            });

            const products = response.data.products || [];
            setAssignProducts(products);
            setAssignTotalPages(response.data.pagination?.pages || 1);
            setAssignTotal(response.data.pagination?.total || 0);

            // On first load, track which products are already assigned to this group
            if (page === 1 && !search) {
                const alreadyAssigned = new Set<string>(
                    products
                        .filter((p: ProductForAssignment) => p.assignedToCurrentGroup)
                        .map((p: ProductForAssignment) => p.id)
                );
                setOriginalAssignedIds(alreadyAssigned);
                setSelectedProductIds(new Set(alreadyAssigned));
            } else {
                // For page changes/searches, maintain selection state
                const newSelected = new Set(selectedProductIds);
                products.forEach((p: ProductForAssignment) => {
                    if (p.assignedToCurrentGroup) {
                        newSelected.add(p.id);
                    }
                });
                setSelectedProductIds(newSelected);
            }
        } catch (err: any) {
            console.error('Error fetching products for assignment:', err);
            setError(err.response?.data?.error || 'Failed to fetch products');
        } finally {
            setAssignLoading(false);
        }
    };

    const handleAssignSearchChange = useCallback((value: string) => {
        setAssignSearch(value);
    }, []);

    const handleAssignSearchSubmit = () => {
        setAssignPage(1);
        if (assigningGroup) {
            fetchProductsForAssignment(assigningGroup.id, 1, assignSearch);
        }
    };

    // Effect to refetch when collection changes, but only if modal is open
    useEffect(() => {
        if (showAssignModal && assigningGroup) {
            setAssignPage(1);
            fetchProductsForAssignment(assigningGroup.id, 1, assignSearch);
        }
    }, [assignCollectionId]);

    const handleAssignPageChange = (newPage: number) => {
        setAssignPage(newPage);
        if (assigningGroup) {
            fetchProductsForAssignment(assigningGroup.id, newPage, assignSearch);
        }
    };

    const handleProductCheckChange = (productId: string, checked: boolean) => {
        const newSelected = new Set(selectedProductIds);
        if (checked) {
            newSelected.add(productId);
        } else {
            newSelected.delete(productId);
        }
        setSelectedProductIds(newSelected);
    };

    const handleAssignSave = async () => {
        if (!assigningGroup) return;

        try {
            setAssignLoading(true);
            setError('');

            // Determine which products to add and remove
            const toAdd = Array.from(selectedProductIds).filter(id => !originalAssignedIds.has(id));
            const toRemove = Array.from(originalAssignedIds).filter(id => !selectedProductIds.has(id));

            let messages: string[] = [];

            // Assign new products
            if (toAdd.length > 0) {
                const assignResponse = await api.post(`/making-groups/${assigningGroup.id}/assign-products`, {
                    productIds: toAdd,
                });
                messages.push(assignResponse.data.message);
            }

            // Remove unselected products
            if (toRemove.length > 0) {
                const removeResponse = await api.post(`/making-groups/${assigningGroup.id}/remove-products`, {
                    productIds: toRemove,
                });
                messages.push(removeResponse.data.message);
            }

            if (messages.length > 0) {
                setSuccessMessage(messages.join('. '));
            } else {
                setSuccessMessage('No changes to save');
            }

            setShowAssignModal(false);
            fetchMakingGroups();
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (err: any) {
            console.error('Error saving product assignments:', err);
            const errorMsg = err.response?.data?.error || 'Failed to save product assignments';
            const conflicts = err.response?.data?.conflictingProducts;
            if (conflicts && conflicts.length > 0) {
                const conflictNames = conflicts.map((c: any) => c.title).slice(0, 3).join(', ');
                setError(`${errorMsg}: ${conflictNames}${conflicts.length > 3 ? '...' : ''}`);
            } else {
                setError(errorMsg);
            }
        } finally {
            setAssignLoading(false);
        }
    };

    // ==================== END PRODUCT ASSIGNMENT HANDLERS ====================

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'per_gram':
                return 'Per Gram';
            case 'flat':
                return 'Flat';
            case 'percent':
                return 'Percent';
            default:
                return type;
        }
    };

    const formatValue = (type: string, value: number) => {
        if (type === 'percent') {
            return `${value}%`;
        } else if (type === 'flat') {
            return `₹${value}`;
        } else {
            return `₹${value}/g`;
        }
    };

    const rows = makingGroups.map((group) => [
        group.name,
        getTypeLabel(group.type),
        formatValue(group.type, group.value),
        <Button size="slim" onClick={() => handleManageProducts(group)}>
            {String(group._count?.products || 0)} products
        </Button>,
        <ButtonGroup>
            <Button size="slim" onClick={() => handleEdit(group)}>
                Edit
            </Button>
            <Button
                size="slim"
                tone="critical"
                onClick={() => handleDeleteClick(group)}
            >
                Delete
            </Button>
        </ButtonGroup>,
    ]);

    return (
        <Page
            title="Making Groups"
            subtitle="Manage making charge configurations for product groups"
            primaryAction={{
                content: 'Create Making Group',
                icon: PlusIcon,
                onAction: handleCreate,
            }}
        >
            <BlockStack gap="400">
                {error && (
                    <Banner tone="critical" onDismiss={() => setError('')}>
                        <p>{error}</p>
                    </Banner>
                )}
                {successMessage && (
                    <Banner tone="success" onDismiss={() => setSuccessMessage('')}>
                        <p>{successMessage}</p>
                    </Banner>
                )}

                <Card>
                    {makingGroups.length === 0 && !loading ? (
                        <EmptyState
                            heading="No making groups yet"
                            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                        >
                            <p>
                                Create making groups to apply consistent making charges across
                                multiple products.
                            </p>
                            <Button onClick={handleCreate}>Create Making Group</Button>
                        </EmptyState>
                    ) : (
                        <DataTable
                            columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                            headings={['Name', 'Type', 'Value', 'Products', 'Actions']}
                            rows={rows}
                        />
                    )}
                </Card>
            </BlockStack>

            {/* Create/Edit Modal */}
            <Modal
                open={showModal}
                onClose={() => setShowModal(false)}
                title={editingGroup ? 'Edit Making Group' : 'Create Making Group'}
                primaryAction={{
                    content: editingGroup ? 'Update' : 'Create',
                    onAction: handleSave,
                    loading,
                    disabled: !formName.trim() || !formValue || parseFloat(formValue) <= 0,
                }}
                secondaryActions={[
                    {
                        content: 'Cancel',
                        onAction: () => setShowModal(false),
                    },
                ]}
            >
                <Modal.Section>
                    <BlockStack gap="400">
                        <TextField
                            label="Name"
                            value={formName}
                            onChange={setFormName}
                            placeholder="e.g., Premium Gold Making"
                            autoComplete="off"
                            requiredIndicator
                        />

                        <Select
                            label="Type"
                            options={[
                                { label: 'Per Gram (₹/g)', value: 'per_gram' },
                                { label: 'Flat Amount (₹)', value: 'flat' },
                                { label: 'Percent (%)', value: 'percent' },
                            ]}
                            value={formType}
                            onChange={setFormType}
                            requiredIndicator
                        />

                        <TextField
                            label="Value"
                            type="number"
                            value={formValue}
                            onChange={setFormValue}
                            placeholder="Enter value"
                            autoComplete="off"
                            requiredIndicator
                            helpText={
                                formType === 'per_gram'
                                    ? 'Making charge per gram'
                                    : formType === 'flat'
                                        ? 'Fixed making charge amount'
                                        : 'Percentage of metal value'
                            }
                        />
                    </BlockStack>
                </Modal.Section>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                open={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete Making Group"
                primaryAction={{
                    content: 'Delete',
                    onAction: handleDeleteConfirm,
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
                        Are you sure you want to delete "{deletingGroup?.name}"?
                        {deletingGroup?._count?.products ? (
                            <Text as="span" tone="critical">
                                {' '}
                                This group has {deletingGroup._count.products} product(s) assigned. You
                                must reassign them before deleting.
                            </Text>
                        ) : (
                            ' This action cannot be undone.'
                        )}
                    </Text>
                </Modal.Section>
            </Modal>

            {/* Product Assignment Modal */}
            <Modal
                open={showAssignModal}
                onClose={() => setShowAssignModal(false)}
                title={`Manage Products - ${assigningGroup?.name || ''}`}
                primaryAction={{
                    content: 'Save Changes',
                    onAction: handleAssignSave,
                    loading: assignLoading,
                }}
                secondaryActions={[
                    {
                        content: 'Cancel',
                        onAction: () => setShowAssignModal(false),
                    },
                ]}
            >
                <Modal.Section>
                    <BlockStack gap="400">
                        <InlineStack gap="200" align="start">
                            <div style={{ flex: 1 }}>
                                <TextField
                                    label=""
                                    labelHidden
                                    value={assignSearch}
                                    onChange={handleAssignSearchChange}
                                    placeholder="Search by SKU or title..."
                                    autoComplete="off"
                                    prefix={<Icon source={SearchIcon} />}
                                    connectedRight={
                                        <Button onClick={handleAssignSearchSubmit}>Search</Button>
                                    }
                                />
                            </div>
                            <CollectionFilter
                                selectedCollectionId={assignCollectionId}
                                onCollectionChange={setAssignCollectionId}
                                disabled={assignLoading}
                            />
                        </InlineStack>

                        <Text as="p" tone="subdued">
                            {assignTotal} products found. Select products to add to this group.
                        </Text>

                        {assignLoading ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                                <Spinner size="large" />
                            </div>
                        ) : (
                            <BlockStack gap="200">
                                {assignProducts.map((product) => {
                                    const isDisabled = product.assignedToOtherGroup;
                                    const isChecked = selectedProductIds.has(product.id);

                                    return (
                                        <div
                                            key={product.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '8px 12px',
                                                borderRadius: '8px',
                                                backgroundColor: isDisabled ? '#f1f1f1' : '#fff',
                                                border: '1px solid #e1e1e1',
                                                opacity: isDisabled ? 0.7 : 1,
                                            }}
                                        >
                                            <Checkbox
                                                label=""
                                                labelHidden
                                                checked={isChecked}
                                                disabled={isDisabled}
                                                onChange={(checked) =>
                                                    handleProductCheckChange(product.id, checked)
                                                }
                                            />
                                            <Thumbnail
                                                source={product.imageUrl || 'https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png'}
                                                alt={product.title}
                                                size="small"
                                            />
                                            <div style={{ flex: 1 }}>
                                                <Text as="p" fontWeight="semibold">
                                                    {product.title}
                                                </Text>
                                                <Text as="p" tone="subdued">
                                                    SKU: {product.sku || 'N/A'}
                                                </Text>
                                            </div>
                                            {isDisabled && (
                                                <Tooltip content={`Already assigned to: ${product.assignedGroupName}`}>
                                                    <Badge tone="warning">
                                                        Assigned to {product.assignedGroupName || ''}
                                                    </Badge>
                                                </Tooltip>
                                            )}
                                            {product.assignedToCurrentGroup && (
                                                <Badge tone="success">In this group</Badge>
                                            )}
                                        </div>
                                    );
                                })}

                                {assignProducts.length === 0 && !assignLoading && (
                                    <Text as="p" alignment="center" tone="subdued">
                                        No products found.
                                    </Text>
                                )}
                            </BlockStack>
                        )}

                        {assignTotalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                                <Pagination
                                    hasPrevious={assignPage > 1}
                                    hasNext={assignPage < assignTotalPages}
                                    onPrevious={() => handleAssignPageChange(assignPage - 1)}
                                    onNext={() => handleAssignPageChange(assignPage + 1)}
                                />
                            </div>
                        )}
                    </BlockStack>
                </Modal.Section>
            </Modal>
        </Page>
    );
}
