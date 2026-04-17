import React, { useState } from 'react';
import { Page, Layout, Card, FormLayout, TextField, Button, Text, Banner } from '@shopify/polaris';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export const Login: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async () => {
        if (!username || !password) {
            setError('Please enter both username and password.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await api.post('/login', { username, password });
            login(response.data.token, response.data.username);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to authenticate. Check server status.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Page>
            <div style={{ maxWidth: '400px', margin: '60px auto 0' }}>
                <Layout>
                    <Layout.Section>
                        {error && (
                            <div style={{ marginBottom: '16px' }}>
                                <Banner title="Authentication Error" tone="critical">
                                    <p>{error}</p>
                                </Banner>
                            </div>
                        )}
                        <Card>
                            <div style={{ padding: '24px' }}>
                                <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                                    <Text variant="headingXl" as="h1">Gemini App Dashboard</Text>
                                    <Text variant="bodyMd" as="p" tone="subdued">Sign in to manage product prices</Text>
                                </div>
                                <FormLayout>
                                    <TextField
                                        label="Username"
                                        value={username}
                                        onChange={setUsername}
                                        autoComplete="username"
                                    />
                                    <TextField
                                        label="Password"
                                        type="password"
                                        value={password}
                                        onChange={setPassword}
                                        autoComplete="current-password"
                                    />
                                    <Button variant="primary" fullWidth submit onClick={handleSubmit} loading={loading}>
                                        Sign In
                                    </Button>
                                </FormLayout>
                            </div>
                        </Card>
                    </Layout.Section>
                </Layout>
            </div>
        </Page>
    );
};
