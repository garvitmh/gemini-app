import axios from 'axios';
import axiosRetry from 'axios-retry';

const api = axios.create({
    baseURL: '/api',
    timeout: 30000, // 30 second timeout
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

export default api;
