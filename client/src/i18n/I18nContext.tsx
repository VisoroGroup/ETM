import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import ro from './locales/ro.json';
import hu from './locales/hu.json';
import { useCompany } from '../hooks/useCompany';
import { CompanyLanguage } from '../types';

type Translations = typeof ro;

const DICTIONARIES: Record<CompanyLanguage, Translations> = {
    ro,
    hu: hu as Translations,
    en: ro, // fallback to Romanian for now
};

/**
 * Resolve a dotted key (e.g. "sidebar.dark_mode") against a nested translation
 * object. Returns the key itself if missing — that makes typos easy to spot
 * during development.
 */
function lookup(dict: any, dottedKey: string): string {
    const parts = dottedKey.split('.');
    let cur = dict;
    for (const p of parts) {
        if (cur && typeof cur === 'object' && p in cur) {
            cur = cur[p];
        } else {
            return dottedKey;
        }
    }
    return typeof cur === 'string' ? cur : dottedKey;
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
    return (key, vars) => interpolate(lookup(dict, key), vars);
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
