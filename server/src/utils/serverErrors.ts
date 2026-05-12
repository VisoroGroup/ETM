import { Request } from 'express';
import { ServerLocale, tServer, pickLocale } from '../i18n/serverI18n';

/**
 * Resolve the locale to use when formatting a response (errors, messages)
 * back to the user. Priority:
 *
 *   1. req.locale  — set by authMiddleware from the user's active company's
 *      language (best signal — that's the language the rest of the UI is in).
 *   2. Accept-Language header — for unauth routes (login, magic-link request).
 *      We pick the first hint that maps to a supported locale; if the browser
 *      sends `hu,en;q=0.9` we use 'hu'.
 *   3. 'ro' — legacy default.
 *
 * Without this, every backend error message went out as Romanian regardless
 * of the user's actual UI language — confusing for HU users in the Hungary
 * company (audit-3 H18 / H19).
 */
export function resolveRequestLocale(req: Request | undefined): ServerLocale {
    const fromReq = (req as { locale?: ServerLocale } | undefined)?.locale;
    if (fromReq === 'ro' || fromReq === 'hu' || fromReq === 'en') return fromReq;
    const header = req?.headers?.['accept-language'];
    if (typeof header === 'string') {
        for (const part of header.split(',')) {
            const tag = part.split(';')[0]?.trim() ?? '';
            const picked = pickLocale(tag);
            // pickLocale falls back to 'ro' for unknown — only accept hu/en here.
            if (picked === 'hu' || picked === 'en') return picked;
            if (tag.toLowerCase().startsWith('ro')) return 'ro';
        }
    }
    return 'ro';
}

/**
 * Translate an `errors.<key>` message for the request's locale. Drop-in
 * replacement for any hardcoded Romanian error string:
 *
 *   res.status(404).json({ error: tError(req, 'task_not_found') });
 *
 * The `errors` section of serverI18n.ts holds every backend-facing user error
 * in all three supported languages; falling back to RO if the key is missing.
 */
export function tError(
    req: Request | undefined,
    key: string,
    vars?: Record<string, string | number>,
): string {
    const locale = resolveRequestLocale(req);
    return tServer(locale, `errors.${key}`, vars);
}
