import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Loader2, Edit2, Save, X, Plus, Trash2, Archive, ArchiveRestore,
    Calendar, MapPin, Building2, FileText, Users as UsersIcon, Layers, Tag,
    Check, AlertCircle,
} from 'lucide-react';
import {
    pugProjectsApi, pugAdminApi, authApi,
    PugStage, PugStatus, PugWorkType, PugCustomField,
} from '../../services/api';
import { useTranslation } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import UserAvatar from '../ui/UserAvatar';
import ProjectTasksSection from './ProjectTasksSection';
import ProjectFilesSection from './ProjectFilesSection';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface ProjectStageRow {
    id: string;
    stage_catalog_id: string;
    stage_name: string;
    icon: string | null;
    color: string;
    status_id: string | null;
    status_name: string | null;
    status_color: string | null;
    status_is_terminal: boolean;
    deadline: string | null;
    sort_order: number;
    notes: string | null;
}

interface ProjectResponsible {
    id: string;
    display_name: string;
    avatar_url: string | null;
    email: string;
}

interface ProjectFull {
    id: string;
    title: string;
    work_type_id: string | null;
    work_type_name: string | null;
    client_name: string | null;
    location: string | null;
    contract_number: string | null;
    contract_date: string | null;
    contract_amount: string | null;
    contract_currency: string | null;
    area_hectares: string | null;
    start_date: string | null;
    deadline: string | null;
    notes: string | null;
    is_archived: boolean;
    status: 'new' | 'active' | 'closed';
    stages: ProjectStageRow[];
    custom_field_values: Record<string, any>;
    responsibles: ProjectResponsible[];
}

interface AppUser {
    id: string;
    display_name: string;
    avatar_url: string | null;
    email: string;
}

