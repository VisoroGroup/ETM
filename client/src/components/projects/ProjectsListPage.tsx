import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Plus, Loader2, RefreshCw, X, Calendar, MapPin, Building2, Archive, ArchiveRestore } from 'lucide-react';
import { pugProjectsApi, pugAdminApi, PugProject, PugWorkType, authApi } from '../../services/api';
import { useTranslation } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import UserAvatar from '../ui/UserAvatar';

const STATUS_BADGE: Record<PugProject['status'], { label: string; cls: string }> = {
    new: { label: 'Nou', cls: 'bg-blue-500/20 text-blue-300' },
    active: { label: 'Activ', cls: 'bg-amber-500/20 text-amber-300' },
    closed: { label: 'Închis', cls: 'bg-green-500/20 text-green-300' },
};

export default function ProjectsListPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState<PugProject[]>([]);
    const [workTypes, setWorkTypes] = useState<PugWorkType[]>([]);
    const [users, setUsers] = useState<{ id: string; display_name: string; avatar_url: string | null; email: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [{ projects: ps }, { work_types }, allUsers] = await Promise.all([
                pugProjectsApi.list(showArchived),
                pugAdminApi.listWorkTypes(),
                authApi.users(),
            ]);
            setProjects(ps);
            setWorkTypes(work_types);
            setUsers(allUsers as any);
        } catch (e: any) {
            setError(e.response?.data?.error ?? t('common.error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [showArchived]);

    const onArchive = async (p: PugProject) => {
        try {
            await pugProjectsApi.archive(p.id, !p.is_archived);
            await load();
        } catch (e: any) {
            setError(e.response?.data?.error ?? t('common.error_saving'));
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Folder className="w-6 h-6 text-blue-400" />
                    <h1 className="text-xl font-bold">{t('projects.title')}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-navy-300 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showArchived}
                            onChange={(e) => setShowArchived(e.target.checked)}
                            className="accent-blue-500"
                        />
                        {t('projects.show_archived')}
                    </label>
                    <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-sm">
                        <RefreshCw className="w-4 h-4" /> {t('admin_users.reload')}
                    </button>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" /> {t('projects.new_project')}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
            ) : projects.length === 0 ? (
                <div className="text-center py-16 text-navy-400">
                    <Folder className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">{t('projects.empty_title')}</p>
                    <p className="text-xs opacity-70 mt-1">{t('projects.empty_subtitle')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.map((p) => (
                        <div
                            key={p.id}
                            onClick={() => navigate(`/proiecte/${p.id}`)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    navigate(`/proiecte/${p.id}`);
                                }
                            }}
                            className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-4 hover:bg-navy-800/60 hover:border-navy-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        >
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold truncate">{p.title}</h3>
                                    {p.work_type_name && (
                                        <p className="text-[11px] text-navy-400 mt-0.5">{p.work_type_name}</p>
                                    )}
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[p.status].cls}`}>
                                    {STATUS_BADGE[p.status].label}
                                </span>
                            </div>

                            {p.client_name && (
                                <div className="flex items-center gap-1.5 text-xs text-navy-300 mb-1">
                                    <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="truncate">{p.client_name}</span>
                                </div>
                            )}
                            {p.location && (
                                <div className="flex items-center gap-1.5 text-xs text-navy-300 mb-1">
                                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="truncate">{p.location}</span>
                                </div>
                            )}
                            {p.deadline && (
                                <div className="flex items-center gap-1.5 text-xs text-navy-300 mb-1">
                                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span>{new Date(p.deadline).toLocaleDateString()}</span>
                                </div>
                            )}

                            {p.responsibles.length > 0 && (
                                <div className="flex items-center gap-1 mt-3">
                                    {p.responsibles.slice(0, 4).map((r) => (
                                        <div key={r.id} title={r.display_name}>
                                            <UserAvatar name={r.display_name} avatarUrl={r.avatar_url} size="xs" />
                                        </div>
                                    ))}
                                    {p.responsibles.length > 4 && (
                                        <span className="text-[10px] text-navy-400 ml-1">+{p.responsibles.length - 4}</span>
                                    )}
                                </div>
                            )}

                            {isAdmin && (
                                <div className="flex justify-end mt-3 pt-3 border-t border-navy-700/40">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onArchive(p); }}
                                        className="text-[11px] text-navy-400 hover:text-navy-200 flex items-center gap-1"
                                    >
                                        {p.is_archived
                                            ? <><ArchiveRestore className="w-3.5 h-3.5" /> {t('admin_companies.unarchive')}</>
                                            : <><Archive className="w-3.5 h-3.5" /> {t('admin_companies.archive')}</>}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showCreate && (
                <CreateProjectModal
                    workTypes={workTypes}
                    users={users}
                    onClose={() => setShowCreate(false)}
                    onCreated={async () => { setShowCreate(false); await load(); }}
                />
            )}
        </div>
    );
}

function CreateProjectModal({
    workTypes,
    users,
    onClose,
    onCreated,
}: {
    workTypes: PugWorkType[];
    users: { id: string; display_name: string; avatar_url: string | null; email: string }[];
    onClose: () => void;
    onCreated: () => void;
}) {
    const { t } = useTranslation();
    const [title, setTitle] = useState('');
    const [workTypeId, setWorkTypeId] = useState<string>('');
    const [clientName, setClientName] = useState('');
    const [location, setLocation] = useState('');
    const [contractNumber, setContractNumber] = useState('');
    const [contractDate, setContractDate] = useState('');
    const [contractAmount, setContractAmount] = useState('');
    const [contractCurrency, setContractCurrency] = useState('RON');
    const [areaHa, setAreaHa] = useState('');
    const [startDate, setStartDate] = useState('');
    const [deadline, setDeadline] = useState('');
    const [notes, setNotes] = useState('');
    const [responsibleIds, setResponsibleIds] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        setErr('');
        if (!title.trim()) { setErr(t('projects.title_required')); return; }
        setSaving(true);
        try {
            await pugProjectsApi.create({
                title: title.trim(),
                work_type_id: workTypeId || null,
                client_name: clientName.trim() || null,
                location: location.trim() || null,
                contract_number: contractNumber.trim() || null,
                contract_date: contractDate || null,
                contract_amount: contractAmount ? Number(contractAmount) : null,
                contract_currency: contractCurrency || 'RON',
                area_hectares: areaHa ? Number(areaHa) : null,
                start_date: startDate || null,
                deadline: deadline || null,
                notes: notes.trim() || null,
                responsible_ids: Array.from(responsibleIds),
            });
            onCreated();
        } catch (e: any) {
            setErr(e.response?.data?.error ?? t('common.error_saving'));
        } finally {
            setSaving(false);
        }
    };

    const toggleResp = (id: string) => {
        setResponsibleIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold">{t('projects.new_project')}</h3>
                    <button onClick={onClose} className="text-navy-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                {err && <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">{err}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label={`${t('projects.field_title')} *`} className="md:col-span-2">
                        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="PUG Maroskeresztúr" className={inputCls} />
                    </Field>
                    <Field label={t('projects.field_work_type')}>
                        <select value={workTypeId} onChange={(e) => setWorkTypeId(e.target.value)} className={inputCls}>
                            <option value="">—</option>
                            {workTypes.filter((w) => w.is_active).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </Field>
                    <Field label={t('projects.field_client')}>
                        <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputCls} />
                    </Field>
                    <Field label={t('projects.field_location')} className="md:col-span-2">
                        <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />
                    </Field>
                    <Field label={t('projects.field_contract_number')}>
                        <input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} className={inputCls} />
                    </Field>
                    <Field label={t('projects.field_contract_date')}>
                        <input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className={inputCls} />
                    </Field>
                    <Field label={t('projects.field_contract_amount')}>
                        <div className="flex gap-2">
                            <input type="number" value={contractAmount} onChange={(e) => setContractAmount(e.target.value)} className={inputCls + ' flex-1'} />
                            <select value={contractCurrency} onChange={(e) => setContractCurrency(e.target.value)} className={inputCls + ' w-20'}>
                                <option value="RON">RON</option>
                                <option value="EUR">EUR</option>
                                <option value="USD">USD</option>
                            </select>
                        </div>
                    </Field>
                    <Field label={t('projects.field_area_hectares')}>
                        <input type="number" step="0.01" value={areaHa} onChange={(e) => setAreaHa(e.target.value)} className={inputCls} />
                    </Field>
                    <Field label={t('projects.field_start_date')}>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                    </Field>
                    <Field label={t('projects.field_deadline')}>
                        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
                    </Field>
                    <Field label={t('projects.field_notes')} className="md:col-span-2">
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />
                    </Field>
                    <Field label={t('projects.field_responsibles')} className="md:col-span-2">
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                            {users.map((u) => {
                                const on = responsibleIds.has(u.id);
                                return (
                                    <button
                                        key={u.id}
                                        type="button"
                                        onClick={() => toggleResp(u.id)}
                                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] border transition-colors ${
                                            on ? 'bg-blue-500/20 border-blue-500/40 text-blue-200' : 'bg-navy-800/50 border-navy-700 text-navy-300 hover:bg-navy-700/50'
                                        }`}
                                    >
                                        <UserAvatar name={u.display_name} avatarUrl={u.avatar_url} size="xs" />
                                        {u.display_name}
                                    </button>
                                );
                            })}
                        </div>
                    </Field>
                </div>

                <div className="flex gap-2 mt-5">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-navy-700 hover:bg-navy-600 text-sm">{t('common.cancel')}</button>
                    <button
                        onClick={submit}
                        disabled={saving || !title.trim()}
                        className="flex-1 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('common.create')}
                    </button>
                </div>
            </div>
        </div>
    );
}

const inputCls = 'w-full bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500';

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <label className="text-xs font-medium text-navy-400 mb-1 block">{label}</label>
            {children}
        </div>
    );
}
