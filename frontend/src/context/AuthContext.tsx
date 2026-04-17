import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
    isAuthenticated: boolean;
    token: string | null;
    username: string | null;
    login: (token: string, username: string) => void;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedToken = localStorage.getItem('gemini_auth_token');
        const storedUsername = localStorage.getItem('gemini_auth_username');
        if (storedToken) {
            setToken(storedToken);
            setUsername(storedUsername || 'Admin');
        }
        setLoading(false);
    }, []);

    const login = (newToken: string, newUsername: string) => {
        localStorage.setItem('gemini_auth_token', newToken);
        localStorage.setItem('gemini_auth_username', newUsername);
        setToken(newToken);
        setUsername(newUsername);
    };

    const logout = () => {
        localStorage.removeItem('gemini_auth_token');
        localStorage.removeItem('gemini_auth_username');
        setToken(null);
        setUsername(null);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated: !!token, token, username, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
