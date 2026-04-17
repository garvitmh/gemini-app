import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@shopify/polaris';
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Dashboard from './pages/Dashboard';
import Rates from './pages/Rates';
import Products from './pages/Products';
import History from './pages/History';
import Settings from './pages/Settings';
import MakingGroups from './pages/MakingGroups';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { SyncProvider } from './context/SyncContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
// @ts-ignore - JSON import
import en from '@shopify/polaris/locales/en.json';

function RequireAuth({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, loading } = useAuth();
    if (loading) return null; // Wait for initial check
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

/**
 * Read the 'host' query param provided by Shopify when embedded.
 */
function getShopifyHost() {
    const params = new URLSearchParams(window.location.search);
    return params.get('host') || '';
}

const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY || '';
const host = getShopifyHost();

// Only activate App Bridge when inside Shopify Admin (host param present)
const isEmbedded = Boolean(host && apiKey);

function App() {
    const content = (
        <SyncProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/*" element={
                        <RequireAuth>
                            <Layout>
                                <Routes>
                                    <Route path="/" element={<Dashboard />} />
                                    <Route path="/rates" element={<Rates />} />
                                    <Route path="/products" element={<Products />} />
                                    <Route path="/history" element={<History />} />
                                    <Route path="/settings" element={<Settings />} />
                                    <Route path="/making-groups" element={<MakingGroups />} />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </Layout>
                        </RequireAuth>
                    } />
                </Routes>
            </BrowserRouter>
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
                style={{ zIndex: 10000 }}
            />
        </SyncProvider>
    );

    return (
        <AppProvider i18n={en}>
            <ErrorBoundary>
                <AuthProvider>
                    {isEmbedded ? (
                        // Embedded in Shopify Admin — use App Bridge for session tokens & navigation
                        <AppBridgeProvider config={{ apiKey, host, forceRedirect: false }}>
                            {content}
                        </AppBridgeProvider>
                    ) : (
                        // Standalone / desktop mode — skip App Bridge
                        content
                    )}
                </AuthProvider>
            </ErrorBoundary>
        </AppProvider>
    );
}

export default App;
