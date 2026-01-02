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
} from '@shopify/polaris';
import { PlusIcon } from '@shopify/polaris-icons';
import api from '../utils/api';

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

export default function MakingGroups() {
    const [makingGroups, setMakingGroups] = useState<MakingGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState<MakingGroup | null>(null);
    const [formName, setFormName] = useState('');
    const [formType, setFormType] = useState('per_gram');
    const [formValue, setFormValue] = useState('');

    // Delete confirmation
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingGroup, setDeletingGroup] = useState<MakingGroup | null>(null);

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
                // Update
                await api.put(`/making-groups/${editingGroup.id}`, data);
                setSuccessMessage('Making group updated successfully');
            } else {
                // Create
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
        group._count?.products || 0,
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
                            columnContentTypes={['text', 'text', 'text', 'numeric', 'text']}
                            headings={['Name', 'Type', 'Value', 'Products Using', 'Actions']}
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
        </Page>
    );
}
