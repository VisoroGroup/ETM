import React, { useEffect, useState } from 'react';
import { Building2, Plus, Edit2, Archive, ArchiveRestore, X, Loader2, RefreshCw, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCompany } from '../../hooks/useCompany';
import {
    adminApi,
    adminCompaniesApi,
    adminUserCompaniesApi,
    AdminCompanyInput,
} from '../../services/api';
import { Company, User, CompanyLanguage, CompanyTemplateType } from '../../types';
import { useTranslation, TFunction } from '../../i18n/I18nContext';

// English is intentionally NOT offered as a company language: the EN locale is
// only ~9% translated (it silently falls back to Romanian) and nobody uses it.
// Decision 2026-05-29 — re-add only if a full EN translation is shipped.
// See PLANNING.md §8 and brain/2026-05-29-project-anchors-bootstrap.md.
const LANGUAGE_OPTIONS = (t: TFunction): { value: CompanyLanguage; label: string }[] => [
    { value: 'ro', label: t('admin_companies.language_ro') },
    { value: 'hu', label: t('admin_companies.language_hu') },
];

const TEMPLATE_OPTIONS = (t: TFunction): { value: CompanyTemplateType; label: string; hint: string }[] => [
    { value: 'full', label: t('admin_companies.tpl_full'), hint: t('admin_companies.tpl_full_hint') },
    { value: 'project', label: t('admin_companies.tpl_project'), hint: t('admin_companies.tpl_project_hint') },
    { value: 'simple', label: t('admin_companies.tpl_simple'), hint: t('admin_companies.tpl_simple_hint') },
];

const DEFAULT_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

interface UserWithCompanies extends User {
    company_ids?: number[];
}

