import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { makeT } from '../../i18n/I18nContext';
import { setDateLocale } from '../../utils/helpers';
import { CompanyLanguage } from '../../types';

// Public, no-auth project status view — the page the mayor's office opens
// when David sends them a share link. Renders contract metadata, stages with
// statuses and deadlines, but never financials or attachments.
//
// Deliberately styled outside the Layout (no sidebar, no company switcher)
// because external clients don't have an ETM account and shouldn't see any
// internal chrome.

interface PublicProject {
    title: string;
    client_name: string | null;
    location: string | null;
    contract_number: string | null;
    contract_date: string | null;
    area_hectares: number | string | null;
    deadline: string | null;
    notes: string | null;
    work_type_name: string | null;
    company_name: string;
    company_color: string;
    created_at: string;
}

interface PublicStage {
    id: string;
    stage_name: string;
    icon: string | null;
    color: string | null;
    deadline: string | null;
    notes: string | null;
    status_name: string | null;
    status_color: string | null;
    is_terminal: boolean | null;
}

export default function PublicProjectPage() {
    const { token } = useParams<{ token: string }>();
    const [data, setData] = useState<{ project: PublicProject; stages: PublicStage[]; language: CompanyLanguage } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;
        axios.get(`/api/public/projects/${token}`)
            .then(res => setData(res.data))
            .catch(err => setError(err.response?.data?.error || null))
            .finally(() => setLoading(false));
    }, [token]);

    // Pick the renderer language from the response (set by the API based on
    // the token's company). Default to RO while loading or on error, to keep
    // legacy behavior for already-issued links.
    const language: CompanyLanguage = data?.language ?? 'ro';
    const t = useMemo(() => makeT(language), [language]);

    // Sync date-fns locale synchronously during render — same reason as
    // I18nProvider: an effect would run after the first paint and leave a
    // visible Romanian flash.
    setDateLocale(language);

    if (loading) {
        return (
            <div className="min-h-screen bg-navy-950 text-white flex items-center justify-center">
                <p className="text-navy-400">{t('public_project.loading')}</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-navy-950 text-white flex items-center justify-center p-6">
                <div className="max-w-md text-center">
                    <h1 className="text-2xl font-bold mb-2">{t('public_project.link_invalid_title')}</h1>
                    <p className="text-navy-400">{error || t('public_project.link_invalid_default')}</p>
                </div>
            </div>
        );
    }

    const { project, stages } = data;
    const dateLocaleTag = language === 'hu' ? 'hu-HU' : language === 'en' ? 'en-US' : 'ro-RO';
    const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString(dateLocaleTag) : '—';

    return (
        <div className="min-h-screen bg-navy-950 text-white">
            {/* Branded header from the issuing company */}
            <div
                className="border-b border-navy-700/50 px-6 py-4"
                style={{ background: `linear-gradient(135deg, ${project.company_color}33, transparent)` }}
            >
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-navy-300">{project.company_name}</span>
                    <span className="text-xs text-navy-500">{t('public_project.public_view')}</span>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-6 space-y-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">{project.title}</h1>
                    {project.work_type_name && (
                        <p className="text-sm text-navy-400 mt-1">{project.work_type_name}</p>
                    )}
                </div>

                <div className="bg-navy-800/40 border border-navy-700/40 rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-navy-200 mb-3">{t('public_project.project_data')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <Row label={t('public_project.client')} value={project.client_name} />
                        <Row label={t('public_project.location')} value={project.location} />
                        <Row label={t('public_project.contract_number')} value={project.contract_number} />
                        <Row label={t('public_project.contract_date')} value={fmt(project.contract_date)} />
                        <Row label={t('public_project.area_hectares')} value={project.area_hectares ? String(project.area_hectares) : null} />
                        <Row label={t('public_project.deadline')} value={fmt(project.deadline)} />
                    </div>
                    {project.notes && (
                        <div className="mt-3 pt-3 border-t border-navy-700/30">
                            <div className="text-[11px] uppercase tracking-wider text-navy-400 mb-1">{t('public_project.notes')}</div>
                            <p className="text-sm text-navy-200 whitespace-pre-wrap">{project.notes}</p>
                        </div>
                    )}
                </div>

                <div className="bg-navy-800/40 border border-navy-700/40 rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-navy-200 mb-3">{t('public_project.stages')} ({stages.length})</h2>
                    {stages.length === 0 ? (
                        <p className="text-sm text-navy-500">{t('public_project.no_stages')}</p>
                    ) : (
                        <div className="space-y-2">
                            {stages.map(s => (
                                <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-navy-900/40">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: s.status_color || s.color || '#475569' }}
                                    />
                                    <span className="flex-1 text-sm text-navy-100">{s.stage_name}</span>
                                    {s.status_name && (
                                        <span
                                            className="text-xs px-2 py-0.5 rounded-full"
                                            style={{
                                                background: `${s.status_color || '#475569'}22`,
                                                color: s.status_color || '#cbd5e1',
                                            }}
                                        >
                                            {s.status_name}
                                        </span>
                                    )}
                                    <span className="text-[11px] text-navy-500 w-24 text-right">{fmt(s.deadline)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <p className="text-[11px] text-navy-500 text-center pt-4">
                    {t('public_project.auto_update_note', { company: project.company_name })}
                </p>
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string | null }) {
    return (
        <div>
            <div className="text-[11px] uppercase tracking-wider text-navy-400 mb-0.5">{label}</div>
            <div className="text-navy-100">{value || '—'}</div>
        </div>
    );
}
