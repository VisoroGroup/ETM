import rateLimit from 'express-rate-limit';

// Global rate limit — 200 req/min per IP
export const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Prea multe cereri. Încearcă din nou.' },
});

// Auth endpoints — stricter (10 req/min)
export const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Prea multe încercări de autentificare. Încearcă în 1 minut.' },
});

// Upload endpoints — 20 req/min
export const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Prea multe upload-uri. Încearcă în 1 minut.' },
});

// Magic-link request — strict: 5 requests / 15 min / IP. Without this an
// attacker could spam an inbox or burn through Microsoft Graph send quota.
export const magicLinkRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Prea multe cereri de link de autentificare. Încearcă în 15 minute.' },
});

// Magic-link verify — looser but still strict (20/min). Catches token-guessing.
export const magicLinkVerifyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Prea multe încercări de validare. Încearcă în 1 minut.' },
});
