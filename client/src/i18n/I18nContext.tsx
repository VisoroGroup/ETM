import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import ro from './locales/ro.json';
import hu from './locales/hu.json';
import en from './locales/en.json';
import { useCompany } from '../hooks/useCompany';
import { CompanyLanguage } from '../types';

type Translations = typeof ro;

// EN is currently partial — most user-visible strings translated, the rest
// fall back to RO. RO is the fully-populated master.  (audit-3 H15)
const DICTIONARIES: Record<CompanyLanguage, Translations> = {
    ro,
    hu: hu as Translations,
    // `as unknown as Translations` because en.json is intentionally a
    // partial translation — missing keys fall back to RO at lookup time.
    en: en as unknown as Translations,
};

const FALLBACK_DICT: Translations = ro;

/**
 * Resolve a dotted key (e.g. "sidebar.dark_mode") against a nested translation
 * object. Returns null if missing so the caller can try the fallback dict.
 */
function lookup(dict: any, dottedKey: string): string | null {
    const parts = dottedKey.split('.');
    let cur = dict;
    for (const p of parts) {
        if (cur && typeof cur === 'object' && p in cur) {
            cur = cur[p];
        } else {
            return null;
        }
    }
    return typeof cur === 'string' ? cur : null;
}

/**
 * {{name}} interpolation.
 */
function interpolate(s: string, vars?: Record<string, string | number>): string {
    if (!vars) return s;
    return s.replace(/\{\{(\w+)\}\}/g, (_, name) => {
        const v = vars[name];
        return v === undefined || v === null ? '' : String(v);
    });
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

/** Build a translation function for a specific language without needing the
 *  React context. Useful when rendering several languages on the same screen
 *  (e.g. one sidebar block per company in its own language). */
export function makeT(language: CompanyLanguage): TFunction {
    const dict = DICTIONARIES[language] ?? ro;
    return (key, vars) => {
        // Try the requested language first, then fall back to RO (master),
        // then return the raw key so missing translations are obvious in dev.
        const value = lookup(dict, key) ?? lookup(FALLBACK_DICT, key) ?? key;
        return interpolate(value, vars);
    };
}

interface I18nContextType {
    language: CompanyLanguage;
    t: TFunction;
    /** Returns a t() bound to a specific language regardless of the active company. */
    tFor: (language: CompanyLanguage) => TFunction;
}

const I18nContext = createContext<I18nContextType>({
    language: 'ro',
    t: makeT('ro'),
    tFor: makeT,
});

export function I18nProvider({ children }: { children: ReactNode }) {
    const { activeCompany } = useCompany();
    const language: CompanyLanguage = activeCompany?.language ?? 'ro';

    const value = useMemo<I18nContextType>(() => ({
        language,
        t: makeT(language),
        tFor: makeT,
    }), [language]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
    return useContext(I18nContext);
}
