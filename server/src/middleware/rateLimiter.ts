import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { tError } from '../utils/serverErrors';

// Use a `handler` callback (not a static `message`) so the error gets
// translated per request — express-rate-limit's `message` config is
// evaluated at limiter-construction time, which would freeze the string
// in whatever locale was active at boot.
function makeHandler(key: string, status = 429) {
    return (req: Request, res: Response) => {
        res.status(status).json({ error: tError(req, key) });
    };
}

// Global rate limit — 200 req/min per IP
export const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    handler: makeHandler('rate_limit_global'),
});

// Auth endpoints — stricter (10 req/min)
export const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: makeHandler('rate_limit_auth'),
});

// Upload endpoints — 20 req/min
export const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: makeHandler('rate_limit_upload'),
});

// Magic-link request — strict: 5 requests / 15 min / IP. Without this an
// attacker could spam an inbox or burn through Microsoft Graph send quota.
export const magicLinkRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: makeHandler('rate_limit_magic_link_req'),
});

// Magic-link verify — looser but still strict (20/min). Catches token-guessing.
export const magicLinkVerifyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: makeHandler('rate_limit_magic_link_verify'),
});
