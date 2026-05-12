import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authApi } from '../services/api';
import axios from 'axios';
import { safeLocalStorage } from '../utils/storage';
import { makeT } from '../i18n/I18nContext';

interface AuthContextType {
    user: User | null;
    users: User[];
    loading: boolean;
    login: () => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    users: [],
    loading: true,
    login: async () => { },
    logout: () => { },
    refreshUser: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Handle OAuth callback — exchange one-time code for JWT token
        const params = new URLSearchParams(window.location.search);
        const oauthCode = params.get('code');
        const oauthError = params.get('error');
        // Magic-link callback: /auth/magic-link?token=...
        const isMagicLinkRoute = window.location.pathname === '/auth/magic-link';
        const magicLinkToken = isMagicLinkRoute ? params.get('token') : null;

        if (magicLinkToken) {
            // Clean URL immediately so the raw token isn't kept in history.
            window.history.replaceState({}, '', '/');
            axios.post('/api/auth/magic-link/verify', { token: magicLinkToken })
                .then(({ data }) => {
                    safeLocalStorage.set('visoro_token', data.token);
                    checkAuth();
                })
                .catch((err) => {
                    console.error('Magic link verify failed:', err);
                    const tt = makeT('ro');
                    alert(tt('login.magic_link_verify_failed'));
                    setLoading(false);
                });
        } else if (oauthCode) {
            // Clean URL immediately so code isn't visible in browser history
            window.history.replaceState({}, '', '/');
            // Exchange the one-time code for a JWT token
            axios.post('/api/auth/exchange', { code: oauthCode })
                .then(({ data }) => {
                    safeLocalStorage.set('visoro_token', data.token);
                    checkAuth();
                })
                .catch((err) => {
                    console.error('Auth code exchange failed:', err);
                    setLoading(false);
                });
        } else if (oauthError) {
            console.error('OAuth error:', oauthError);
            if (oauthError === 'user_deactivated') {
                const t = makeT('ro');
                alert(t('auth_errors.user_deactivated'));
            }
            window.history.replaceState({}, '', '/');
            setLoading(false);
        } else {
            checkAuth();
        }
    }, []);

    async function checkAuth() {
        try {
            const token = safeLocalStorage.get('visoro_token');
            if (token) {
                const { user } = await authApi.me();
                setUser(user);
                const allUsers = await authApi.users();
                setUsers(allUsers);
            }
        } catch {
            safeLocalStorage.remove('visoro_token');
        } finally {
            setLoading(false);
        }
    }

    async function login() {
        window.location.href = '/api/auth/microsoft';
    }

    function logout() {
        safeLocalStorage.remove('visoro_token');
        // Clear active company so the next user on a shared browser doesn't inherit it
        safeLocalStorage.remove('visoro_active_company_id');
        setUser(null);
        setUsers([]);
    }

    async function refreshUser() {
        try {
            const { user } = await authApi.me();
            setUser(user);
        } catch {}
    }

    // Periodically re-pull the user profile so a role downgrade or company
    // access change made by another admin propagates without forcing the
    // user to log out and back in. Refresh on:
    //   - mount + auth becomes ready (covered by checkAuth)
    //   - tab regains focus (cheap, common)
    //   - 5-minute heartbeat (catches background tabs)
    useEffect(() => {
        if (!user) return;
        const onFocus = () => refreshUser();
        window.addEventListener('focus', onFocus);
        const t = setInterval(refreshUser, 5 * 60 * 1000);
        return () => {
            window.removeEventListener('focus', onFocus);
            clearInterval(t);
        };
    }, [user?.id]);

    return (
        <AuthContext.Provider value={{ user, users, loading, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
