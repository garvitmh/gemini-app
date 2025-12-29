import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@shopify/polaris';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Dashboard from './pages/Dashboard';
import Rates from './pages/Rates';
import Products from './pages/Products';
import History from './pages/History';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
// @ts-ignore - JSON import
import en from '@shopify/polaris/locales/en.json';

function App() {
    return (
        <AppProvider i18n={en}>
            <ErrorBoundary>
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <Layout>
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/rates" element={<Rates />} />
                            <Route path="/products" element={<Products />} />
                            <Route path="/history" element={<History />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </Layout>
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
            </ErrorBoundary>
        </AppProvider>
    );
}

export default App;
