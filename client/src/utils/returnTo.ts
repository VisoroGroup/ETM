import { safeLocalStorage } from './storage';

/**
 * Remembers where the user was headed when the login screen interrupted them,
 * so a successful login can land back there instead of the dashboard.
 *
 * Why localStorage and not sessionStorage: the magic-link flow finishes in a
 * NEW tab (the link in the email), which has its own sessionStorage — only
 * localStorage is visible from both the tab that hit the login wall and the
 * tab that completes the login.
 */
const KEY = 'visoro_return_to';
const MAX_AGE_MS = 60 * 60 * 1000; // 1h — covers a slow magic-link roundtrip

export function stashReturnTo(): void {
    const path = window.location.pathname + window.location.search;
    // The dashboard is the default landing anyway; stashing it would only
    // risk overwriting a still-pending deep link from another tab.
    if (window.location.pathname === '/') return;
    safeLocalStorage.set(KEY, JSON.stringify({ path, ts: Date.now() }));
}

export function consumeReturnTo(): string | null {
    const raw = safeLocalStorage.get(KEY);
    if (!raw) return null;
    safeLocalStorage.remove(KEY);
    try {
        const { path, ts } = JSON.parse(raw) as { path?: string; ts?: number };
        if (typeof path !== 'string' || typeof ts !== 'number') return null;
        if (Date.now() - ts > MAX_AGE_MS) return null;
        // Same-origin relative paths only — '//host' would be scheme-relative.
        if (!path.startsWith('/') || path.startsWith('//')) return null;
        return path;
    } catch {
        return null;
    }
}
