import { useState, useEffect } from 'react';
import { Select } from '@shopify/polaris';
import api from '../utils/api';

interface Collection {
    id: string;
    title: string;
}

interface CollectionFilterProps {
    selectedCollectionId: string;
    onCollectionChange: (id: string) => void;
    disabled?: boolean;
}

export default function CollectionFilter({ selectedCollectionId, onCollectionChange, disabled }: CollectionFilterProps) {
    const [collections, setCollections] = useState<Collection[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCollections();
    }, []);

    const fetchCollections = async () => {
        setLoading(true);
        try {
            const response = await api.get('/shopify/collections');
            const data = response.data;
            if (Array.isArray(data)) {
                // Sort alphabetically
                data.sort((a, b) => a.title.localeCompare(b.title));
                setCollections(data);
            }
        } catch (error) {
            console.error('Error fetching collections:', error);
        } finally {
            setLoading(false);
        }
    };

    const options = [
        { label: 'All Collections', value: '' },
        ...collections.map(c => ({
            label: c.title,
            value: c.id
        }))
    ];

    return (
        <div style={{ minWidth: '200px' }}>
            <Select
                label="Collection"
                labelHidden
                options={options}
                value={selectedCollectionId}
                onChange={onCollectionChange}
                disabled={disabled || loading}
            />
        </div>
    );
}
