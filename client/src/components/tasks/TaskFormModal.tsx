import React, { useState, useEffect } from 'react';
import { tasksApi, authApi, departmentsApi, postsApi } from '../../services/api';
import { Department, DEPARTMENTS, RecurringFrequency, FREQUENCIES, User, OrgDepartment, OrgSection, OrgPost } from '../../types';
import { X, Calendar, Tag, FileText, RefreshCw, UserCircle, Building2, Layers, Briefcase, Plus } from 'lucide-react';
import { useTranslation } from '../../i18n/I18nContext';
import { useCompany } from '../../hooks/useCompany';

interface Props {
    onClose: () => void;
    onCreated: () => void;
}

export default function TaskFormModal({ onClose, onCreated }: Props) {
    const { t } = useTranslation();
    const { activeCompany } = useCompany();
    // Visoro Global ('full') uses the legacy department / section / post flow.
    // Hungary ('simple') and Neo Plan ('project') don't have an org structure —
    // they use a flat form with a direct assignee picker.
    const useFlatForm = activeCompany?.template_type !== 'full';
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [department, setDepartment] = useState<Department>('departament_1');
    const [assignedTo, setAssignedTo] = useState<string>('');
    const [assignedPostId, setAssignedPostId] = useState<string>('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<RecurringFrequency>('weekly');
    const [workdaysOnly, setWorkdaysOnly] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [users, setUsers] = useState<User[]>([]);

    // Org structure state
    const [orgDepts, setOrgDepts] = useState<OrgDepartment[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<string>('');
    const [selectedSectionId, setSelectedSectionId] = useState<string>('');

    // Inline "create new post" state
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [newPostName, setNewPostName] = useState('');
    const [newPostUserId, setNewPostUserId] = useState('');
    const [newPostDescription, setNewPostDescription] = useState('');
    const [creatingPost, setCreatingPost] = useState(false);

    function reloadOrgStructure(selectNewPostId?: string) {
        return departmentsApi.list().then(data => {
            setOrgDepts(data.departments || []);
            if (selectNewPostId) setAssignedPostId(selectNewPostId);
        });
    }

    async function handleCreatePost() {
        if (!newPostName.trim()) {
            setError(t('task_form.error_post_name_required'));
            return;
        }
        if (!newPostUserId) {
            setError(t('task_form.error_post_user_required'));
            return;
        }
        if (!selectedSectionId) {
            setError(t('task_form.error_select_section_first'));
            return;
        }
        try {
            setCreatingPost(true);
            setError('');
            const created = await postsApi.create(selectedSectionId, {
                name: newPostName.trim(),
                user_id: newPostUserId,
                description: newPostDescription.trim() || undefined,
            });
            await reloadOrgStructure(created.id);
            setShowCreatePost(false);
            setNewPostName('');
            setNewPostUserId('');
            setNewPostDescription('');
        } catch (err: any) {
            setError(err.response?.data?.error || t('task_form.error_creating_post'));
        } finally {
            setCreatingPost(false);
        }
    }

    useEffect(() => {
        authApi.users().then(setUsers).catch(() => {});
        // Only fetch the org tree for 'full' template companies. Hungary/Neo Plan
        // don't have departments, so the call would return an empty list anyway.
        if (!useFlatForm) {
            reloadOrgStructure().catch(() => {});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useFlatForm]);

    // When department changes, reset section and post
    const selectedDept = orgDepts.find(d => d.id === selectedDeptId);
    const availableSections = selectedDept?.sections || [];
    const selectedSection = availableSections.find(s => s.id === selectedSectionId);
    const availablePosts = selectedSection?.posts || [];
    const selectedPost = availablePosts.find(p => p.id === assignedPostId);

    // Auto-map org department to old department_label enum for backward compatibility
    const deptNameToEnum: Record<string, Department> = {
        '7 - Administrativ': 'departament_7',
        '1 - HR - Comunicare': 'departament_1',
        '2 - Vânzări': 'departament_2',
        '3 - Financiar': 'departament_3',
        '4 - Producție': 'departament_4',
        '5 - Calitate și calificare': 'departament_5',
        '6 - Extindere': 'departament_6',
    };

    useEffect(() => {
        if (selectedDept) {
            const enumVal = deptNameToEnum[selectedDept.name];
            if (enumVal) setDepartment(enumVal);
        }
    }, [selectedDeptId]);

    // Scope targets — sentinel values used inside the subdept/post dropdowns:
    //   SEL_DEPT_HEAD:    user picked "— Departament vezetőjének —" from the Subdept dropdown.
    //   SEL_SECTION_HEAD: user picked "— Subdept vezetőjének —" from the Post dropdown.
    const SEL_DEPT_HEAD = '__dept_head__';
    const SEL_SECTION_HEAD = '__section_head__';
    const isDeptHeadScope = selectedSectionId === SEL_DEPT_HEAD;
    const isSectionHeadScope = !isDeptHeadScope && assignedPostId === SEL_SECTION_HEAD;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim() || !dueDate) {
            setError(t('task_form.error_title_and_due_required'));
            return;
        }
        // Org-structure validation only applies to 'full' template companies.
        // For 'simple' (Hungary) and 'project' (Neo Plan), the only required
        // assignee is the direct user; no department / section / post is needed.
        const scopePayload: any = {};
        if (!useFlatForm) {
            if (!selectedDeptId) {
                setError(t('task_form.error_department_required'));
                return;
            }
            if (isDeptHeadScope) {
                scopePayload.assigned_department_id = selectedDeptId;
            } else {
                if (!selectedSectionId) {
                    setError(t('task_form.error_section_required'));
                    return;
                }
                if (isSectionHeadScope) {
                    scopePayload.assigned_section_id = selectedSectionId;
                } else {
                    if (!assignedPostId) {
                        setError(t('task_form.error_post_required'));
                        return;
                    }
                    scopePayload.assigned_post_id = assignedPostId;
                }
            }
        }

        try {
            setSaving(true);
            // department_label is a Romanian-Visoro-only concept (legacy enum). The DB
            // column is NOT NULL, so for non-'full' templates (Hungary, Neo Plan) we
            // still send the default value 'departament_1' — but the UI for those
            // templates never reads it, so the value is harmless. For 'full' template
            // it carries the org-mapped enum chosen by the user via the cascading
            // department picker.
            const task = await tasksApi.create({
                title: title.trim(),
                description: description.trim() || null,
                due_date: dueDate,
                department_label: department,
                assigned_to: assignedTo || null,
                ...scopePayload,
            } as any);

            // Set recurring if needed (non-blocking — task is already created)
            if (isRecurring && task.id) {
                try {
                    const { recurringApi } = await import('../../services/api');
                    await recurringApi.set(task.id, frequency, workdaysOnly);
                } catch (recurErr) {
                    console.error('Recurring setup failed:', recurErr);
                    setError(t('task_form.error_recurring_partial'));
                    setSaving(false);
                    // Still refresh the list so user sees the new task
                    onCreated();
                    return;
                }
            }

            onCreated();
        } catch (err: any) {
            setError(err.response?.data?.error || t('task_form.error_creating_task'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-lg bg-navy-900 border border-navy-700/50 rounded-2xl shadow-2xl animate-slide-up max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
                    <h2 className="text-lg font-bold">{t('tasks.new_task')}</h2>
                    <button onClick={onClose} className="text-navy-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
                    {error && (
                        <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</div>
                    )}

                    <div>
                        <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                            <FileText className="w-3.5 h-3.5 inline mr-1" /> {t('task_form.title_label')} *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            maxLength={500}
                            placeholder={t('task_form.title_placeholder')}
                            className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-navy-400 mb-1.5 block">{t('tasks.description')}</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            placeholder={t('task_form.description_placeholder')}
                            className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50 resize-none"
                        />
                    </div>

                    {/* Date */}
                    <div>
                        <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                            <Calendar className="w-3.5 h-3.5 inline mr-1" /> {t('tasks.due_date_long')} *
                        </label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                        />
                    </div>

                    {/* Flat assignee picker — only for non-'full' templates (Hungary, Neo Plan).
                        Visoro Global keeps the org-structure flow below this. */}
                    {useFlatForm && (
                        <div>
                            <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                                <UserCircle className="w-3.5 h-3.5 inline mr-1" /> {t('tasks.assigned_to')}
                            </label>
                            <select
                                value={assignedTo}
                                onChange={e => setAssignedTo(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                            >
                                <option value="">— {t('tasks.unassigned')} —</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Org structure: Department → Section → Post — all required for 'full' template */}
                    {!useFlatForm && (
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                                <Building2 className="w-3.5 h-3.5 inline mr-1" /> {t('tasks.department')} *
                            </label>
                            <select
                                value={selectedDeptId}
                                onChange={e => { setSelectedDeptId(e.target.value); setSelectedSectionId(''); setAssignedPostId(''); setShowCreatePost(false); }}
                                className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                            >
                                <option value="">— {t('task_form.select_department')} —</option>
                                {orgDepts.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        {selectedDeptId && (
                            <div>
                                <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                                    <Layers className="w-3.5 h-3.5 inline mr-1" /> {t('task_form.section')} *
                                </label>
                                <select
                                    value={selectedSectionId}
                                    onChange={e => { setSelectedSectionId(e.target.value); setAssignedPostId(''); setShowCreatePost(false); }}
                                    className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                                >
                                    <option value="">— {t('task_form.select_section')} —</option>
                                    {/* Dept-head scope option — only shown if the department has a head user */}
                                    {selectedDept?.head_user_name && (
                                        <option value={SEL_DEPT_HEAD}>
                                            — {t('task_form.assign_to_head', { name: selectedDept.head_user_name })} —
                                        </option>
                                    )}
                                    {availableSections.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                {isDeptHeadScope && (
                                    <p className="text-[10px] text-navy-400 mt-1">
                                        {t('task_form.auto_assignee')}: <span className="text-blue-400">{selectedDept?.head_user_name}</span>
                                        <span className="text-navy-500"> ({t('task_form.dept_head_role')})</span>
                                    </p>
                                )}
                            </div>
                        )}

                        {selectedSectionId && !isDeptHeadScope && !showCreatePost && (
                            <div>
                                <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                                    <Briefcase className="w-3.5 h-3.5 inline mr-1" /> {t('task_form.post_label')} *
                                </label>
                                <select
                                    value={assignedPostId}
                                    onChange={e => {
                                        if (e.target.value === '__create_new__') {
                                            setShowCreatePost(true);
                                            setAssignedPostId('');
                                        } else {
                                            setAssignedPostId(e.target.value);
                                        }
                                    }}
                                    className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                                >
                                    <option value="">— {t('task_form.select_post')} —</option>
                                    {/* Section-head scope option — only if the section has a head user */}
                                    {selectedSection?.head_user_name && (
                                        <option value={SEL_SECTION_HEAD}>
                                            — {t('task_form.assign_to_head', { name: selectedSection.head_user_name })} —
                                        </option>
                                    )}
                                    {availablePosts.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}{p.user_name ? ` → ${p.user_name}` : ` (${t('task_form.post_unoccupied')})`}
                                        </option>
                                    ))}
                                    <option value="__create_new__">+ {t('task_form.create_new_post')}</option>
                                </select>
                                {isSectionHeadScope && (
                                    <p className="text-[10px] text-navy-400 mt-1">
                                        {t('task_form.auto_assignee')}: <span className="text-blue-400">{selectedSection?.head_user_name}</span>
                                        <span className="text-navy-500"> ({t('task_form.section_head_role')})</span>
                                    </p>
                                )}
                                {!isSectionHeadScope && selectedPost?.user_name && (
                                    <p className="text-[10px] text-navy-400 mt-1">
                                        {t('task_form.auto_assignee')}: <span className="text-blue-400">{selectedPost.user_name}</span>
                                    </p>
                                )}
                            </div>
                        )}

                        {selectedSectionId && showCreatePost && (
                            <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-blue-300">
                                        <Plus className="w-3.5 h-3.5 inline mr-1" /> {t('task_form.new_post')}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => { setShowCreatePost(false); setNewPostName(''); setNewPostUserId(''); setNewPostDescription(''); setError(''); }}
                                        className="text-xs text-navy-400 hover:text-white"
                                    >
                                        {t('common.cancel')}
                                    </button>
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium text-navy-400 mb-1 block">{t('task_form.post_name')} *</label>
                                    <input
                                        type="text"
                                        value={newPostName}
                                        onChange={e => setNewPostName(e.target.value)}
                                        maxLength={200}
                                        placeholder={t('task_form.post_name_placeholder')}
                                        className="w-full px-3 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium text-navy-400 mb-1 block">{t('task_form.responsible_user')} *</label>
                                    <select
                                        value={newPostUserId}
                                        onChange={e => setNewPostUserId(e.target.value)}
                                        className="w-full px-3 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                                    >
                                        <option value="">— {t('task_form.select_responsible')} —</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium text-navy-400 mb-1 block">{t('task_form.description_optional')}</label>
                                    <textarea
                                        value={newPostDescription}
                                        onChange={e => setNewPostDescription(e.target.value)}
                                        rows={2}
                                        placeholder={t('task_form.post_description_placeholder')}
                                        className="w-full px-3 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50 resize-none"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCreatePost}
                                    disabled={creatingPost}
                                    className="w-full px-3 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
                                >
                                    {creatingPost ? t('task_form.saving') : t('task_form.save_post')}
                                </button>
                            </div>
                        )}
                    </div>
                    )}

                    {/* Recurring */}
                    <div className="bg-navy-800/30 rounded-lg p-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isRecurring}
                                onChange={e => setIsRecurring(e.target.checked)}
                                className="w-4 h-4 rounded border-navy-600 bg-navy-800 text-blue-500 focus:ring-blue-500"
                            />
                            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-sm">{t('task_form.recurring_task')}</span>
                        </label>
                        {isRecurring && (
                            <div className="mt-3 ml-6">
                                <select
                                    value={frequency}
                                    onChange={e => setFrequency(e.target.value as RecurringFrequency)}
                                    aria-label={t('task_form.recurrence_frequency')}
                                    className="w-full px-3 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                                >
                                    {(Object.keys(FREQUENCIES) as RecurringFrequency[]).map(f => (
                                        <option key={f} value={f}>{t(`task_form.frequency_${f}`)}</option>
                                    ))}
                                </select>
                                {frequency === 'daily' && (
                                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={workdaysOnly}
                                            onChange={e => setWorkdaysOnly(e.target.checked)}
                                            className="w-4 h-4 rounded border-navy-600 bg-navy-800 text-blue-500 focus:ring-blue-500"
                                        />
                                        <span className="text-xs text-navy-300">{t('task_form.workdays_only')}</span>
                                    </label>
                                )}
                                {/* Recurrence preview — plain-language explanation */}
                                {dueDate && (
                                    <p className="text-[11px] text-cyan-400/90 mt-2 italic">
                                        {(() => {
                                            const freq = t(`task_form.frequency_${frequency}`).toLowerCase();
                                            const prefix = frequency === 'daily' && workdaysOnly
                                                ? t('task_form.daily_workdays')
                                                : freq;
                                            return t('task_form.recurrence_preview', { prefix, date: dueDate });
                                        })()}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 bg-navy-800/50 text-navy-300 rounded-lg text-sm hover:bg-navy-700/50 transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-sm font-medium shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 transition-all"
                        >
                            {saving ? t('task_form.creating') : t('task_form.create_task')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