export default function CompaniesAdminPage() {
    const { t } = useTranslation();
    const languageOptions = LANGUAGE_OPTIONS(t);
    const templateOptions = TEMPLATE_OPTIONS(t);
    const { user: currentUser } = useAuth();
    const { reload: reloadSidebar } = useCompany();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [users, setUsers] = useState<UserWithCompanies[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<Company | null>(null);
    const [accessUserId, setAccessUserId] = useState<string | null>(null);
    const [userFilterCompanyId, setUserFilterCompanyId] = useState<number | 'all'>('all');

    const isSuperAdmin = currentUser?.role === 'superadmin';

    // Filter users by selected company. Admins/superadmins implicitly have
    // access to every company, so they always appear regardless of filter —
    // otherwise the table would look empty when scoping to "Hungary" etc.
    const visibleUsers = userFilterCompanyId === 'all'
        ? users
        : users.filter(u => {
            const isAdminUser = u.role === 'admin' || u.role === 'superadmin';
            return isAdminUser || (u.company_ids ?? []).includes(userFilterCompanyId);
        });

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [{ companies: c }, u] = await Promise.all([
                adminCompaniesApi.list(),
                adminApi.users() as Promise<UserWithCompanies[]>,
            ]);
            setCompanies(c);
            setUsers(u);
        } catch (err: any) {
            setError(err.response?.data?.error ?? t('common.error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const onArchive = async (c: Company) => {
        try {
            await adminCompaniesApi.archive(c.id, !c.is_archived);
            await load();
            await reloadSidebar();
        } catch (err: any) {
            setError(err.response?.data?.error ?? t('admin_companies.error_generic'));
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Building2 className="w-6 h-6 text-blue-400" />
                    <h1 className="text-xl font-bold">{t('admin_companies.title')}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-sm transition-colors">
                        <RefreshCw className="w-4 h-4" />
                        {t('admin_users.reload')}
                    </button>
                    {isSuperAdmin && (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-medium"
                        >
                            <Plus className="w-4 h-4" /> {t('admin_companies.create')}
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Companies table */}
            <div className="bg-navy-800/30 border border-navy-700/50 rounded-xl overflow-hidden mb-6">
                <div className="px-4 py-3 border-b border-navy-700/50">
                    <h2 className="text-sm font-semibold">{t('admin_companies.list_title', { count: companies.length })}</h2>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-navy-700/50">
                                    <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('common.company')}</th>
                                    <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('admin_companies.col_slug')}</th>
                                    <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('common.language')}</th>
                                    <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('admin_companies.col_type')}</th>
                                    <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('common.status')}</th>
                                    {isSuperAdmin && (
                                        <th className="text-right px-4 py-2.5 text-xs text-navy-400 font-medium">{t('common.actions')}</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {companies.length === 0 && (
                                    <tr>
                                        <td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-8 text-center text-xs text-navy-400">
                                            {t('admin_companies.create')}
                                        </td>
                                    </tr>
                                )}
                                {companies.map((c) => (
                                    <tr key={c.id} className="border-b border-navy-700/30 hover:bg-navy-700/20">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                                                <div>
                                                    <p className="font-medium text-xs">{c.name}</p>
                                                    <p className="text-navy-400 text-[10px]">{c.sidebar_name}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-navy-300 font-mono">{c.slug}</td>
                                        <td className="px-4 py-3 text-xs">{languageOptions.find((l) => l.value === c.language)?.label ?? c.language}</td>
                                        <td className="px-4 py-3 text-xs">{templateOptions.find((tp) => tp.value === c.template_type)?.label ?? c.template_type}</td>
                                        <td className="px-4 py-3">
                                            {c.is_archived
                                                ? <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">{t('common.archived')}</span>
                                                : <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">{t('common.active')}</span>}
                                        </td>
                                        {isSuperAdmin && (
                                            <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                                                <button
                                                    onClick={() => setEditing(c)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy-700 hover:bg-navy-600 text-xs"
                                                    title={t('common.edit')}
                                                >
                                                    <Edit2 className="w-3 h-3" /> {t('common.edit')}
                                                </button>
                                                {c.id !== 1 && (
                                                    <button
                                                        onClick={() => onArchive(c)}
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy-700 hover:bg-navy-600 text-xs"
                                                        title={c.is_archived ? t('admin_companies.unarchive') : t('admin_companies.archive')}
                                                    >
                                                        {c.is_archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                                                        {c.is_archived ? t('admin_companies.unarchive') : t('admin_companies.archive')}
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* User company access — superadmin only */}
            {isSuperAdmin && (
                <div className="bg-navy-800/30 border border-navy-700/50 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-navy-700/50 flex items-center gap-2 flex-wrap">
                        <Users className="w-4 h-4 text-navy-300" />
                        <h2 className="text-sm font-semibold flex-1">{t('admin_companies.user_access_title')}</h2>
                        <label className="flex items-center gap-2 text-[11px] text-navy-300">
                            <span>{t('admin_companies.filter_by_company')}:</span>
                            <select
                                value={userFilterCompanyId === 'all' ? 'all' : String(userFilterCompanyId)}
                                onChange={(e) => setUserFilterCompanyId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                className="bg-navy-800 border border-navy-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                            >
                                <option value="all">{t('admin_companies.filter_all')}</option>
                                {companies.filter(c => !c.is_archived).map(c => (
                                    <option key={c.id} value={c.id}>{c.sidebar_name}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-navy-700/50">
                                        <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('common.user')}</th>
                                        <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('common.role')}</th>
                                        <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('common.companies')}</th>
                                        <th className="text-right px-4 py-2.5 text-xs text-navy-400 font-medium">{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleUsers.length === 0 && (
                                        <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-navy-400 italic">{t('admin_companies.no_users_in_filter')}</td></tr>
                                    )}
                                    {visibleUsers.map((u) => {
                                        // Admins/superadmins implicitly see every non-archived company.
                                        const isAdminUser = u.role === 'admin' || u.role === 'superadmin';
                                        return (
                                            <tr key={u.id} className="border-b border-navy-700/30 hover:bg-navy-700/20">
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-xs">{u.display_name}</p>
                                                    <p className="text-navy-400 text-[10px]">{u.email}</p>
                                                </td>
                                                <td className="px-4 py-3 text-xs">{u.role}</td>
                                                <td className="px-4 py-3">
                                                    {isAdminUser ? (
                                                        <span className="text-[11px] text-navy-300 italic">{t('admin_companies.implicit_access', { role: u.role })}</span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1">
                                                            {(u.company_ids ?? []).length === 0
                                                                ? <span className="text-[11px] text-navy-400 italic">{t('admin_companies.no_access')}</span>
                                                                : (u.company_ids ?? []).map((cid) => {
                                                                    const c = companies.find((x) => x.id === cid);
                                                                    if (!c) return null;
                                                                    return (
                                                                        <span
                                                                            key={cid}
                                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                                                            style={{ backgroundColor: `${c.color}22`, color: c.color }}
                                                                        >
                                                                            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                                                                            {c.sidebar_name}
                                                                        </span>
                                                                    );
                                                                })}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {!isAdminUser && (
                                                        <button
                                                            onClick={() => setAccessUserId(u.id)}
                                                            className="px-2 py-1 rounded bg-navy-700 hover:bg-navy-600 text-xs"
                                                        >
                                                            {t('admin_companies.edit_access')}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {showCreate && (
                <CompanyEditorModal
                    onClose={() => setShowCreate(false)}
                    onSaved={async () => {
                        setShowCreate(false);
                        await load();
                        await reloadSidebar();
                    }}
                />
            )}

            {editing && (
                <CompanyEditorModal
                    company={editing}
                    onClose={() => setEditing(null)}
                    onSaved={async () => {
                        setEditing(null);
                        await load();
                        await reloadSidebar();
                    }}
                />
            )}

            {accessUserId && (
                <UserCompanyAccessModal
                    user={users.find((u) => u.id === accessUserId)!}
                    companies={companies.filter((c) => !c.is_archived)}
                    onClose={() => setAccessUserId(null)}
                    onSaved={async () => {
                        setAccessUserId(null);
                        await load();
                    }}
                />
            )}
        </div>
    );
}

function CompanyEditorModal({ company, onClose, onSaved }: { company?: Company; onClose: () => void; onSaved: () => void; }) {
    const { t } = useTranslation();
    const languageOptions = LANGUAGE_OPTIONS(t);
    const templateOptions = TEMPLATE_OPTIONS(t);
    const [name, setName] = useState(company?.name ?? '');
    const [sidebarName, setSidebarName] = useState(company?.sidebar_name ?? '');
    const [slug, setSlug] = useState(company?.slug ?? '');
    const [language, setLanguage] = useState<CompanyLanguage>(company?.language ?? 'ro');
    const [templateType, setTemplateType] = useState<CompanyTemplateType>(company?.template_type ?? 'simple');
    const [color, setColor] = useState(company?.color ?? DEFAULT_COLORS[1]);
    const [icon, setIcon] = useState(company?.icon ?? '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const isEdit = !!company;

    const submit = async () => {
        setErr('');
        setSaving(true);
        try {
            const payload: AdminCompanyInput & { sort_order?: number } = {
                name: name.trim(),
                sidebar_name: sidebarName.trim(),
                slug: slug.trim() || undefined,
                language,
                template_type: templateType,
                color,
                icon: icon.trim() || null,
            };
            if (isEdit) {
                await adminCompaniesApi.update(company!.id, payload);
            } else {
                await adminCompaniesApi.create(payload);
            }
            onSaved();
        } catch (e: any) {
            setErr(e.response?.data?.error ?? t('common.error_saving'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold">{isEdit ? t('admin_companies.form_edit_title') : t('admin_companies.form_create_title')}</h3>
                    <button onClick={onClose} className="text-navy-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                {err && <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">{err}</div>}

                <div className="space-y-3">
                    <Field label={t('admin_companies.official_name')}>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Visoro Hungary KFT" className={inputCls} />
                    </Field>
                    <Field label={t('admin_companies.sidebar_name')}>
                        <input value={sidebarName} onChange={(e) => setSidebarName(e.target.value)} placeholder="Hungary" className={inputCls} />
                    </Field>
                    <Field label={t('admin_companies.slug')}>
                        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="hungary" className={inputCls} />
                    </Field>
                    <Field label={t('common.language')}>
                        <select value={language} onChange={(e) => setLanguage(e.target.value as CompanyLanguage)} className={inputCls}>
                            {languageOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </Field>
                    <Field label={t('admin_companies.structure_type')}>
                        <select value={templateType} onChange={(e) => setTemplateType(e.target.value as CompanyTemplateType)} className={inputCls}>
                            {templateOptions.map((o) => <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>)}
                        </select>
                    </Field>
                    <Field label={t('admin_companies.color_hex')}>
                        <div className="flex items-center gap-2">
                            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-9 bg-transparent cursor-pointer" />
                            <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#3B82F6" className={inputCls + ' flex-1'} />
                            <div className="flex gap-1">
                                {DEFAULT_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        className="w-6 h-6 rounded border border-navy-700"
                                        style={{ backgroundColor: c }}
                                        aria-label={t('admin_companies.set_color_aria', { color: c })}
                                    />
                                ))}
                            </div>
                        </div>
                    </Field>
                    <Field label={t('admin_companies.icon')}>
                        <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="building-2" className={inputCls} />
                    </Field>
                </div>

                <div className="flex gap-2 mt-5">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-navy-700 hover:bg-navy-600 text-sm">{t('common.cancel')}</button>
                    <button
                        onClick={submit}
                        disabled={saving || !name.trim() || !sidebarName.trim()}
                        className="flex-1 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isEdit ? t('common.save') : t('common.create'))}
                    </button>
                </div>
            </div>
        </div>
    );
}

function UserCompanyAccessModal({
    user,
    companies,
    onClose,
    onSaved,
}: {
    user: UserWithCompanies;
    companies: Company[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const { t } = useTranslation();
    const [selected, setSelected] = useState<Set<number>>(new Set(user.company_ids ?? []));
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    // When removing a company where the user still owns open tasks, we surface a
    // confirmation listing the affected companies before actually saving.
    const [impact, setImpact] = useState<{ company_id: number; count: number }[] | null>(null);

    const toggle = (id: number) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
        setImpact(null); // editing the selection invalidates a pending warning
    };

    const performSave = async () => {
        setSaving(true);
        setErr('');
        try {
            await adminUserCompaniesApi.setUserCompanies(user.id, Array.from(selected));
            onSaved();
        } catch (e: any) {
            setErr(e.response?.data?.error ?? t('common.error_saving'));
        } finally {
            setSaving(false);
        }
    };

    const save = async () => {
        setErr('');
        // Warn before stripping companies where the user still owns open tasks —
        // removing them would orphan those tasks (see PRP 009).
        const removed = (user.company_ids ?? []).filter((id) => !selected.has(id));
        if (removed.length > 0) {
            setSaving(true);
            try {
                const counts = await adminUserCompaniesApi.taskCounts(user.id, removed);
                const impacted = counts.filter((c) => c.count > 0);
                if (impacted.length > 0) {
                    setImpact(impacted);
                    setSaving(false);
                    return; // wait for explicit confirmation
                }
            } catch {
                // If the impact check fails, don't block saving — fall through.
            }
            setSaving(false);
        }
        await performSave();
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-base font-semibold">{t('admin_companies.modal_user_access_title')}</h3>
                        <p className="text-xs text-navy-400">{user.display_name} · {user.email}</p>
                    </div>
                    <button onClick={onClose} className="text-navy-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                {err && <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">{err}</div>}

                <div className="space-y-2 max-h-72 overflow-y-auto">
                    {companies.map((c) => {
                        const checked = selected.has(c.id);
                        return (
                            <label
                                key={c.id}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                    checked ? 'bg-blue-500/10 border border-blue-500/40' : 'bg-navy-800/50 border border-navy-700/50 hover:bg-navy-700/50'
                                }`}
                            >
                                <input type="checkbox" checked={checked} onChange={() => toggle(c.id)} className="accent-blue-500" />
                                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{c.sidebar_name}</p>
                                    <p className="text-[11px] text-navy-400">{c.name}</p>
                                </div>
                            </label>
                        );
                    })}
                </div>

                {impact && (
                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs">
                        <p className="text-amber-300 font-medium mb-1.5">{t('admin_companies.removal_warning_title')}</p>
                        <p className="text-navy-300 mb-2">{t('admin_companies.removal_warning_intro', { name: user.display_name })}</p>
                        <ul className="space-y-1">
                            {impact.map((i) => {
                                const co = companies.find((c) => c.id === i.company_id);
                                return (
                                    <li key={i.company_id} className="text-navy-200">
                                        • {co?.name ?? i.company_id} — {t('admin_companies.removal_warning_count', { count: i.count })}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                <div className="flex gap-2 mt-5">
                    <button
                        onClick={impact ? () => setImpact(null) : onClose}
                        className="flex-1 py-2 rounded-lg bg-navy-700 hover:bg-navy-600 text-sm"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={impact ? performSave : save}
                        disabled={saving}
                        className={`flex-1 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 ${impact ? 'bg-amber-500 hover:bg-amber-400' : 'bg-blue-500 hover:bg-blue-400'}`}
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (impact ? t('admin_companies.removal_confirm') : t('common.save'))}
                    </button>
                </div>
            </div>
        </div>
    );
}

const inputCls = 'w-full bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-xs font-medium text-navy-400 mb-1.5 block">{label}</label>
            {children}
        </div>
    );
}
