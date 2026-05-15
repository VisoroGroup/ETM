import React, { useEffect, useState } from 'react';
import {
    Settings, Plus, Edit2, Trash2, Loader2, RefreshCw, X,
    Layers, Tag, Briefcase, ListChecks, Bell,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
    pugAdminApi,
    PugStage, PugStatus, PugWorkType, PugCustomField, PugReminderLevel,
} from '../../services/api';
import { useTranslation, TFunction } from '../../i18n/I18nContext';

type TabKey = 'stages' | 'statuses' | 'work_types' | 'custom_fields' | 'reminders';

const DEFAULT_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#94A3B8'];

const inputCls = 'w-full bg-navy-800 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500';

const FIELD_TYPE_OPTIONS = (t: TFunction): { value: PugCustomField['field_type']; label: string }[] => [
    { value: 'text', label: t('pug_config.field_type_text') },
    { value: 'number', label: t('pug_config.field_type_number') },
    { value: 'date', label: t('pug_config.field_type_date') },
    { value: 'boolean', label: t('pug_config.field_type_boolean') },
    { value: 'select', label: t('pug_config.field_type_select') },
];

export default function PugConfigPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'superadmin';
    const [tab, setTab] = useState<TabKey>('stages');

    const [stages, setStages] = useState<PugStage[]>([]);
    const [statuses, setStatuses] = useState<PugStatus[]>([]);
    const [workTypes, setWorkTypes] = useState<PugWorkType[]>([]);
    const [customFields, setCustomFields] = useState<PugCustomField[]>([]);
    const [reminderLevels, setReminderLevels] = useState<PugReminderLevel[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [s, st, wt, cf, rl] = await Promise.all([
                pugAdminApi.listStages(),
                pugAdminApi.listStatuses(),
                pugAdminApi.listWorkTypes(),
                pugAdminApi.listCustomFields(),
                pugAdminApi.listReminderLevels(),
            ]);
            setStages(s.stages);
            setStatuses(st.statuses);
            setWorkTypes(wt.work_types);
            setCustomFields(cf.fields);
            setReminderLevels(rl.levels);
        } catch (e: any) {
            setError(e.response?.data?.error ?? t('common.error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

    const tabs: { key: TabKey; label: string; icon: any }[] = [
        { key: 'stages', label: t('pug_config.tab_stages'), icon: Layers },
        { key: 'statuses', label: t('pug_config.tab_statuses'), icon: Tag },
        { key: 'work_types', label: t('pug_config.tab_work_types'), icon: Briefcase },
        { key: 'custom_fields', label: t('pug_config.tab_custom_fields'), icon: ListChecks },
        { key: 'reminders', label: t('pug_reminders.tab'), icon: Bell },
    ];

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Settings className="w-6 h-6 text-blue-400" />
                    <div>
                        <h1 className="text-xl font-bold">{t('pug_config.title')}</h1>
                        <p className="text-xs text-navy-400">{t('pug_config.subtitle')}</p>
                    </div>
                </div>
                <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-sm">
                    <RefreshCw className="w-4 h-4" />
                    {t('admin_users.reload')}
                </button>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-4 border-b border-navy-700/50 overflow-x-auto">
                {tabs.map(({ key, label, icon: Icon }) => {
                    const active = tab === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                active
                                    ? 'border-blue-400 text-blue-400'
                                    : 'border-transparent text-navy-300 hover:text-white'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
            ) : (
                <>
                    {tab === 'stages' && (
                        <StagesPanel
                            stages={stages}
                            isSuperAdmin={isSuperAdmin}
                            onChanged={load}
                            onError={setError}
                        />
                    )}
                    {tab === 'statuses' && (
                        <StatusesPanel
                            statuses={statuses}
                            isSuperAdmin={isSuperAdmin}
                            onChanged={load}
                            onError={setError}
                        />
                    )}
                    {tab === 'work_types' && (
                        <WorkTypesPanel
                            workTypes={workTypes}
                            isSuperAdmin={isSuperAdmin}
                            onChanged={load}
                            onError={setError}
                        />
                    )}
                    {tab === 'custom_fields' && (
                        <CustomFieldsPanel
                            fields={customFields}
                            isSuperAdmin={isSuperAdmin}
                            onChanged={load}
                            onError={setError}
                        />
                    )}
                    {tab === 'reminders' && (
                        <ReminderLevelsPanel
                            levels={reminderLevels}
                            isSuperAdmin={isSuperAdmin}
                            onChanged={load}
                            onError={setError}
                        />
                    )}
                </>
            )}
        </div>
    );
}

/* -------------------- Stages -------------------- */

function StagesPanel({
    stages, isSuperAdmin, onChanged, onError,
}: {
    stages: PugStage[];
    isSuperAdmin: boolean;
    onChanged: () => Promise<void> | void;
    onError: (msg: string) => void;
}) {
    const { t } = useTranslation();
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<PugStage | null>(null);

    const onDelete = async (s: PugStage) => {
        if (!window.confirm(t('pug_config.delete_confirm', { name: s.name }))) return;
        try {
            await pugAdminApi.deleteStage(s.id);
            await onChanged();
        } catch (e: any) {
            onError(e.response?.data?.error ?? t('common.error_saving'));
        }
    };

    return (
        <div className="bg-navy-800/30 border border-navy-700/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-navy-700/50 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{t('pug_config.tab_stages')}</h2>
                {isSuperAdmin && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-xs font-medium"
                    >
                        <Plus className="w-3.5 h-3.5" /> {t('pug_config.add_stage')}
                    </button>
                )}
            </div>

            {stages.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-navy-400">{t('pug_config.empty_stages')}</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-navy-700/50">
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_color')}</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_name')}</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_icon')}</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_sort_order')}</th>
                                <th className="text-center px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_is_default')}</th>
                                <th className="text-center px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_is_active')}</th>
                                {isSuperAdmin && <th className="text-right px-4 py-2.5 text-xs text-navy-400 font-medium">{t('common.actions')}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {stages.map((s) => (
                                <tr key={s.id} className="border-b border-navy-700/30 hover:bg-navy-700/20">
                                    <td className="px-4 py-3">
                                        <span className="inline-block w-4 h-4 rounded-full border border-navy-700" style={{ backgroundColor: s.color }} />
                                    </td>
                                    <td className="px-4 py-3 font-medium text-xs">{s.name}</td>
                                    <td className="px-4 py-3 text-xs text-navy-300 font-mono">{s.icon ?? '—'}</td>
                                    <td className="px-4 py-3 text-xs">{s.sort_order}</td>
                                    <td className="px-4 py-3 text-center"><Check on={s.is_default} /></td>
                                    <td className="px-4 py-3 text-center"><Check on={s.is_active} /></td>
                                    {isSuperAdmin && (
                                        <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                                            <button onClick={() => setEditing(s)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy-700 hover:bg-navy-600 text-xs" title={t('common.edit')}>
                                                <Edit2 className="w-3 h-3" />
                                            </button>
                                            <button onClick={() => onDelete(s)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy-700 hover:bg-red-500/30 text-xs text-red-300" title={t('common.delete')}>
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showCreate && (
                <StageEditorModal
                    onClose={() => setShowCreate(false)}
                    onSaved={async () => { setShowCreate(false); await onChanged(); }}
                />
            )}
            {editing && (
                <StageEditorModal
                    stage={editing}
                    onClose={() => setEditing(null)}
                    onSaved={async () => { setEditing(null); await onChanged(); }}
                />
            )}
        </div>
    );
}

function StageEditorModal({ stage, onClose, onSaved }: { stage?: PugStage; onClose: () => void; onSaved: () => void }) {
    const { t } = useTranslation();
    const isEdit = !!stage;
    const [name, setName] = useState(stage?.name ?? '');
    const [icon, setIcon] = useState(stage?.icon ?? '');
    const [color, setColor] = useState(stage?.color ?? DEFAULT_COLORS[1]);
    const [sortOrder, setSortOrder] = useState<number>(stage?.sort_order ?? 0);
    const [isDefault, setIsDefault] = useState(stage?.is_default ?? false);
    const [isActive, setIsActive] = useState(stage?.is_active ?? true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        if (!name.trim()) { setErr(t('pug_config.name_required')); return; }
        setSaving(true); setErr('');
        try {
            const payload: Partial<PugStage> = {
                name: name.trim(),
                icon: icon.trim() || null,
                color,
                sort_order: sortOrder,
                is_default: isDefault,
                is_active: isActive,
            };
            if (isEdit) await pugAdminApi.updateStage(stage!.id, payload);
            else await pugAdminApi.createStage(payload);
            onSaved();
        } catch (e: any) {
            setErr(e.response?.data?.error ?? t('common.error_saving'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={isEdit ? t('pug_config.edit_stage') : t('pug_config.add_stage')} onClose={onClose} err={err}>
            <Field label={t('pug_config.col_name')}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('pug_config.name_placeholder')} className={inputCls} />
            </Field>
            <Field label={t('pug_config.col_color')}>
                <ColorPicker color={color} onChange={setColor} />
            </Field>
            <Field label={t('pug_config.col_icon')}>
                <input value={icon ?? ''} onChange={(e) => setIcon(e.target.value)} placeholder={t('pug_config.icon_placeholder')} className={inputCls} />
            </Field>
            <Field label={t('pug_config.col_sort_order')}>
                <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value || '0', 10))} className={inputCls} />
            </Field>
            <CheckboxRow label={t('pug_config.col_is_default')} checked={isDefault} onChange={setIsDefault} />
            <CheckboxRow label={t('pug_config.col_is_active')} checked={isActive} onChange={setIsActive} />
            <ModalActions onClose={onClose} onSubmit={submit} saving={saving} isEdit={isEdit} disabled={!name.trim()} />
        </Modal>
    );
}

/* -------------------- Statuses -------------------- */

function StatusesPanel({
    statuses, isSuperAdmin, onChanged, onError,
}: {
    statuses: PugStatus[];
    isSuperAdmin: boolean;
    onChanged: () => Promise<void> | void;
    onError: (msg: string) => void;
}) {
    const { t } = useTranslation();
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<PugStatus | null>(null);

    const onDelete = async (s: PugStatus) => {
        if (!window.confirm(t('pug_config.delete_confirm', { name: s.name }))) return;
        try {
            await pugAdminApi.deleteStatus(s.id);
            await onChanged();
        } catch (e: any) {
            onError(e.response?.data?.error ?? t('common.error_saving'));
        }
    };

    return (
        <div className="bg-navy-800/30 border border-navy-700/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-navy-700/50 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{t('pug_config.tab_statuses')}</h2>
                {isSuperAdmin && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-xs font-medium"
                    >
                        <Plus className="w-3.5 h-3.5" /> {t('pug_config.add_status')}
                    </button>
                )}
            </div>

            {statuses.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-navy-400">{t('pug_config.empty_statuses')}</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-navy-700/50">
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_color')}</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_name')}</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_sort_order')}</th>
                                <th className="text-center px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_is_initial')}</th>
                                <th className="text-center px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_is_terminal')}</th>
                                <th className="text-center px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_is_active')}</th>
                                {isSuperAdmin && <th className="text-right px-4 py-2.5 text-xs text-navy-400 font-medium">{t('common.actions')}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {statuses.map((s) => (
                                <tr key={s.id} className="border-b border-navy-700/30 hover:bg-navy-700/20">
                                    <td className="px-4 py-3">
                                        <span className="inline-block w-4 h-4 rounded-full border border-navy-700" style={{ backgroundColor: s.color }} />
                                    </td>
                                    <td className="px-4 py-3 font-medium text-xs">{s.name}</td>
                                    <td className="px-4 py-3 text-xs">{s.sort_order}</td>
                                    <td className="px-4 py-3 text-center"><Check on={s.is_initial} /></td>
                                    <td className="px-4 py-3 text-center"><Check on={s.is_terminal} /></td>
                                    <td className="px-4 py-3 text-center"><Check on={s.is_active} /></td>
                                    {isSuperAdmin && (
                                        <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                                            <button onClick={() => setEditing(s)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy-700 hover:bg-navy-600 text-xs" title={t('common.edit')}>
                                                <Edit2 className="w-3 h-3" />
                                            </button>
                                            <button onClick={() => onDelete(s)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy-700 hover:bg-red-500/30 text-xs text-red-300" title={t('common.delete')}>
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showCreate && (
                <StatusEditorModal
                    onClose={() => setShowCreate(false)}
                    onSaved={async () => { setShowCreate(false); await onChanged(); }}
                />
            )}
            {editing && (
                <StatusEditorModal
                    status={editing}
                    onClose={() => setEditing(null)}
                    onSaved={async () => { setEditing(null); await onChanged(); }}
                />
            )}
        </div>
    );
}

function StatusEditorModal({ status, onClose, onSaved }: { status?: PugStatus; onClose: () => void; onSaved: () => void }) {
    const { t } = useTranslation();
    const isEdit = !!status;
    const [name, setName] = useState(status?.name ?? '');
    const [color, setColor] = useState(status?.color ?? DEFAULT_COLORS[1]);
    const [sortOrder, setSortOrder] = useState<number>(status?.sort_order ?? 0);
    const [isInitial, setIsInitial] = useState(status?.is_initial ?? false);
    const [isTerminal, setIsTerminal] = useState(status?.is_terminal ?? false);
    const [isActive, setIsActive] = useState(status?.is_active ?? true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        if (!name.trim()) { setErr(t('pug_config.name_required')); return; }
        setSaving(true); setErr('');
        try {
            const payload: Partial<PugStatus> = {
                name: name.trim(),
                color,
                sort_order: sortOrder,
                is_initial: isInitial,
                is_terminal: isTerminal,
                is_active: isActive,
            };
            if (isEdit) await pugAdminApi.updateStatus(status!.id, payload);
            else await pugAdminApi.createStatus(payload);
            onSaved();
        } catch (e: any) {
            setErr(e.response?.data?.error ?? t('common.error_saving'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={isEdit ? t('pug_config.edit_status') : t('pug_config.add_status')} onClose={onClose} err={err}>
            <Field label={t('pug_config.col_name')}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('pug_config.name_placeholder')} className={inputCls} />
            </Field>
            <Field label={t('pug_config.col_color')}>
                <ColorPicker color={color} onChange={setColor} />
            </Field>
            <Field label={t('pug_config.col_sort_order')}>
                <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value || '0', 10))} className={inputCls} />
            </Field>
            <CheckboxRow label={t('pug_config.col_is_initial')} checked={isInitial} onChange={setIsInitial} />
            <CheckboxRow label={t('pug_config.col_is_terminal')} checked={isTerminal} onChange={setIsTerminal} />
            <CheckboxRow label={t('pug_config.col_is_active')} checked={isActive} onChange={setIsActive} />
            <ModalActions onClose={onClose} onSubmit={submit} saving={saving} isEdit={isEdit} disabled={!name.trim()} />
        </Modal>
    );
}

/* -------------------- Work types -------------------- */

function WorkTypesPanel({
    workTypes, isSuperAdmin, onChanged, onError,
}: {
    workTypes: PugWorkType[];
    isSuperAdmin: boolean;
    onChanged: () => Promise<void> | void;
    onError: (msg: string) => void;
}) {
    const { t } = useTranslation();
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<PugWorkType | null>(null);

    const onDelete = async (w: PugWorkType) => {
        if (!window.confirm(t('pug_config.delete_confirm', { name: w.name }))) return;
        try {
            await pugAdminApi.deleteWorkType(w.id);
            await onChanged();
        } catch (e: any) {
            onError(e.response?.data?.error ?? t('common.error_saving'));
        }
    };

    return (
        <div className="bg-navy-800/30 border border-navy-700/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-navy-700/50 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{t('pug_config.tab_work_types')}</h2>
                {isSuperAdmin && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-xs font-medium"
                    >
                        <Plus className="w-3.5 h-3.5" /> {t('pug_config.add_work_type')}
                    </button>
                )}
            </div>

            {workTypes.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-navy-400">{t('pug_config.empty_work_types')}</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-navy-700/50">
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_name')}</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_sort_order')}</th>
                                <th className="text-center px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_is_active')}</th>
                                {isSuperAdmin && <th className="text-right px-4 py-2.5 text-xs text-navy-400 font-medium">{t('common.actions')}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {workTypes.map((w) => (
                                <tr key={w.id} className="border-b border-navy-700/30 hover:bg-navy-700/20">
                                    <td className="px-4 py-3 font-medium text-xs">{w.name}</td>
                                    <td className="px-4 py-3 text-xs">{w.sort_order}</td>
                                    <td className="px-4 py-3 text-center"><Check on={w.is_active} /></td>
                                    {isSuperAdmin && (
                                        <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                                            <button onClick={() => setEditing(w)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy-700 hover:bg-navy-600 text-xs" title={t('common.edit')}>
                                                <Edit2 className="w-3 h-3" />
                                            </button>
                                            <button onClick={() => onDelete(w)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy-700 hover:bg-red-500/30 text-xs text-red-300" title={t('common.delete')}>
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showCreate && (
                <WorkTypeEditorModal
                    onClose={() => setShowCreate(false)}
                    onSaved={async () => { setShowCreate(false); await onChanged(); }}
                />
            )}
            {editing && (
                <WorkTypeEditorModal
                    workType={editing}
                    onClose={() => setEditing(null)}
                    onSaved={async () => { setEditing(null); await onChanged(); }}
                />
            )}
        </div>
    );
}

function WorkTypeEditorModal({ workType, onClose, onSaved }: { workType?: PugWorkType; onClose: () => void; onSaved: () => void }) {
    const { t } = useTranslation();
    const isEdit = !!workType;
    const [name, setName] = useState(workType?.name ?? '');
    const [sortOrder, setSortOrder] = useState<number>(workType?.sort_order ?? 0);
    const [isActive, setIsActive] = useState(workType?.is_active ?? true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        if (!name.trim()) { setErr(t('pug_config.name_required')); return; }
        setSaving(true); setErr('');
        try {
            const payload: Partial<PugWorkType> = {
                name: name.trim(),
                sort_order: sortOrder,
                is_active: isActive,
            };
            if (isEdit) await pugAdminApi.updateWorkType(workType!.id, payload);
            else await pugAdminApi.createWorkType(payload);
            onSaved();
        } catch (e: any) {
            setErr(e.response?.data?.error ?? t('common.error_saving'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={isEdit ? t('pug_config.edit_work_type') : t('pug_config.add_work_type')} onClose={onClose} err={err}>
            <Field label={t('pug_config.col_name')}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('pug_config.work_type_placeholder')} className={inputCls} />
            </Field>
            <Field label={t('pug_config.col_sort_order')}>
                <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value || '0', 10))} className={inputCls} />
            </Field>
            <CheckboxRow label={t('pug_config.col_is_active')} checked={isActive} onChange={setIsActive} />
            <ModalActions onClose={onClose} onSubmit={submit} saving={saving} isEdit={isEdit} disabled={!name.trim()} />
        </Modal>
    );
}

/* -------------------- Custom fields -------------------- */

function optionsToArray(opts: any): string[] {
    if (Array.isArray(opts)) return opts.map((x) => String(x));
    if (opts && typeof opts === 'object' && Array.isArray(opts.values)) return opts.values.map((x: any) => String(x));
    return [];
}

function CustomFieldsPanel({
    fields, isSuperAdmin, onChanged, onError,
}: {
    fields: PugCustomField[];
    isSuperAdmin: boolean;
    onChanged: () => Promise<void> | void;
    onError: (msg: string) => void;
}) {
    const { t } = useTranslation();
    const fieldTypeOptions = FIELD_TYPE_OPTIONS(t);
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<PugCustomField | null>(null);

    const onDelete = async (f: PugCustomField) => {
        if (!window.confirm(t('pug_config.delete_confirm', { name: f.name }))) return;
        try {
            await pugAdminApi.deleteCustomField(f.id);
            await onChanged();
        } catch (e: any) {
            onError(e.response?.data?.error ?? t('common.error_saving'));
        }
    };

    const labelForType = (typ: PugCustomField['field_type']) =>
        fieldTypeOptions.find((o) => o.value === typ)?.label ?? typ;

    return (
        <div className="bg-navy-800/30 border border-navy-700/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-navy-700/50 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{t('pug_config.tab_custom_fields')}</h2>
                {isSuperAdmin && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-xs font-medium"
                    >
                        <Plus className="w-3.5 h-3.5" /> {t('pug_config.add_custom_field')}
                    </button>
                )}
            </div>

            {fields.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-navy-400">{t('pug_config.empty_custom_fields')}</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-navy-700/50">
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_name')}</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_field_type')}</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_options')}</th>
                                <th className="text-center px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_required')}</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_sort_order')}</th>
                                <th className="text-center px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_config.col_is_active')}</th>
                                {isSuperAdmin && <th className="text-right px-4 py-2.5 text-xs text-navy-400 font-medium">{t('common.actions')}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {fields.map((f) => {
                                const opts = optionsToArray(f.options);
                                return (
                                    <tr key={f.id} className="border-b border-navy-700/30 hover:bg-navy-700/20">
                                        <td className="px-4 py-3 font-medium text-xs">{f.name}</td>
                                        <td className="px-4 py-3 text-xs">{labelForType(f.field_type)}</td>
                                        <td className="px-4 py-3 text-xs text-navy-300">
                                            {f.field_type === 'select'
                                                ? (opts.length === 1
                                                    ? t('pug_config.options_count_one', { count: 1 })
                                                    : t('pug_config.options_count_many', { count: opts.length }))
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-center"><Check on={f.is_required} /></td>
                                        <td className="px-4 py-3 text-xs">{f.sort_order}</td>
                                        <td className="px-4 py-3 text-center"><Check on={f.is_active} /></td>
                                        {isSuperAdmin && (
                                            <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                                                <button onClick={() => setEditing(f)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy-700 hover:bg-navy-600 text-xs" title={t('common.edit')}>
                                                    <Edit2 className="w-3 h-3" />
                                                </button>
                                                <button onClick={() => onDelete(f)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy-700 hover:bg-red-500/30 text-xs text-red-300" title={t('common.delete')}>
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {showCreate && (
                <CustomFieldEditorModal
                    onClose={() => setShowCreate(false)}
                    onSaved={async () => { setShowCreate(false); await onChanged(); }}
                />
            )}
            {editing && (
                <CustomFieldEditorModal
                    field={editing}
                    onClose={() => setEditing(null)}
                    onSaved={async () => { setEditing(null); await onChanged(); }}
                />
            )}
        </div>
    );
}

function CustomFieldEditorModal({ field, onClose, onSaved }: { field?: PugCustomField; onClose: () => void; onSaved: () => void }) {
    const { t } = useTranslation();
    const fieldTypeOptions = FIELD_TYPE_OPTIONS(t);
    const isEdit = !!field;
    const [name, setName] = useState(field?.name ?? '');
    const [fieldType, setFieldType] = useState<PugCustomField['field_type']>(field?.field_type ?? 'text');
    const [optionsText, setOptionsText] = useState<string>(optionsToArray(field?.options).join(', '));
    const [isRequired, setIsRequired] = useState(field?.is_required ?? false);
    const [sortOrder, setSortOrder] = useState<number>(field?.sort_order ?? 0);
    const [isActive, setIsActive] = useState(field?.is_active ?? true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        if (!name.trim()) { setErr(t('pug_config.name_required')); return; }
        const parsedOptions = optionsText.split(',').map((s) => s.trim()).filter(Boolean);
        if (fieldType === 'select' && parsedOptions.length === 0) {
            setErr(t('pug_config.options_required'));
            return;
        }
        setSaving(true); setErr('');
        try {
            const payload: Partial<PugCustomField> = {
                name: name.trim(),
                field_type: fieldType,
                options: fieldType === 'select' ? { values: parsedOptions } : null,
                is_required: isRequired,
                sort_order: sortOrder,
                is_active: isActive,
            };
            if (isEdit) await pugAdminApi.updateCustomField(field!.id, payload);
            else await pugAdminApi.createCustomField(payload);
            onSaved();
        } catch (e: any) {
            setErr(e.response?.data?.error ?? t('common.error_saving'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={isEdit ? t('pug_config.edit_custom_field') : t('pug_config.add_custom_field')} onClose={onClose} err={err}>
            <Field label={t('pug_config.col_name')}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('pug_config.name_placeholder')} className={inputCls} />
            </Field>
            <Field label={t('pug_config.col_field_type')}>
                <select value={fieldType} onChange={(e) => setFieldType(e.target.value as PugCustomField['field_type'])} className={inputCls}>
                    {fieldTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </Field>
            {fieldType === 'select' && (
                <Field label={t('pug_config.options_label')}>
                    <textarea
                        value={optionsText}
                        onChange={(e) => setOptionsText(e.target.value)}
                        placeholder={t('pug_config.options_placeholder')}
                        rows={3}
                        className={inputCls}
                    />
                </Field>
            )}
            <Field label={t('pug_config.col_sort_order')}>
                <input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value || '0', 10))} className={inputCls} />
            </Field>
            <CheckboxRow label={t('pug_config.col_required')} checked={isRequired} onChange={setIsRequired} />
            <CheckboxRow label={t('pug_config.col_is_active')} checked={isActive} onChange={setIsActive} />
            <ModalActions onClose={onClose} onSubmit={submit} saving={saving} isEdit={isEdit} disabled={!name.trim()} />
        </Modal>
    );
}

/* -------------------- Reminder levels -------------------- */

function formatDaysBefore(t: TFunction, days: number): string {
    if (days === 0) return t('pug_reminders.day_of');
    if (days > 0) return t('pug_reminders.before', { days });
    return t('pug_reminders.after', { days: Math.abs(days) });
}

function ReminderLevelsPanel({
    levels, isSuperAdmin, onChanged, onError,
}: {
    levels: PugReminderLevel[];
    isSuperAdmin: boolean;
    onChanged: () => Promise<void> | void;
    onError: (msg: string) => void;
}) {
    const { t } = useTranslation();
    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<PugReminderLevel | null>(null);

    const onDelete = async (lv: PugReminderLevel) => {
        const label = formatDaysBefore(t, lv.days_before);
        if (!window.confirm(t('pug_config.delete_confirm', { name: label }))) return;
        try {
            await pugAdminApi.deleteReminderLevel(lv.id);
            await onChanged();
        } catch (e: any) {
            onError(e.response?.data?.error ?? t('common.error_saving'));
        }
    };

    const onToggle = async (lv: PugReminderLevel, next: boolean) => {
        try {
            await pugAdminApi.updateReminderLevel(lv.id, { is_enabled: next });
            await onChanged();
        } catch (e: any) {
            onError(e.response?.data?.error ?? t('common.error_saving'));
        }
    };

    return (
        <div className="bg-navy-800/30 border border-navy-700/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-navy-700/50 flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                    {t('pug_reminders.list_title', { count: levels.length })}
                </h2>
                {isSuperAdmin && (
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-xs font-medium"
                    >
                        <Plus className="w-3.5 h-3.5" /> {t('pug_reminders.add')}
                    </button>
                )}
            </div>

            <div className="px-4 py-3 text-xs text-navy-400 border-b border-navy-700/50">
                {t('pug_reminders.help_text')}
            </div>

            {levels.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-navy-400">{t('pug_reminders.empty')}</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-navy-700/50">
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_reminders.col_days')}</th>
                                <th className="text-center px-4 py-2.5 text-xs text-navy-400 font-medium">{t('pug_reminders.col_enabled')}</th>
                                {isSuperAdmin && <th className="text-right px-4 py-2.5 text-xs text-navy-400 font-medium">{t('common.actions')}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {levels.map((lv) => (
                                <tr key={lv.id} className="border-b border-navy-700/30 hover:bg-navy-700/20">
                                    <td className="px-4 py-3 text-xs">
                                        <span className="font-medium">{formatDaysBefore(t, lv.days_before)}</span>
                                        <span className="ml-2 text-navy-400 font-mono">({lv.days_before})</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={lv.is_enabled}
                                            disabled={!isSuperAdmin}
                                            onChange={(e) => onToggle(lv, e.target.checked)}
                                            className="accent-blue-500"
                                        />
                                    </td>
                                    {isSuperAdmin && (
                                        <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                                            <button onClick={() => setEditing(lv)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy-700 hover:bg-navy-600 text-xs" title={t('common.edit')}>
                                                <Edit2 className="w-3 h-3" />
                                            </button>
                                            <button onClick={() => onDelete(lv)} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-navy-700 hover:bg-red-500/30 text-xs text-red-300" title={t('common.delete')}>
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showCreate && (
                <ReminderLevelEditorModal
                    onClose={() => setShowCreate(false)}
                    onSaved={async () => { setShowCreate(false); await onChanged(); }}
                />
            )}
            {editing && (
                <ReminderLevelEditorModal
                    level={editing}
                    onClose={() => setEditing(null)}
                    onSaved={async () => { setEditing(null); await onChanged(); }}
                />
            )}
        </div>
    );
}

function ReminderLevelEditorModal({ level, onClose, onSaved }: { level?: PugReminderLevel; onClose: () => void; onSaved: () => void }) {
    const { t } = useTranslation();
    const isEdit = !!level;
    const [daysBefore, setDaysBefore] = useState<number>(level?.days_before ?? 7);
    const [isEnabled, setIsEnabled] = useState<boolean>(level?.is_enabled ?? true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        if (!Number.isInteger(daysBefore)) { setErr(t('pug_config.name_required')); return; }
        setSaving(true); setErr('');
        try {
            if (isEdit) {
                await pugAdminApi.updateReminderLevel(level!.id, { days_before: daysBefore, is_enabled: isEnabled });
            } else {
                await pugAdminApi.createReminderLevel({ days_before: daysBefore, is_enabled: isEnabled });
            }
            onSaved();
        } catch (e: any) {
            const apiErr = e.response?.data?.error;
            if (e.response?.status === 409) {
                setErr(t('pug_reminders.duplicate_error'));
            } else {
                setErr(apiErr ?? t('common.error_saving'));
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title={isEdit ? t('common.edit') : t('pug_reminders.add')} onClose={onClose} err={err}>
            <Field label={t('pug_reminders.field_days_before')}>
                <input
                    type="number"
                    value={daysBefore}
                    onChange={(e) => setDaysBefore(parseInt(e.target.value || '0', 10))}
                    className={inputCls}
                />
                <p className="text-xs text-navy-400 mt-1">{formatDaysBefore(t, daysBefore)}</p>
            </Field>
            <CheckboxRow label={t('pug_reminders.field_enabled')} checked={isEnabled} onChange={setIsEnabled} />
            <p className="text-xs text-navy-400">{t('pug_reminders.help_text')}</p>
            <ModalActions onClose={onClose} onSubmit={submit} saving={saving} isEdit={isEdit} />
        </Modal>
    );
}

/* -------------------- Shared bits -------------------- */

function Check({ on }: { on: boolean }) {
    return on
        ? <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400" />
        : <span className="inline-block w-2.5 h-2.5 rounded-full bg-navy-700" />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-xs font-medium text-navy-400 mb-1.5 block">{label}</label>
            {children}
        </div>
    );
}

function CheckboxRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-blue-500" />
            <span>{label}</span>
        </label>
    );
}

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
    return (
        <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={(e) => onChange(e.target.value)} className="w-10 h-9 bg-transparent cursor-pointer" />
            <input value={color} onChange={(e) => onChange(e.target.value)} placeholder="#3B82F6" className={inputCls + ' flex-1'} />
            <div className="flex gap-1 flex-wrap">
                {DEFAULT_COLORS.map((c) => (
                    <button
                        key={c}
                        type="button"
                        onClick={() => onChange(c)}
                        className="w-6 h-6 rounded border border-navy-700"
                        style={{ backgroundColor: c }}
                        aria-label={c}
                    />
                ))}
            </div>
        </div>
    );
}

function Modal({ title, onClose, err, children }: { title: string; onClose: () => void; err?: string; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold">{title}</h3>
                    <button onClick={onClose} className="text-navy-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                {err && <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">{err}</div>}
                <div className="space-y-3">{children}</div>
            </div>
        </div>
    );
}

function ModalActions({ onClose, onSubmit, saving, isEdit, disabled }: {
    onClose: () => void; onSubmit: () => void; saving: boolean; isEdit: boolean; disabled?: boolean;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex gap-2 mt-2">
            <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-navy-700 hover:bg-navy-600 text-sm">{t('common.cancel')}</button>
            <button
                onClick={onSubmit}
                disabled={saving || disabled}
                className="flex-1 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium disabled:opacity-50"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isEdit ? t('common.save') : t('common.create'))}
            </button>
        </div>
    );
}
