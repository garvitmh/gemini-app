import axios from 'axios';
import axiosRetry from 'axios-retry';

// Use environment variable for API URL with /api path
// In development: Force relative path to use Vite Proxy (avoids port 3000 vs 3005 mismatch)
// In production: Use VITE_API_URL or default to same domain
const apiBaseURL = import.meta.env.DEV
    ? '/api'
    : (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api');

const api = axios.create({
    baseURL: apiBaseURL,
    timeout: 120000, // 120 second timeout (increased for Shopify sync)
    headers: {
        'Content-Type': 'application/json',
    },
});

// Configure retry logic
axiosRetry(api, {
    retries: 3, // Maximum 3 retry attempts
    retryDelay: axiosRetry.exponentialDelay, // Exponential backoff (1s, 2s, 4s)
    retryCondition: (error) => {
        // Retry on network errors or 5xx server errors
        return (
            axiosRetry.isNetworkOrIdempotentRequestError(error) ||
            (error.response?.status !== undefined && error.response.status >= 500)
        );
    },
    onRetry: (retryCount, error, requestConfig) => {
        console.log(`Retry attempt ${retryCount} for ${requestConfig.url}`, error.message);
    },
});

// Request interceptor for logging
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('gemini_auth_token');
        if (token && config.headers) {
            config.headers.set ? config.headers.set('Authorization', `Bearer ${token}`) : (config.headers['Authorization'] = `Bearer ${token}`);
        }
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
    },
    (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Enhanced error handling
        if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
            error.userMessage = 'Unable to connect to the server. Please check if the backend is running.';
        } else if (error.code === 'ECONNABORTED') {
            error.userMessage = 'Request timeout. Please try again.';
        } else if (error.response) {
            // Server responded with error status
            const status = error.response.status;
            if (status === 404) {
                error.userMessage = 'Resource not found.';
            } else if (status === 401 || status === 403) {
                error.userMessage = 'Authentication required. Please log in.';
                // FIX BUG-10: Auto-logout on token expiry
                localStorage.removeItem('gemini_auth_token');
                localStorage.removeItem('gemini_auth_username');
                // Redirect to login page (avoid infinite loop if already on login)
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            } else if (status === 500) {
                error.userMessage = 'Server error. Please try again later.';
            } else if (status >= 400 && status < 500) {
                error.userMessage = error.response.data?.error || 'Invalid request.';
            } else {
                error.userMessage = error.response.data?.error || 'An error occurred.';
            }
        } else {
            error.userMessage = 'An unexpected error occurred. Please try again.';
        }

        console.error('API Error:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            message: error.message,
            userMessage: error.userMessage,
        });

        return Promise.reject(error);
    }
);

export default api;
