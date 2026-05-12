import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Company } from '../types';
import { companiesApi, getActiveCompanyId, setActiveCompanyId } from '../services/api';
import { useAuth } from './useAuth';

interface CompanyContextType {
    companies: Company[];
    activeCompany: Company | null;
    setActiveCompany: (id: number) => void;
    loading: boolean;
    reload: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType>({
    companies: [],
    activeCompany: null,
    setActiveCompany: () => { },
    loading: false,
    reload: async () => { },
});

export function CompanyProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [activeId, setActiveIdState] = useState<number | null>(getActiveCompanyId());
    const [loading, setLoading] = useState(false);

    const reload = useCallback(async () => {
        if (!user) {
            setCompanies([]);
            setActiveIdState(null);
            return;
        }
        setLoading(true);
        try {
            const { companies: fetched } = await companiesApi.list();
            setCompanies(fetched);
            // Resolve the active company: keep the persisted choice if still
            // accessible, otherwise default to the first company.
            const stored = getActiveCompanyId();
            const stillVisible = stored != null && fetched.some((c) => c.id === stored);
            const fallback = fetched[0]?.id ?? null;
            const next = stillVisible ? stored : fallback;
            setActiveIdState(next);
            setActiveCompanyId(next);
        } catch (err) {
            console.error('Failed to load companies', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        reload();
    }, [reload]);

    // Multi-tab sync: if another tab switches the active company, mirror that
    // change here so the two tabs don't drift (and so we abort in-flight
    // requests in this tab too — handled inside setActiveCompanyId).
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key !== 'visoro_active_company_id') return;
            const next = e.newValue ? Number(e.newValue) : null;
            if (Number.isFinite(next) && next !== activeId) {
                setActiveIdState(next);
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [activeId]);

    const setActiveCompany = useCallback((id: number) => {
        setActiveIdState(id);
        setActiveCompanyId(id);
    }, []);

    const activeCompany = companies.find((c) => c.id === activeId) ?? null;

    return (
        <CompanyContext.Provider value={{ companies, activeCompany, setActiveCompany, loading, reload }}>
            {children}
        </CompanyContext.Provider>
    );
}

export function useCompany() {
    return useContext(CompanyContext);
}
