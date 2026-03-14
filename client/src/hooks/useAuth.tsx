import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
    user: User | null;
    users: User[];
    loading: boolean;
    login: () => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    users: [],
    loading: true,
    login: async () => { },
    logout: () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Handle token from Microsoft OAuth callback
        const params = new URLSearchParams(window.location.search);
        const oauthToken = params.get('token');
        const oauthError = params.get('error');

        if (oauthToken) {
            localStorage.setItem('visoro_token', oauthToken);
            window.history.replaceState({}, '', '/');
        } else if (oauthError) {
            console.error('OAuth error:', oauthError);
            window.history.replaceState({}, '', '/');
        }

        checkAuth();
    }, []);

    async function checkAuth() {
        try {
            const token = localStorage.getItem('visoro_token');
            if (token) {
                const { user } = await authApi.me();
                setUser(user);
                const allUsers = await authApi.users();
                setUsers(allUsers);
            }
        } catch {
            localStorage.removeItem('visoro_token');
        } finally {
            setLoading(false);
        }
    }

    async function login() {
        window.location.href = '/api/auth/microsoft';
    }

    function logout() {
        localStorage.removeItem('visoro_token');
        setUser(null);
        setUsers([]);
    }

    return (
        <AuthContext.Provider value={{ user, users, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
