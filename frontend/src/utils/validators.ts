export const isRequired = (value: any): boolean => {
    if (typeof value === 'string') {
        return value.trim().length > 0;
    }
    return value !== null && value !== undefined;
};

export const isPositiveNumber = (value: any): boolean => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
};

export const isNonNegativeNumber = (value: any): boolean => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0;
};

export const isValidPercentage = (value: any): boolean => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= 100;
};

export const isValidKarat = (value: any): boolean => {
    const num = parseInt(value);
    const validKarats = [9, 10, 12, 14, 16, 18, 20, 21, 22, 23, 24];
    return validKarats.includes(num);
};

export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const minLength = (value: string, length: number): boolean => {
    return value.trim().length >= length;
};

export const maxLength = (value: string, length: number): boolean => {
    return value.trim().length <= length;
};

export const isNumeric = (value: any): boolean => {
    return !isNaN(parseFloat(value)) && isFinite(value);
};
