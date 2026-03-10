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
        try {
            setLoading(true);
            // Dev mode: auto-login
            const result = await authApi.login({ email: 'admin@visoro.ro' });
            localStorage.setItem('visoro_token', result.token);
            setUser(result.user);
            const allUsers = await authApi.users();
            setUsers(allUsers);
        } catch (err) {
            console.error('Login failed:', err);
        } finally {
            setLoading(false);
        }
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
