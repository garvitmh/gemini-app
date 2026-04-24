/**
 * Shared currency formatting utility
 * FIX BUG-23: Centralized formatCurrency to avoid inconsistency across pages
 */

export const formatCurrency = (amount?: number | null): string => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};
