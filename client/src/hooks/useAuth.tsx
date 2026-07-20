import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authApi } from '../services/api';
import axios from 'axios';
import { safeLocalStorage } from '../utils/storage';
import { consumeReturnTo } from '../utils/returnTo';
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
            // Audit-3 H20: keep the token in sessionStorage until verify
            // resolves. If the POST fails (network blip, tab crash), the
            // user can refresh and try again with the same token — without
            // this stash, the token is unrecoverable the moment we strip
            // it from the URL.
            sessionStorage.setItem('visoro_pending_magic_link', magicLinkToken);
            window.history.replaceState({}, '', '/');
            axios.post('/api/auth/magic-link/verify', { token: magicLinkToken })
                .then(({ data }) => {
                    sessionStorage.removeItem('visoro_pending_magic_link');
                    safeLocalStorage.set('visoro_token', data.token);
                    // Land back where the login wall interrupted the user
                    // (e.g. an email task link) instead of the dashboard.
                    // replaceState alone is invisible to React Router — the
                    // synthetic popstate makes it re-read the URL.
                    window.history.replaceState({}, '', consumeReturnTo() ?? '/');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                    checkAuth();
                })
                .catch((err) => {
                    console.error('Magic link verify failed:', err);
                    // Only drop the stash if the server confirmed the token
                    // is unusable (4xx). Network errors leave it in place.
                    if (err?.response?.status >= 400 && err?.response?.status < 500) {
                        sessionStorage.removeItem('visoro_pending_magic_link');
                    }
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
                    // Land back where the login wall interrupted the user
                    // (e.g. an email task link) instead of the dashboard.
                    // replaceState alone is invisible to React Router — the
                    // synthetic popstate makes it re-read the URL.
                    window.history.replaceState({}, '', consumeReturnTo() ?? '/');
                    window.dispatchEvent(new PopStateEvent('popstate'));
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

    // Refetch the company-scoped users list, retrying a couple of times on a
    // transient failure (e.g. a request aborted by a rapid company switch, or a
    // brief network blip). This is what keeps the assignee / subtask-owner
    // dropdowns from staying frozen on a *previous* company's members — the exact
    // failure that made a Hungary-only user (a plain 'user', not an admin who
    // shows everywhere) invisible in the picker while their name still rendered
    // on the task. A canceled request means a newer switch superseded us, so we
    // stop; otherwise we log rather than swallow silently.
    async function reloadUsers(attempt = 0): Promise<void> {
        try {
            const list = await authApi.users();
            setUsers(list);
        } catch (err) {
            if (axios.isCancel(err)) return; // superseded by a newer company switch
            if (attempt < 2) {
                setTimeout(() => { void reloadUsers(attempt + 1); }, 400 * (attempt + 1));
            } else {
                console.warn('[useAuth] users list refetch failed; assignee dropdowns may be stale', err);
            }
        }
    }

    // Periodically re-pull the user profile so a role downgrade or company
    // access change made by another admin propagates without forcing the
    // user to log out and back in. Refresh on:
    //   - mount + auth becomes ready (covered by checkAuth)
    //   - tab regains focus (cheap, common)
    //   - 5-minute heartbeat (catches background tabs)
    useEffect(() => {
        if (!user) return;
        // Re-sync both the profile AND the company-scoped users list when the tab
        // regains focus — a cheap, reliable way to heal a stale dropdown list.
        const onFocus = () => { refreshUser(); void reloadUsers(); };
        window.addEventListener('focus', onFocus);
        const t = setInterval(refreshUser, 5 * 60 * 1000);
        return () => {
            window.removeEventListener('focus', onFocus);
            clearInterval(t);
        };
    }, [user?.id]);

    // The users list is filtered by active company on the server. When the
    // user switches companies, refetch so dropdowns (assignee, subtask owner,
    // bulk-assign, etc.) show the right people for the new tenant. Without
    // this, the dropdown options stay frozen from the company that was active
    // on initial login — so a user that only exists in company B is invisible
    // when you switch to B, and the assignee picker shows "Nincs felelős"
    // even though the badge displays their name.
    useEffect(() => {
        if (!user) return;
        const onCompanyChange = () => { void reloadUsers(); };
        window.addEventListener('etm:active-company-changed', onCompanyChange);
        return () => window.removeEventListener('etm:active-company-changed', onCompanyChange);
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