const STATUS_BADGE: Record<ProjectFull['status'], { tk: string; cls: string }> = {
    new: { tk: 'projects.status_new', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    active: { tk: 'projects.status_active', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    closed: { tk: 'projects.status_closed', cls: 'bg-green-500/20 text-green-300 border-green-500/30' },
};

const inputCls = 'w-full bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500';

function formatDate(s: string | null | undefined): string {
    if (!s) return '—';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString();
}

// ─────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user } = useAuth();
    const { showToast } = useToast();

    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
    const isSuperadmin = user?.role === 'superadmin';

    const [project, setProject] = useState<ProjectFull | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Catalogs
    const [stagesCatalog, setStagesCatalog] = useState<PugStage[]>([]);
    const [statusesCatalog, setStatusesCatalog] = useState<PugStatus[]>([]);
    const [workTypes, setWorkTypes] = useState<PugWorkType[]>([]);
    const [customFields, setCustomFields] = useState<PugCustomField[]>([]);
    const [users, setUsers] = useState<AppUser[]>([]);

    // Inline title editor
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState('');

    // Modals
    const [showMetaEdit, setShowMetaEdit] = useState(false);
    const [showRespEdit, setShowRespEdit] = useState(false);
    const [showAddStage, setShowAddStage] = useState(false);

    const load = async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const [{ project: p }, sc, st, wt, cf, allUsers] = await Promise.all([
                pugProjectsApi.get(id),
                pugAdminApi.listStages(),
                pugAdminApi.listStatuses(),
                pugAdminApi.listWorkTypes(),
                pugAdminApi.listCustomFields(),
                authApi.users(),
            ]);
            setProject(p as ProjectFull);
            setStagesCatalog(sc.stages);
            setStatusesCatalog(st.statuses);
            setWorkTypes(wt.work_types);
            setCustomFields(cf.fields);
            setUsers(allUsers as any);
        } catch (e: any) {
            setError(e.response?.data?.error ?? t('common.error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

    const saveTitle = async () => {
        if (!project || !titleDraft.trim()) {
            setEditingTitle(false);
            return;
        }
        if (titleDraft.trim() === project.title) {
            setEditingTitle(false);
            return;
        }
        try {
            await pugProjectsApi.update(project.id, { title: titleDraft.trim() });
            showToast(t('common.save'), 'success');
            setEditingTitle(false);
            await load();
        } catch (e: any) {
            showToast(e.response?.data?.error ?? t('common.error_saving'), 'error');
        }
    };

    const onArchive = async () => {
        if (!project) return;
        try {
            await pugProjectsApi.archive(project.id, !project.is_archived);
            showToast(t('common.save'), 'success');
            await load();
        } catch (e: any) {
            showToast(e.response?.data?.error ?? t('common.error_saving'), 'error');
        }
    };

    // Download the per-project PDF. We bypass the standard <a href> path so
    // the JWT in localStorage and the active-company header are attached to
    // the GET; without them the server would 401. Uses axios so a failure
    // surfaces as a toast instead of a broken file download.
    const downloadProjectReport = async (projectId: string) => {
        try {
            const { api } = await import('../../services/api');
            const res = await api.get(`/pug/projects/${projectId}/report.pdf`, {
                responseType: 'blob',
            });
            const url = URL.createObjectURL(res.data as Blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `proiect_${project?.title?.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60) || projectId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e: any) {
            showToast(e.response?.data?.error ?? t('common.error_saving'), 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="p-4 md:p-6 max-w-4xl mx-auto">
                <button
                    onClick={() => navigate('/proiecte')}
                    className="flex items-center gap-1.5 text-sm text-navy-300 hover:text-white mb-4"
                >
                    <ArrowLeft className="w-4 h-4" /> {t('projects.detail_back')}
                </button>
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error || t('common.error_loading')}
                </div>
            </div>
        );
    }

    const badge = STATUS_BADGE[project.status];

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
            {/* Back link */}
            <button
                onClick={() => navigate('/proiecte')}
                className="flex items-center gap-1.5 text-xs text-navy-300 hover:text-white mb-4"
            >
                <ArrowLeft className="w-4 h-4" /> {t('projects.detail_back')}
            </button>

            {/* Header */}
            <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-5 mb-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                        {editingTitle && isAdmin ? (
                            <div className="flex items-center gap-2">
                                <input
                                    autoFocus
                                    value={titleDraft}
                                    onChange={(e) => setTitleDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveTitle();
                                        if (e.key === 'Escape') setEditingTitle(false);
                                    }}
                                    className={inputCls + ' text-base font-semibold'}
                                />
                                <button
                                    onClick={saveTitle}
                                    className="p-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white"
                                    aria-label={t('common.save')}
                                >
                                    <Save className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setEditingTitle(false)}
                                    className="p-2 rounded-lg bg-navy-700 hover:bg-navy-600 text-navy-200"
                                    aria-label={t('common.cancel')}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl md:text-2xl font-bold truncate">{project.title}</h1>
                                {isAdmin && (
                                    <button
                                        onClick={() => { setTitleDraft(project.title); setEditingTitle(true); }}
                                        className="text-navy-400 hover:text-white"
                                        title={t('common.edit')}
                                        aria-label={t('common.edit')}
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}
                        {project.work_type_name && (
                            <p className="text-xs text-navy-400 mt-1">{project.work_type_name}</p>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium border ${badge.cls}`}>
                            {t(badge.tk)}
                        </span>
                        {project.is_archived && (
                            <span className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-navy-700 text-navy-300 border border-navy-600">
                                {t('common.archived')}
                            </span>
                        )}
                        <a
                            href={`/api/pug/projects/${project.id}/report.pdf`}
                            // Magic-link headers can't be set via plain <a>; we
                            // attach the token + active company as query-string
                            // is overkill — just open in same tab and let the
                            // axios-style auth on the fetch fail loudly. The
                            // server uses cookies + JWT, so a fresh tab keeps
                            // the JWT in localStorage; the GET pulls the JWT
                            // via the standard authMiddleware. We rely on the
                            // page already being authenticated.
                            onClick={(e) => {
                                e.preventDefault();
                                downloadProjectReport(project.id);
                            }}
                            className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 flex items-center gap-1 cursor-pointer"
                        >
                            <FileText className="w-3.5 h-3.5" /> {t('projects.export_pdf')}
                        </a>
                        {isAdmin && (
                            <button
                                onClick={onArchive}
                                className="text-xs px-2.5 py-1 rounded-lg bg-navy-700 hover:bg-navy-600 text-navy-200 flex items-center gap-1"
                            >
                                {project.is_archived
                                    ? <><ArchiveRestore className="w-3.5 h-3.5" /> {t('admin_companies.unarchive')}</>
                                    : <><Archive className="w-3.5 h-3.5" /> {t('admin_companies.archive')}</>}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Meta + Responsibles */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
                {/* Meta panel */}
                <div className="lg:col-span-2 bg-navy-800/40 border border-navy-700/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-400" />
                            {t('projects.detail_meta')}
                        </h2>
                        {isAdmin && (
                            <button
                                onClick={() => setShowMetaEdit(true)}
                                className="text-xs px-2.5 py-1 rounded-lg bg-navy-700 hover:bg-navy-600 text-navy-200 flex items-center gap-1"
                            >
                                <Edit2 className="w-3.5 h-3.5" /> {t('projects.edit_meta')}
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <MetaRow
                            icon={<Building2 className="w-3.5 h-3.5" />}
                            label={t('projects.field_client')}
                            value={project.client_name}
                        />
                        <MetaRow
                            icon={<MapPin className="w-3.5 h-3.5" />}
                            label={t('projects.field_location')}
                            value={project.location}
                        />
                        <MetaRow
                            icon={<Tag className="w-3.5 h-3.5" />}
                            label={t('projects.field_work_type')}
                            value={project.work_type_name}
                        />
                        <MetaRow
                            icon={<FileText className="w-3.5 h-3.5" />}
                            label={t('projects.field_contract_number')}
                            value={project.contract_number}
                        />
                        <MetaRow
                            icon={<Calendar className="w-3.5 h-3.5" />}
                            label={t('projects.field_contract_date')}
                            value={formatDate(project.contract_date)}
                        />
                        <MetaRow
                            icon={<FileText className="w-3.5 h-3.5" />}
                            label={t('projects.field_contract_amount')}
                            value={project.contract_amount
                                ? `${project.contract_amount} ${project.contract_currency ?? ''}`.trim()
                                : null}
                        />
                        <MetaRow
                            icon={<MapPin className="w-3.5 h-3.5" />}
                            label={t('projects.field_area_hectares')}
                            value={project.area_hectares}
                        />
                        <MetaRow
                            icon={<Calendar className="w-3.5 h-3.5" />}
                            label={t('projects.field_start_date')}
                            value={formatDate(project.start_date)}
                        />
                        <MetaRow
                            icon={<Calendar className="w-3.5 h-3.5" />}
                            label={t('projects.field_deadline')}
                            value={formatDate(project.deadline)}
                        />
                        <MetaRow
                            icon={<FileText className="w-3.5 h-3.5" />}
                            label={t('projects.field_invoice_number')}
                            value={(project as any).invoice_number}
                        />
                        <MetaRow
                            icon={<Calendar className="w-3.5 h-3.5" />}
                            label={t('projects.field_invoice_issued_date')}
                            value={formatDate((project as any).invoice_issued_date)}
                        />
                        <MetaRow
                            icon={<Calendar className="w-3.5 h-3.5" />}
                            label={t('projects.field_paid_at')}
                            value={formatDate((project as any).paid_at)}
                        />
                    </div>
                    {project.notes && (
                        <div className="mt-3 pt-3 border-t border-navy-700/40">
                            <div className="text-[11px] uppercase tracking-wide text-navy-400 mb-1">
                                {t('projects.field_notes')}
                            </div>
                            <div className="text-sm text-navy-100 whitespace-pre-wrap">{project.notes}</div>
                        </div>
                    )}
                </div>

                {/* Responsibles panel */}
                <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                            <UsersIcon className="w-4 h-4 text-blue-400" />
                            {t('projects.responsibles')}
                        </h2>
                        {isAdmin && (
                            <button
                                onClick={() => setShowRespEdit(true)}
                                className="text-xs px-2.5 py-1 rounded-lg bg-navy-700 hover:bg-navy-600 text-navy-200 flex items-center gap-1"
                            >
                                <Edit2 className="w-3.5 h-3.5" /> {t('common.edit')}
                            </button>
                        )}
                    </div>
                    {project.responsibles.length === 0 ? (
                        <div className="text-xs text-navy-400">{t('projects.no_responsibles')}</div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {project.responsibles.map((r) => (
                                <div
                                    key={r.id}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-navy-700/40 border border-navy-700/50 text-xs"
                                    title={r.email}
                                >
                                    <UserAvatar name={r.display_name} avatarUrl={r.avatar_url} size="xs" />
                                    <span className="truncate max-w-[120px]">{r.display_name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Stages */}
            <StagesSection
                project={project}
                stagesCatalog={stagesCatalog}
                statusesCatalog={statusesCatalog}
                isAdmin={isAdmin}
                isSuperadmin={isSuperadmin}
                onChange={load}
                onAdd={() => setShowAddStage(true)}
            />

            {/* Custom fields */}
            {customFields.length > 0 && (
                <CustomFieldsSection
                    project={project}
                    fields={customFields}
                    isAdmin={isAdmin}
                    onSaved={load}
                />
            )}

            {/* Tasks attached to this project */}
            <ProjectTasksSection projectId={project.id} />

            {/* Project-scoped files (deliverables, plans, contract PDFs) */}
            <ProjectFilesSection projectId={project.id} />

            {/* Modals */}
            {showMetaEdit && (
                <MetaEditModal
                    project={project}
                    workTypes={workTypes}
                    onClose={() => setShowMetaEdit(false)}
                    onSaved={async () => { setShowMetaEdit(false); await load(); }}
                />
            )}
            {showRespEdit && (
                <ResponsiblesModal
                    project={project}
                    users={users}
                    onClose={() => setShowRespEdit(false)}
                    onSaved={async () => { setShowRespEdit(false); await load(); }}
                />
            )}
            {showAddStage && (
                <AddStageModal
                    project={project}
                    catalog={stagesCatalog}
                    statuses={statusesCatalog}
                    onClose={() => setShowAddStage(false)}
                    onSaved={async () => { setShowAddStage(false); await load(); }}
                />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────
// Meta row
// ─────────────────────────────────────────────────────────────────────────

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
    return (
        <div className="flex items-start gap-2 py-1">
            <div className="text-navy-400 mt-0.5 flex-shrink-0">{icon}</div>
            <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wide text-navy-400">{label}</div>
                <div className="text-sm text-navy-100 truncate">{value || '—'}</div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────
// Stages section
// ─────────────────────────────────────────────────────────────────────────

function StagesSection({
    project,
    stagesCatalog,
    statusesCatalog,
    isAdmin,
    isSuperadmin,
    onChange,
    onAdd,
}: {
    project: ProjectFull;
    stagesCatalog: PugStage[];
    statusesCatalog: PugStatus[];
    isAdmin: boolean;
    isSuperadmin: boolean;
    onChange: () => Promise<void>;
    onAdd: () => void;
}) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(null);
    const [deadlineDraft, setDeadlineDraft] = useState<string>('');
    const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
    const [notesDraft, setNotesDraft] = useState<string>('');
    const [statusOpenFor, setStatusOpenFor] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const sortedStages = useMemo(
        () => [...project.stages].sort((a, b) => a.sort_order - b.sort_order),
        [project.stages]
    );

    const updateStage = async (stage: ProjectStageRow, patch: { status_id?: string | null; deadline?: string | null; notes?: string | null }) => {
        try {
            await pugProjectsApi.updateStage(project.id, stage.id, {
                status_id: 'status_id' in patch ? patch.status_id : stage.status_id,
                deadline: 'deadline' in patch ? patch.deadline : stage.deadline,
                sort_order: stage.sort_order,
                notes: 'notes' in patch ? patch.notes : stage.notes,
            });
            showToast(t('common.save'), 'success');
            await onChange();
        } catch (e: any) {
            showToast(e.response?.data?.error ?? t('common.error_saving'), 'error');
        }
    };

    const removeStage = async (stage: ProjectStageRow) => {
        try {
            await pugProjectsApi.deleteStage(project.id, stage.id);
            showToast(t('common.delete'), 'success');
            setConfirmDeleteId(null);
            await onChange();
        } catch (e: any) {
            showToast(e.response?.data?.error ?? t('common.error_saving'), 'error');
        }
    };

    return (
        <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    {t('projects.stages')}
                </h2>
                {isAdmin && (
                    <button
                        onClick={onAdd}
                        className="text-xs px-2.5 py-1 rounded-lg bg-blue-500 hover:bg-blue-400 text-white flex items-center gap-1"
                    >
                        <Plus className="w-3.5 h-3.5" /> {t('projects.add_stage')}
                    </button>
                )}
            </div>

            {sortedStages.length === 0 ? (
                <div className="text-center py-8 text-navy-400 text-sm">{t('projects.no_stages')}</div>
            ) : (
                <div className="space-y-2">
                    {sortedStages.map((s) => {
                        const statusOpen = statusOpenFor === s.id;
                        const editingD = editingDeadlineId === s.id;
                        const editingN = editingNotesId === s.id;
                        return (
                            <div
                                key={s.id}
                                className="bg-navy-900/40 border border-navy-700/40 rounded-lg p-3"
                                style={{ borderLeftColor: s.color, borderLeftWidth: 4 }}
                            >
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        {s.icon && <span className="text-base" aria-hidden>{s.icon}</span>}
                                        <span className="text-sm font-medium truncate">{s.stage_name}</span>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        {/* Status */}
                                        <div className="relative">
                                            <button
                                                onClick={() => isAdmin && setStatusOpenFor(statusOpen ? null : s.id)}
                                                disabled={!isAdmin}
                                                className="text-[11px] px-2 py-0.5 rounded-full font-medium border"
                                                style={{
                                                    backgroundColor: (s.status_color ?? '#475569') + '33',
                                                    color: s.status_color ?? '#cbd5e1',
                                                    borderColor: (s.status_color ?? '#475569') + '66',
                                                    cursor: isAdmin ? 'pointer' : 'default',
                                                }}
                                                title={isAdmin ? t('projects.change_status') : undefined}
                                            >
                                                {s.status_name ?? '—'}
                                            </button>
                                            {statusOpen && (
                                                <div className="absolute right-0 top-full mt-1 z-20 bg-navy-900 border border-navy-700 rounded-lg shadow-2xl p-1 min-w-[180px]">
                                                    {statusesCatalog.filter(x => x.is_active).map((st) => (
                                                        <button
                                                            key={st.id}
                                                            onClick={async () => {
                                                                setStatusOpenFor(null);
                                                                await updateStage(s, { status_id: st.id });
                                                            }}
                                                            className="w-full text-left px-2 py-1.5 rounded hover:bg-navy-800 text-xs flex items-center gap-2"
                                                        >
                                                            <span
                                                                className="w-2 h-2 rounded-full flex-shrink-0"
                                                                style={{ backgroundColor: st.color }}
                                                            />
                                                            <span className="truncate">{st.name}</span>
                                                            {s.status_id === st.id && <Check className="w-3 h-3 ml-auto text-blue-400" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Deadline */}
                                        {editingD ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="date"
                                                    value={deadlineDraft}
                                                    onChange={(e) => setDeadlineDraft(e.target.value)}
                                                    className="bg-navy-800 border border-navy-700 rounded px-2 py-0.5 text-xs text-white"
                                                />
                                                <button
                                                    onClick={async () => {
                                                        await updateStage(s, { deadline: deadlineDraft || null });
                                                        setEditingDeadlineId(null);
                                                    }}
                                                    className="p-1 rounded bg-blue-500 hover:bg-blue-400 text-white"
                                                    aria-label={t('common.save')}
                                                >
                                                    <Save className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => setEditingDeadlineId(null)}
                                                    className="p-1 rounded bg-navy-700 hover:bg-navy-600 text-navy-200"
                                                    aria-label={t('common.cancel')}
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    if (!isAdmin) return;
                                                    setDeadlineDraft(s.deadline ?? '');
                                                    setEditingDeadlineId(s.id);
                                                }}
                                                disabled={!isAdmin}
                                                className="text-[11px] px-2 py-0.5 rounded-md bg-navy-700/60 text-navy-200 flex items-center gap-1"
                                                style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                                                title={isAdmin ? t('projects.change_deadline') : undefined}
                                            >
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(s.deadline)}
                                            </button>
                                        )}

                                        {isSuperadmin && (
                                            <button
                                                onClick={() => setConfirmDeleteId(s.id)}
                                                className="p-1 rounded text-navy-400 hover:text-red-400 hover:bg-red-500/10"
                                                aria-label={t('common.delete')}
                                                title={t('common.delete')}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="mt-2 pl-1">
                                    {editingN ? (
                                        <div className="flex flex-col gap-2">
                                            <textarea
                                                value={notesDraft}
                                                onChange={(e) => setNotesDraft(e.target.value)}
                                                rows={2}
                                                className={inputCls + ' text-xs'}
                                                placeholder={t('projects.stage_notes_placeholder')}
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={async () => {
                                                        await updateStage(s, { notes: notesDraft.trim() || null });
                                                        setEditingNotesId(null);
                                                    }}
                                                    className="px-2 py-1 rounded bg-blue-500 hover:bg-blue-400 text-white text-xs flex items-center gap-1"
                                                >
                                                    <Save className="w-3 h-3" /> {t('common.save')}
                                                </button>
                                                <button
                                                    onClick={() => setEditingNotesId(null)}
                                                    className="px-2 py-1 rounded bg-navy-700 hover:bg-navy-600 text-navy-200 text-xs"
                                                >
                                                    {t('common.cancel')}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                if (!isAdmin) return;
                                                setNotesDraft(s.notes ?? '');
                                                setEditingNotesId(s.id);
                                            }}
                                            disabled={!isAdmin}
                                            className="text-xs text-navy-300 italic text-left w-full hover:text-navy-100 disabled:hover:text-navy-300"
                                            style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                                        >
                                            {s.notes || (isAdmin ? t('projects.add_note') : '—')}
                                        </button>
                                    )}
                                </div>

                                {confirmDeleteId === s.id && (
                                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300 flex items-center justify-between gap-2 flex-wrap">
                                        <span>{t('projects.confirm_remove_stage')}</span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => removeStage(s)}
                                                className="px-2 py-0.5 rounded bg-red-500 hover:bg-red-400 text-white"
                                            >
                                                {t('common.delete')}
                                            </button>
                                            <button
                                                onClick={() => setConfirmDeleteId(null)}
                                                className="px-2 py-0.5 rounded bg-navy-700 hover:bg-navy-600 text-navy-200"
                                            >
                                                {t('common.cancel')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────
// Custom fields section
// ─────────────────────────────────────────────────────────────────────────

function CustomFieldsSection({
    project,
    fields,
    isAdmin,
    onSaved,
}: {
    project: ProjectFull;
    fields: PugCustomField[];
    isAdmin: boolean;
    onSaved: () => Promise<void>;
}) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [values, setValues] = useState<Record<string, any>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setValues({ ...(project.custom_field_values || {}) });
    }, [project.custom_field_values]);

    const setValue = (id: string, v: any) => setValues((prev) => ({ ...prev, [id]: v }));

    const sorted = useMemo(
        () => [...fields].filter(f => f.is_active).sort((a, b) => a.sort_order - b.sort_order),
        [fields]
    );

    const dirty = useMemo(() => {
        const orig = project.custom_field_values || {};
        const keys = new Set([...Object.keys(orig), ...Object.keys(values)]);
        for (const k of keys) {
            const a = orig[k] ?? null;
            const b = values[k] ?? null;
            if (a !== b) return true;
        }
        return false;
    }, [values, project.custom_field_values]);

    const save = async () => {
        setSaving(true);
        try {
            await pugProjectsApi.setCustomFieldValues(project.id, values);
            showToast(t('common.save'), 'success');
            await onSaved();
        } catch (e: any) {
            showToast(e.response?.data?.error ?? t('common.error_saving'), 'error');
        } finally {
            setSaving(false);
        }
    };

    if (sorted.length === 0) return null;

    return (
        <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Tag className="w-4 h-4 text-blue-400" />
                    {t('projects.custom_fields')}
                </h2>
                {isAdmin && dirty && (
                    <button
                        onClick={save}
                        disabled={saving}
                        className="text-xs px-2.5 py-1 rounded-lg bg-blue-500 hover:bg-blue-400 text-white flex items-center gap-1 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {t('common.save')}
                    </button>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sorted.map((f) => (
                    <CustomFieldInput
                        key={f.id}
                        field={f}
                        value={values[f.id]}
                        onChange={(v) => setValue(f.id, v)}
                        disabled={!isAdmin}
                    />
                ))}
            </div>
        </div>
    );
}

function CustomFieldInput({
    field,
    value,
    onChange,
    disabled,
}: {
    field: PugCustomField;
    value: any;
    onChange: (v: any) => void;
    disabled: boolean;
}) {
    const label = field.name + (field.is_required ? ' *' : '');
    if (field.field_type === 'boolean') {
        return (
            <label className="flex items-center gap-2 text-sm text-navy-100 cursor-pointer select-none py-2">
                <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                    className="accent-blue-500"
                />
                {label}
            </label>
        );
    }
    if (field.field_type === 'select') {
        const opts: string[] = Array.isArray(field.options?.choices)
            ? field.options.choices
            : Array.isArray(field.options)
                ? field.options
                : [];
        return (
            <div>
                <label className="text-xs font-medium text-navy-400 mb-1 block">{label}</label>
                <select
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value || null)}
                    disabled={disabled}
                    className={inputCls}
                >
                    <option value="">—</option>
                    {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            </div>
        );
    }
    if (field.field_type === 'date') {
        return (
            <div>
                <label className="text-xs font-medium text-navy-400 mb-1 block">{label}</label>
                <input
                    type="date"
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value || null)}
                    disabled={disabled}
                    className={inputCls}
                />
            </div>
        );
    }
    if (field.field_type === 'number') {
        return (
            <div>
                <label className="text-xs font-medium text-navy-400 mb-1 block">{label}</label>
                <input
                    type="number"
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
                    disabled={disabled}
                    className={inputCls}
                />
            </div>
        );
    }
    // text
    return (
        <div>
            <label className="text-xs font-medium text-navy-400 mb-1 block">{label}</label>
            <input
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value || null)}
                disabled={disabled}
                className={inputCls}
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children, maxWidth = 'max-w-2xl' }: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    maxWidth?: string;
}) {
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className={`bg-navy-900 border border-navy-700 rounded-2xl w-full ${maxWidth} p-6 max-h-[90vh] overflow-y-auto`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold">{title}</h3>
                    <button onClick={onClose} className="text-navy-400 hover:text-white" aria-label="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function MetaEditModal({
    project,
    workTypes,
    onClose,
    onSaved,
}: {
    project: ProjectFull;
    workTypes: PugWorkType[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [workTypeId, setWorkTypeId] = useState<string>(project.work_type_id ?? '');
    const [clientName, setClientName] = useState(project.client_name ?? '');
    const [location, setLocation] = useState(project.location ?? '');
    const [contractNumber, setContractNumber] = useState(project.contract_number ?? '');
    const [contractDate, setContractDate] = useState(project.contract_date ?? '');
    const [contractAmount, setContractAmount] = useState(project.contract_amount ?? '');
    const [contractCurrency, setContractCurrency] = useState(project.contract_currency ?? 'RON');
    const [areaHa, setAreaHa] = useState(project.area_hectares ?? '');
    const [startDate, setStartDate] = useState(project.start_date ?? '');
    const [deadline, setDeadline] = useState(project.deadline ?? '');
    const [notes, setNotes] = useState(project.notes ?? '');
    // Minimum invoicing — three nullable fields added in migration 089.
    // Enough for "we issued the invoice on X, got paid on Y" without
    // resurrecting the full finance module.
    const [invoiceIssuedDate, setInvoiceIssuedDate] = useState((project as any).invoice_issued_date ?? '');
    const [invoiceNumber, setInvoiceNumber] = useState((project as any).invoice_number ?? '');
    const [paidAt, setPaidAt] = useState((project as any).paid_at ?? '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        setSaving(true);
        setErr('');
        try {
            await pugProjectsApi.update(project.id, {
                work_type_id: workTypeId || null,
                client_name: clientName.trim() || null,
                location: location.trim() || null,
                contract_number: contractNumber.trim() || null,
                contract_date: contractDate || null,
                contract_amount: contractAmount === '' || contractAmount == null ? null : Number(contractAmount),
                contract_currency: contractCurrency || 'RON',
                area_hectares: areaHa === '' || areaHa == null ? null : Number(areaHa),
                start_date: startDate || null,
                deadline: deadline || null,
                notes: notes.trim() || null,
                invoice_issued_date: invoiceIssuedDate || null,
                invoice_number: invoiceNumber.trim() || null,
                paid_at: paidAt || null,
            } as any);
            showToast(t('common.save'), 'success');
            onSaved();
        } catch (e: any) {
            setErr(e.response?.data?.error ?? t('common.error_saving'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell title={t('projects.edit_meta')} onClose={onClose}>
            {err && <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">{err}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={t('projects.field_work_type')}>
                    <select value={workTypeId} onChange={(e) => setWorkTypeId(e.target.value)} className={inputCls}>
                        <option value="">—</option>
                        {workTypes.filter(w => w.is_active).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
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
                    <input type="date" value={contractDate ?? ''} onChange={(e) => setContractDate(e.target.value)} className={inputCls} />
                </Field>
                <Field label={t('projects.field_contract_amount')}>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={contractAmount ?? ''}
                            onChange={(e) => setContractAmount(e.target.value)}
                            className={inputCls + ' flex-1'}
                        />
                        <select value={contractCurrency ?? 'RON'} onChange={(e) => setContractCurrency(e.target.value)} className={inputCls + ' w-20'}>
                            <option value="RON">RON</option>
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                        </select>
                    </div>
                </Field>
                <Field label={t('projects.field_area_hectares')}>
                    <input type="number" step="0.01" value={areaHa ?? ''} onChange={(e) => setAreaHa(e.target.value)} className={inputCls} />
                </Field>
                <Field label={t('projects.field_start_date')}>
                    <input type="date" value={startDate ?? ''} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                </Field>
                <Field label={t('projects.field_deadline')}>
                    <input type="date" value={deadline ?? ''} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
                </Field>
                <Field label={t('projects.field_notes')} className="md:col-span-2">
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />
                </Field>
                <Field label={t('projects.field_invoice_issued_date')}>
                    <input type="date" value={invoiceIssuedDate ?? ''} onChange={(e) => setInvoiceIssuedDate(e.target.value)} className={inputCls} />
                </Field>
                <Field label={t('projects.field_invoice_number')}>
                    <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputCls} />
                </Field>
                <Field label={t('projects.field_paid_at')}>
                    <input type="date" value={paidAt ?? ''} onChange={(e) => setPaidAt(e.target.value)} className={inputCls} />
                </Field>
            </div>
            <div className="flex gap-2 mt-5">
                <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-navy-700 hover:bg-navy-600 text-sm">{t('common.cancel')}</button>
                <button
                    onClick={submit}
                    disabled={saving}
                    className="flex-1 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('common.save')}
                </button>
            </div>
        </ModalShell>
    );
}

function ResponsiblesModal({
    project,
    users,
    onClose,
    onSaved,
}: {
    project: ProjectFull;
    users: AppUser[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [selected, setSelected] = useState<Set<string>>(
        new Set(project.responsibles.map(r => r.id))
    );
    const [saving, setSaving] = useState(false);

    const toggle = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const submit = async () => {
        setSaving(true);
        try {
            await pugProjectsApi.setResponsibles(project.id, Array.from(selected));
            showToast(t('common.save'), 'success');
            onSaved();
        } catch (e: any) {
            showToast(e.response?.data?.error ?? t('common.error_saving'), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell title={t('projects.field_responsibles')} onClose={onClose}>
            <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto">
                {users.map((u) => {
                    const on = selected.has(u.id);
                    return (
                        <button
                            key={u.id}
                            type="button"
                            onClick={() => toggle(u.id)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] border transition-colors ${
                                on ? 'bg-blue-500/20 border-blue-500/40 text-blue-200' : 'bg-navy-800/50 border-navy-700 text-navy-300 hover:bg-navy-700/50'
                            }`}
                        >
                            <UserAvatar name={u.display_name} avatarUrl={u.avatar_url} size="xs" />
                            {u.display_name}
                        </button>
                    );
                })}
            </div>
            <div className="flex gap-2 mt-5">
                <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-navy-700 hover:bg-navy-600 text-sm">{t('common.cancel')}</button>
                <button
                    onClick={submit}
                    disabled={saving}
                    className="flex-1 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('common.save')}
                </button>
            </div>
        </ModalShell>
    );
}

function AddStageModal({
    project,
    catalog,
    statuses,
    onClose,
    onSaved,
}: {
    project: ProjectFull;
    catalog: PugStage[];
    statuses: PugStatus[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const usedIds = useMemo(() => new Set(project.stages.map(s => s.stage_catalog_id)), [project.stages]);
    const available = useMemo(
        () => catalog.filter(c => c.is_active && !usedIds.has(c.id)).sort((a, b) => a.sort_order - b.sort_order),
        [catalog, usedIds]
    );
    const initialStatus = statuses.find(s => s.is_initial && s.is_active) ?? statuses[0];
    const [stageId, setStageId] = useState<string>(available[0]?.id ?? '');
    const [statusId, setStatusId] = useState<string>(initialStatus?.id ?? '');
    const [deadline, setDeadline] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        if (!stageId) { setErr(t('projects.add_stage_required')); return; }
        setSaving(true);
        setErr('');
        try {
            const nextSort = (project.stages.reduce((m, s) => Math.max(m, s.sort_order), 0)) + 10;
            await pugProjectsApi.addStage(project.id, {
                stage_catalog_id: stageId,
                status_id: statusId || null,
                deadline: deadline || null,
                sort_order: nextSort,
                notes: notes.trim() || null,
            });
            showToast(t('common.save'), 'success');
            onSaved();
        } catch (e: any) {
            setErr(e.response?.data?.error ?? t('common.error_saving'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell title={t('projects.add_stage')} onClose={onClose}>
            {err && <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">{err}</div>}
            {available.length === 0 ? (
                <div className="text-sm text-navy-300 py-4">{t('projects.all_stages_added')}</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label={t('projects.stage')} className="md:col-span-2">
                        <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={inputCls}>
                            {available.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.icon ? `${c.icon} ` : ''}{c.name}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label={t('common.status')}>
                        <select value={statusId} onChange={(e) => setStatusId(e.target.value)} className={inputCls}>
                            <option value="">—</option>
                            {statuses.filter(s => s.is_active).map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label={t('projects.field_deadline')}>
                        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
                    </Field>
                    <Field label={t('projects.field_notes')} className="md:col-span-2">
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
                    </Field>
                </div>
            )}
            <div className="flex gap-2 mt-5">
                <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-navy-700 hover:bg-navy-600 text-sm">{t('common.cancel')}</button>
                <button
                    onClick={submit}
                    disabled={saving || available.length === 0 || !stageId}
                    className="flex-1 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('common.add')}
                </button>
            </div>
        </ModalShell>
    );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <label className="text-xs font-medium text-navy-400 mb-1 block">{label}</label>
            {children}
        </div>
    );
}
