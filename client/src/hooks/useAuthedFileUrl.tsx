import { useEffect, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { safeLocalStorage } from '../utils/storage';

/**
 * Fetches a protected file with the JWT in the Authorization header and
 * exposes it as a blob URL so <img src>, <iframe src>, <a href> can use it
 * without leaking the token into URLs, history, Referer, or logs.
 */
export function useAuthedFileUrl(url: string | null | undefined) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!url) {
            setBlobUrl(null);
            return;
        }
        let cancelled = false;
        let currentBlob: string | null = null;

        setLoading(true);
        setError(false);

        const token = safeLocalStorage.get('visoro_token');
        fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.blob();
            })
            .then(blob => {
                if (cancelled) return;
                currentBlob = URL.createObjectURL(blob);
                setBlobUrl(currentBlob);
                setLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setError(true);
                setLoading(false);
            });

        return () => {
            cancelled = true;
            if (currentBlob) URL.revokeObjectURL(currentBlob);
        };
    }, [url]);

    return { blobUrl, loading, error };
}

/**
 * Triggers a download for an authenticated file URL.
 * Fetches with the Bearer token, creates a blob URL, clicks a hidden <a>.
 */
export async function downloadAuthedFile(url: string, filename: string): Promise<void> {
    const token = safeLocalStorage.get('visoro_token');
    const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

/**
 * <img> wrapper that fetches a protected URL with the JWT and renders the blob.
 * Shows a placeholder while loading and a broken-image indicator on error.
 */
type AuthedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
    src: string | null | undefined;
};

export function AuthedImage({ src, alt, className, ...rest }: AuthedImageProps) {
    const { blobUrl, loading, error } = useAuthedFileUrl(src);
    if (loading || !blobUrl) {
        if (error) {
            return (
                <div
                    className={className}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                >
                    ?
                </div>
            );
        }
        return <div className={className} style={{ background: 'rgba(255,255,255,0.03)' }} />;
    }
    return <img src={blobUrl} alt={alt} className={className} {...rest} />;
}
