import { useState, useEffect } from 'react';
import { SkeletonDrawer } from '../ui/Skeleton';
import { useTranslation } from '../../i18n/I18nContext';
import { useTaskDetail } from '../../hooks/useTaskDetail';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { tasksApi, notificationsApi } from '../../services/api';
import type { TaskDetail, TaskStatus, Department, TaskAlert, RecurringFrequency } from '../../types';
import { STATUSES, DEPARTMENTS, FREQUENCIES, statusLabel, departmentLabel } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useCompany } from '../../hooks/useCompany';
import { useToast } from '../../hooks/useToast';
import { getDueDateStatus, formatDate, formatDateFull, timeAgo, getDaysOverdue } from '../../utils/helpers';
import {
    X, Calendar, Tag, MessageSquare, Paperclip, Activity,
    ChevronDown, Ban, Trash2, Copy,
    Loader2, RefreshCw,
    CheckCircle2, ArrowRight, AlertTriangle, ShieldCheck, Pencil, Link2, ListChecks
} from 'lucide-react';

// Tab components
import SubtasksTab from './tabs/SubtasksTab';
import CommentsTab from './tabs/CommentsTab';
import FilesTab from './tabs/FilesTab';
import ActivityTab from './tabs/ActivityTab';
import AlertsTab from './tabs/AlertsTab';
import DependenciesTab from './tabs/DependenciesTab';
import ChecklistTab from './tabs/ChecklistTab';
import ErrorBoundary from '../ErrorBoundary';
import UserAvatar from '../ui/UserAvatar';

interface Props {
    taskId: string;
    onClose: () => void;
    onUpdate: () => void;
}

type Tab = 'subtasks' | 'checklist' | 'comments' | 'files' | 'activity' | 'alerts' | 'dependencies';

export default function TaskDrawer({ taskId, onClose, onUpdate }: Props) {
    const { t } = useTranslation();
    const td = useTaskDetail(taskId);
    const task = td.task;
    const loading = td.loading;
    const loadError = td.error;
    // Audit-3 H21/H24: Esc closes the drawer, focus restored on close.
    useModalDismiss(true, onClose);
    const [activeTab, setActiveTab] = useState<Tab>('subtasks');
    const [statusMenuOpen, setStatusMenuOpen] = useState(false);
    const { user, users } = useAuth();
    const { activeCompany } = useCompany();
    const { showToast } = useToast();
    // Visoro Global ('full') has the legacy department/section/post org structure.
    // Hungary ('simple') and Neo Plan ('project') don't — so the OrgAssignmentEditor
    // would be empty and confusing, and any department_label badge would show a
    // Romanian enum label that means nothing to those users.
    const isFullTemplate = activeCompany?.template_type === 'full';

    // Modals
    const [showBlockedModal, setShowBlockedModal] = useState(false);
    const [showDueDateModal, setShowDueDateModal] = useState(false);
    const [blockedReason, setBlockedReason] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    const [dueDateReason, setDueDateReason] = useState('');
    // For recurring tasks: should the rule shift too, or only this single instance?
    // Defaults to false (safer — only this instance) and is reset every time the modal opens.
    const [realignRecurring, setRealignRecurring] = useState(false);
    const [duplicating, setDuplicating] = useState(false);

    // Delete confirm
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Title edit
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitleValue, setEditTitleValue] = useState('');

    // Description edit
    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [editDescValue, setEditDescValue] = useState('');

    useEffect(() => {
        if (task) {
            setEditTitleValue(task.title);
            setEditDescValue(task.description || '');
        }
    }, [task?.id, task?.title, task?.description]);

    // Opening the task drawer means the user has "seen" the task itself,
    // so task-level notifications (assignment, status reminders) are cleared.
    // Comment/mention/subtask notifications are cleared by their respective tabs.
    useEffect(() => {
        if (!taskId) return;
        notificationsApi
            .markReadForTask(taskId, ['task_assigned'])
            .then(res => {
                if (res?.updated > 0) window.dispatchEvent(new CustomEvent('etm:notifications-updated'));
            })
            .catch(() => {});
    }, [taskId]);

    // Status change
    async function handleStatusChange(newStatus: TaskStatus) {
        setStatusMenuOpen(false);
        if (newStatus === 'blocat') {
            setBlockedReason('');
            setShowBlockedModal(true);
            return;
        }

        td.changeStatus.mutate({ status: newStatus }, {
            onSuccess: () => { showToast(t('task_drawer.toast_status_changed', { status: statusLabel(newStatus, t) })); onUpdate(); },
            onError: (err: any) => showToast(err.response?.data?.error || t('common.error'), 'error'),
        });
    }

    async function confirmBlockedStatus() {
        if (!blockedReason.trim()) return;
        td.changeStatus.mutate({ status: 'blocat', reason: blockedReason.trim() }, {
            onSuccess: () => { showToast(t('task_drawer.toast_marked_blocked')); setShowBlockedModal(false); onUpdate(); },
            onError: (err: any) => showToast(err.response?.data?.error || t('common.error'), 'error'),
        });
    }

    // Due date change
    function openDueDateModal() {
        if (task) {
            setNewDueDate(task.due_date);
            setDueDateReason('');
            setRealignRecurring(false);
            setShowDueDateModal(true);
        }
    }

    async function confirmDueDateChange() {
        if (!dueDateReason.trim() || !newDueDate) return;
        td.changeDueDate.mutate(
            { date: newDueDate, reason: dueDateReason.trim(), realignRecurring },
            {
                onSuccess: () => {
                    showToast(realignRecurring ? t('task_drawer.toast_due_date_changed_realigned') : t('task_drawer.toast_due_date_changed'));
                    setShowDueDateModal(false);
                    onUpdate();
                },
                onError: (err: any) => showToast(err.response?.data?.error || t('common.error'), 'error'),
            }
        );
    }

    // Title update
    async function handleTitleSave() {
        if (!task || !editTitleValue.trim() || editTitleValue.trim() === task.title) {
            setIsEditingTitle(false);
            setEditTitleValue(task?.title || '');
            return;
        }
        td.updateTask.mutate({ title: editTitleValue.trim() }, {
            onSuccess: () => { setIsEditingTitle(false); showToast(t('task_drawer.toast_title_updated')); onUpdate(); },
            onError: () => showToast(t('task_drawer.toast_title_update_error'), 'error'),
        });
    }

    // Description update
    async function handleDescSave() {
        if (!task) return;
        const newDesc = editDescValue.trim();
        if (newDesc === (task.description || '')) {
            setIsEditingDesc(false);
            return;
        }
        td.updateTask.mutate({ description: newDesc }, {
            onSuccess: () => { setIsEditingDesc(false); showToast(t('task_drawer.toast_description_updated')); onUpdate(); },
            onError: () => showToast(t('task_drawer.toast_description_update_error'), 'error'),
        });
    }

    // Department change
    async function handleDeptChange(dept: Department) {
        td.updateTask.mutate({ department_label: dept }, {
            onSuccess: () => { showToast(t('task_drawer.toast_department_changed')); onUpdate(); },
            onError: () => showToast(t('task_drawer.toast_department_change_error'), 'error'),
        });
    }

    // Delete task
    async function handleDeleteTask() {
        setShowDeleteConfirm(false);
        td.deleteTask.mutate(undefined, {
            onSuccess: () => {
                showToast(t('task_drawer.toast_task_deleted'));
                onClose();
                setTimeout(() => onUpdate(), 300);
            },
            onError: (err: any) => showToast(err.response?.data?.error || t('common.error'), 'error'),
        });
    }

    // Recurring popover state — TaskDrawer used to flip recurring on/off with
    // a hardcoded weekly frequency. Now the same button opens a small popover
    // where the user picks the actual frequency (daily/weekly/biweekly/monthly/
    // quarterly/yearly) or disables recurrence.
    const [showFreqPicker, setShowFreqPicker] = useState(false);
    const [workdaysOnly, setWorkdaysOnly] = useState(false);

    async function pickFrequency(freq: RecurringFrequency) {
        if (!task) return;
        // Recurrence requires a due date — backend rejects otherwise.
        if (!task.due_date) {
            showToast(t('task_drawer.recurring_needs_due_date'), 'error');
            setShowFreqPicker(false);
            return;
        }
        setShowFreqPicker(false);
        td.setRecurringFreq.mutate(
            { frequency: freq, workdays_only: freq === 'daily' ? workdaysOnly : false },
            {
                onSuccess: () => showToast(t('task_drawer.toast_recurring_on')),
                onError: (err: any) => showToast(err?.response?.data?.error || t('tasks.try_again'), 'error'),
            }
        );
    }

    async function disableRecurring() {
        if (!task) return;
        setShowFreqPicker(false);
        if (!task.is_recurring) return;
        td.toggleRecurring.mutate(undefined, {
            onSuccess: () => showToast(t('task_drawer.toast_recurring_off')),
            onError: () => showToast(t('tasks.try_again'), 'error'),
        });
    }

    // Error state — shown when the fetch failed (404 tenant mismatch, network
    // error, etc.). Without this branch the drawer would stay stuck on the
    // skeleton+blur indefinitely because `loading` flips to false but `task`
    // is still undefined, so the next `loading || !task` check still hits the
    // loading return below.
    if (!loading && !task && loadError) {
        return (
            <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('task_drawer.load_error_title')}>
                <div className="w-full md:max-w-2xl h-[95vh] md:h-full bg-navy-900 border-t md:border-t-0 md:border-l border-navy-700/50 shadow-2xl animate-slide-in rounded-t-2xl md:rounded-none overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
                        <h2 className="text-lg font-bold text-white">{t('task_drawer.load_error_title')}</h2>
                        <button
                            onClick={onClose}
                            className="text-navy-400 hover:text-white transition-colors"
                            aria-label={t('common.close')}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
                        <AlertTriangle className="w-12 h-12 text-amber-400" />
                        <p className="text-sm text-navy-300 max-w-sm">{t('task_drawer.load_error_body')}</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => td.refetch()}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white text-sm rounded-lg transition-colors"
                            >
                                {t('task_drawer.load_error_retry')}
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-navy-700 hover:bg-navy-600 text-white text-sm rounded-lg transition-colors"
                            >
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading || !task) {
        return (
            <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('common.loading')}>
                <div className="w-full md:max-w-2xl h-[95vh] md:h-full bg-navy-900 border-t md:border-t-0 md:border-l border-navy-700/50 shadow-2xl animate-slide-in rounded-t-2xl md:rounded-none overflow-hidden" onClick={e => e.stopPropagation()}>
                    <SkeletonDrawer />
                </div>
            </div>
        );
    }

    const dueStat = task.status !== 'terminat' ? getDueDateStatus(task.due_date) : 'normal';
    const completedSubtasks = task.subtasks.filter(s => s.is_completed).length;
    const totalSubtasks = task.subtasks.length;

    const activeAlerts = task.alerts?.filter((a: TaskAlert) => !a.is_resolved) ?? [];

    const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number; alertActive?: boolean }[] = [
        { key: 'subtasks', label: t('task_drawer.tab_subtasks'), icon: <CheckCircle2 className="w-3.5 h-3.5" />, count: totalSubtasks },
        {
            key: 'checklist' as Tab,
            label: t('task_drawer.tab_checklist'),
            icon: <ListChecks className="w-3.5 h-3.5" />,
            count: task.checklist?.length ?? 0,
        },
        { key: 'comments', label: t('task_drawer.tab_comments'), icon: <MessageSquare className="w-3.5 h-3.5" />, count: task.comments.length },
        { key: 'files', label: t('task_drawer.tab_files'), icon: <Paperclip className="w-3.5 h-3.5" />, count: task.attachments.length },
        { key: 'activity', label: t('task_drawer.tab_activity'), icon: <Activity className="w-3.5 h-3.5" />, count: task.activity.length },
        {
            key: 'alerts',
            label: t('task_drawer.tab_alerts'),
            icon: <AlertTriangle className="w-3.5 h-3.5" />,
            count: activeAlerts.length,
            alertActive: activeAlerts.length > 0,
        },
        {
            key: 'dependencies' as Tab,
            label: t('task_drawer.tab_dependencies'),
            icon: <Link2 className="w-3.5 h-3.5" />,
            count: (task.dependencies?.blocks?.length ?? 0) + (task.dependencies?.blocked_by?.length ?? 0),
        },
    ];

    return (
        <>
            {/* Close on backdrop press only — use onMouseDown + target guard so that
                drag-selecting text inside the panel (e.g. a comment) and releasing the
                mouse over the backdrop does NOT close the drawer. onClick would fire on
                the backdrop in that case (the click target resolves to the common
                ancestor), which closed the drawer and revealed the page behind it. */}
            <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-sm animate-fade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label={task?.title || 'Task details'}>
                {/* Mobile: full-screen bottom sheet. Desktop: right side panel */}
                <div className="w-full md:max-w-2xl h-[95vh] md:h-full bg-navy-900 border-t md:border-t-0 md:border-l border-navy-700/50 shadow-2xl animate-slide-in flex flex-col overflow-hidden rounded-t-2xl md:rounded-none" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex-shrink-0 p-5 border-b border-navy-700/50">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0 mr-4">
                                {isEditingTitle ? (
                                    <input
                                        type="text"
                                        value={editTitleValue}
                                        onChange={e => setEditTitleValue(e.target.value)}
                                        onBlur={handleTitleSave}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleTitleSave();
                                            if (e.key === 'Escape') {
                                                setIsEditingTitle(false);
                                                setEditTitleValue(task.title);
                                            }
                                        }}
                                        autoFocus
                                        className="w-full bg-navy-800 border border-blue-500/50 rounded px-2 py-1 text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                ) : (
                                    <h2 
                                        onClick={() => {
                                            setEditTitleValue(task.title);
                                            setIsEditingTitle(true);
                                        }}
                                        className="text-lg font-bold leading-snug cursor-text hover:bg-navy-800/50 rounded px-1 -ml-1 transition-colors border border-transparent hover:border-navy-600/50"
                                        title={t('task_drawer.click_to_edit_title')}
                                    >
                                        {task.title}
                                    </h2>
                                )}
                                {isEditingDesc ? (
                                    <textarea
                                        value={editDescValue}
                                        onChange={e => setEditDescValue(e.target.value)}
                                        onBlur={handleDescSave}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && e.ctrlKey) handleDescSave();
                                            if (e.key === 'Escape') {
                                                setIsEditingDesc(false);
                                                setEditDescValue(task.description || '');
                                            }
                                        }}
                                        rows={3}
                                        autoFocus
                                        placeholder={t('task_drawer.add_description_placeholder')}
                                        className="w-full mt-1 bg-navy-800 border border-blue-500/50 rounded px-2 py-1.5 text-sm text-navy-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-navy-500"
                                    />
                                ) : (
                                    <p
                                        onClick={() => {
                                            setEditDescValue(task.description || '');
                                            setIsEditingDesc(true);
                                        }}
                                        className="text-sm text-navy-400 mt-1 cursor-text hover:bg-navy-800/50 rounded px-1 -ml-1 py-0.5 transition-colors border border-transparent hover:border-navy-600/50 flex items-center gap-1 group"
                                        title={t('task_drawer.click_to_edit_description')}
                                    >
                                        {task.description || <span className="text-navy-600 italic">{t('task_drawer.add_description_placeholder')}</span>}
                                        <Pencil className="w-3 h-3 text-navy-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                    </p>
                                )}
                            </div>
                            <button onClick={onClose} className="text-navy-400 hover:text-white transition-colors flex-shrink-0">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Status & metadata bar */}
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                            {/* Status dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setStatusMenuOpen(!statusMenuOpen)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border"
                                    style={{ background: STATUSES[task.status].bg, color: STATUSES[task.status].color, borderColor: STATUSES[task.status].border }}
                                >
                                    {task.status === 'blocat' && <Ban className="w-3 h-3" />}
                                    {task.status === 'terminat' && <CheckCircle2 className="w-3 h-3" />}
                                    {statusLabel(task.status, t)}
                                    <ChevronDown className="w-3 h-3" />
                                </button>
                                {statusMenuOpen && (
                                    <div className="absolute left-0 mt-1 w-44 bg-navy-800 border border-navy-700 rounded-lg shadow-xl z-10 py-1 animate-fade-in">
                                        {(Object.keys(STATUSES) as TaskStatus[]).map(s => (
                                            <button
                                                key={s}
                                                onClick={() => handleStatusChange(s)}
                                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-navy-700/50 transition-colors ${s === task.status ? 'opacity-50' : ''}`}
                                                disabled={s === task.status}
                                            >
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUSES[s].color }} />
                                                {statusLabel(s, t)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Due date */}
                            <button
                                onClick={openDueDateModal}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dueStat === 'overdue' ? 'bg-red-500/20 text-red-400' :
                                    dueStat === 'today' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-navy-800/50 text-navy-300 hover:bg-navy-700/50'
                                    }`}
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDate(task.due_date)}
                                {dueStat === 'overdue' && <span className="text-[10px]">{t('task_drawer.overdue_days', { days: getDaysOverdue(task.due_date) })}</span>}
                            </button>


                            {/* Recurring — opens a frequency picker popover */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowFreqPicker(v => !v)}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${task.is_recurring ? 'bg-cyan-500/20 text-cyan-400' : 'bg-navy-800/50 text-navy-500 hover:text-navy-300'
                                        }`}
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    {task.is_recurring && task.recurring_frequency
                                        ? t(`task_form.frequency_${task.recurring_frequency}`)
                                        : t('task_drawer.recurring')}
                                    <ChevronDown className="w-3 h-3 opacity-60" />
                                </button>
                                {showFreqPicker && (
                                    <>
                                        {/* Click-outside backdrop */}
                                        <div className="fixed inset-0 z-40" onClick={() => setShowFreqPicker(false)} />
                                        <div className="absolute z-50 mt-1 left-0 bg-navy-800 border border-navy-700 rounded-lg shadow-xl py-1 min-w-[180px]">
                                            {FREQUENCIES.map(f => {
                                                const isActive = task.is_recurring && task.recurring_frequency === f;
                                                return (
                                                    <button
                                                        key={f}
                                                        onClick={() => pickFrequency(f)}
                                                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                                                            isActive
                                                                ? 'bg-cyan-500/20 text-cyan-400'
                                                                : 'text-navy-200 hover:bg-navy-700/50'
                                                        }`}
                                                    >
                                                        {t(`task_form.frequency_${f}`)}
                                                    </button>
                                                );
                                            })}
                                            <label className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-navy-300 border-t border-navy-700/50 mt-1 cursor-pointer hover:bg-navy-700/30">
                                                <input
                                                    type="checkbox"
                                                    checked={workdaysOnly}
                                                    onChange={e => setWorkdaysOnly(e.target.checked)}
                                                    className="w-3.5 h-3.5 rounded border-navy-600 bg-navy-800 text-blue-500 focus:ring-blue-500"
                                                />
                                                {t('task_form.workdays_only')}
                                            </label>
                                            {task.is_recurring && (
                                                <button
                                                    onClick={disableRecurring}
                                                    className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 border-t border-navy-700/50"
                                                >
                                                    {t('task_drawer.disable_recurring')}
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Blocked reason badge */}
                            {task.status === 'blocat' && task.blocked_reason && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 max-w-xs">
                                    <Ban className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{task.blocked_reason}</span>
                                </div>
                            )}
                        </div>

                        {/* Org structure: Department / Subdepartament / Post — only for 'full' template (Visoro Global).
                            Hungary / Neo Plan use the inline assignee picker below instead. */}
                        {isFullTemplate && (
                            <OrgAssignmentEditor task={task} onUpdate={onUpdate} />
                        )}

                        {/* Subtask progress */}
                        {totalSubtasks > 0 && (
                            <div className="mt-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-navy-400">{t('task_drawer.subtasks_completed', { completed: completedSubtasks, total: totalSubtasks })}</span>
                                    <span className="text-xs text-navy-400">{Math.round((completedSubtasks / totalSubtasks) * 100)}%</span>
                                </div>
                                <div className="w-full h-2 bg-navy-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full transition-all duration-500"
                                        style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Creator */}
                        <div className="flex items-center gap-2 mt-3 text-xs text-navy-500">
                            <UserAvatar
                                name={task.creator_name}
                                avatarUrl={task.creator_avatar}
                                size="xs"
                            />
                            {t('task_drawer.created_by', { name: task.creator_name || '' })} · {timeAgo(task.created_at)}
                        </div>

                        {/* Assignee */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-xs text-navy-500">{t('task_drawer.assignee_label')}:</span>
                            <select
                                value={task.assigned_to || ''}
                                onChange={(e) => {
                                    const val = e.target.value || null;
                                    td.updateTask.mutate({ assigned_to: val }, {
                                        onSuccess: () => { showToast(val ? t('task_drawer.toast_assignee_set') : t('task_drawer.toast_assignee_cleared')); onUpdate(); },
                                        onError: () => showToast(t('tasks.try_again'), 'error'),
                                    });
                                }}
                                aria-label={t('task_drawer.change_assignee_aria')}
                                className="flex-1 max-w-[200px] px-2.5 py-1.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500/50"
                            >
                                <option value="">— {t('tasks.unassigned')} —</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
                                ))}
                            </select>
                            {task.assigned_to && task.assignee_name && (
                                <div className="flex items-center gap-1.5">
                                    <UserAvatar
                                        name={task.assignee_name}
                                        avatarUrl={task.assignee_avatar}
                                        size="xs"
                                    />
                                    <span className="text-xs text-navy-300">{task.assignee_name}</span>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Tabs — labels hidden on mobile (<sm), icons + counts only */}
                    <div className="flex-shrink-0 flex border-b border-navy-700/50 overflow-x-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                title={tab.label}
                                aria-label={tab.label}
                                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${activeTab === tab.key
                                        ? tab.alertActive
                                            ? 'border-red-400 text-red-400'
                                            : 'border-blue-400 text-blue-400'
                                        : tab.alertActive
                                            ? 'border-transparent text-red-400/80 hover:text-red-300 animate-pulse'
                                            : 'border-transparent text-navy-400 hover:text-navy-200'
                                    }`}
                            >
                                {tab.icon}
                                <span className="hidden sm:inline">{tab.label}</span>
                                {tab.alertActive ? (
                                    <span className="px-1.5 py-0.5 bg-red-500 text-white rounded-full text-[10px] font-bold">
                                        {tab.count}
                                    </span>
                                ) : (tab.count ?? 0) > 0 && (
                                    <span className="px-1.5 py-0.5 bg-navy-800 rounded-full text-[10px]">{tab.count}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div className="flex-1 overflow-y-auto p-5">
                        {activeTab === 'subtasks' && (
                            <ErrorBoundary><SubtasksTab task={task} taskId={taskId} onReload={td.refetch} onUpdate={onUpdate} /></ErrorBoundary>
                        )}
                        {activeTab === 'comments' && (
                            <ErrorBoundary><CommentsTab task={task} taskId={taskId} onReload={td.refetch} /></ErrorBoundary>
                        )}
                        {activeTab === 'files' && (
                            <ErrorBoundary><FilesTab task={task} taskId={taskId} onReload={td.refetch} onUpdate={onUpdate} /></ErrorBoundary>
                        )}
                        {activeTab === 'activity' && (
                            <ErrorBoundary><ActivityTab task={task} /></ErrorBoundary>
                        )}
                        {activeTab === 'alerts' && (
                            <ErrorBoundary><AlertsTab task={task} taskId={taskId} onReload={td.refetch} onUpdate={onUpdate} /></ErrorBoundary>
                        )}
                        {activeTab === 'dependencies' && (
                            <ErrorBoundary><DependenciesTab taskId={taskId} onReload={td.refetch} task={task} onOpenTask={(id) => { onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent('etm:open-task', { detail: id })), 100); }} /></ErrorBoundary>
                        )}
                        {activeTab === 'checklist' && (
                            <ErrorBoundary><ChecklistTab taskId={taskId} checklist={task.checklist ?? []} onUpdate={td.refetch} /></ErrorBoundary>
                        )}
                    </div>

                    {/* Footer actions */}
                    <div className="flex-shrink-0 p-4 border-t border-navy-700/50 flex justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setShowDeleteConfirm(true)} className="text-xs text-red-500/70 hover:text-red-400 flex items-center gap-1 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
                            </button>
                            <button
                                disabled={duplicating}
                                onClick={async () => {
                                    setDuplicating(true);
                                    try {
                                        await tasksApi.duplicate(taskId);
                                        showToast(t('task_drawer.toast_duplicated'));
                                        onUpdate();
                                    } catch { showToast(t('task_drawer.toast_duplicate_error'), 'error'); }
                                    finally { setDuplicating(false); }
                                }}
                                className="text-xs text-navy-400 hover:text-blue-400 flex items-center gap-1 transition-colors disabled:opacity-40"
                            >
                                {duplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} {t('task_drawer.duplicate')}
                            </button>
                        </div>
                        <button onClick={onClose} className="px-4 py-2 bg-navy-800/50 text-navy-300 rounded-lg text-sm hover:bg-navy-700/50 transition-colors">
                            {t('common.close')}
                        </button>
                    </div>
                </div>
            </div>

            {/* DELETE CONFIRM MODAL */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">{t('task_drawer.delete_task_title')}</h3>
                                <p className="text-xs text-navy-400">{t('tasks.delete_confirm_irreversible')}</p>
                            </div>
                        </div>
                        <p className="text-sm text-navy-300 mb-6">
                            {t('task_drawer.delete_confirm_question')} <strong className="text-white">"{task.title}"</strong>?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium bg-navy-700 hover:bg-navy-600 text-navy-300 transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleDeleteTask}
                                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
                            >
                                {t('tasks.delete_permanent')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* BLOCKED REASON MODAL */}
            {showBlockedModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowBlockedModal(false)}>
                    <div className="w-full max-w-md bg-navy-900 border border-navy-700/50 rounded-2xl shadow-2xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-4">
                            <Ban className="w-5 h-5 text-red-400" />
                            <h3 className="text-lg font-bold">{t('tasks.block_reason')}</h3>
                        </div>
                        <p className="text-sm text-navy-400 mb-4">
                            {t('task_drawer.block_reason_explain_pre')} <strong className="text-red-400">{t('task_drawer.block_reason_required_word')}</strong>.
                        </p>
                        <textarea
                            value={blockedReason}
                            onChange={e => setBlockedReason(e.target.value)}
                            rows={3}
                            autoFocus
                            placeholder={t('task_drawer.block_reason_placeholder')}
                            className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-red-500/50 resize-none"
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setShowBlockedModal(false)} className="px-4 py-2 text-sm text-navy-300 hover:bg-navy-800 rounded-lg transition-colors">
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={confirmBlockedStatus}
                                disabled={!blockedReason.trim()}
                                className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg text-sm disabled:opacity-30 transition-all"
                            >
                                {t('task_drawer.confirm_block')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DUE DATE CHANGE MODAL */}
            {showDueDateModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowDueDateModal(false)}>
                    <div className="w-full max-w-md bg-navy-900 border border-navy-700/50 rounded-2xl shadow-2xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-4">
                            <Calendar className="w-5 h-5 text-orange-400" />
                            <h3 className="text-lg font-bold">{t('task_drawer.change_due_date_title')}</h3>
                        </div>

                        <div className="flex items-center gap-3 mb-4 p-3 bg-navy-800/50 rounded-lg">
                            <div className="text-center flex-1">
                                <p className="text-[10px] text-navy-500 mb-1">{t('task_drawer.old_date_label')}</p>
                                <p className="text-sm font-medium text-red-400">{formatDateFull(task.due_date)}</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-navy-500" />
                            <div className="text-center flex-1">
                                <p className="text-[10px] text-navy-500 mb-1">{t('task_drawer.new_date_label')}</p>
                                <input
                                    type="date"
                                    value={newDueDate}
                                    onChange={e => setNewDueDate(e.target.value)}
                                    className="w-full px-2 py-1 bg-navy-700/50 border border-navy-600 rounded text-sm text-white text-center focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                        </div>

                        {task.is_recurring && (
                            <div className="mb-4">
                                <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                                    {t('task_drawer.recurring_move_question')}
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setRealignRecurring(false)}
                                        className={`px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                                            !realignRecurring
                                                ? 'bg-cyan-500/15 border-cyan-500/60 text-cyan-200'
                                                : 'bg-navy-800/40 border-navy-700/50 text-navy-300 hover:bg-navy-800/70'
                                        }`}
                                    >
                                        <div className="font-semibold mb-0.5">{t('task_drawer.recurring_only_this_title')}</div>
                                        <div className="text-[10px] text-navy-400 leading-snug">{t('task_drawer.recurring_only_this_hint')}</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRealignRecurring(true)}
                                        className={`px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                                            realignRecurring
                                                ? 'bg-cyan-500/15 border-cyan-500/60 text-cyan-200'
                                                : 'bg-navy-800/40 border-navy-700/50 text-navy-300 hover:bg-navy-800/70'
                                        }`}
                                    >
                                        <div className="font-semibold mb-0.5">{t('task_drawer.recurring_this_and_future_title')}</div>
                                        <div className="text-[10px] text-navy-400 leading-snug">{t('task_drawer.recurring_this_and_future_hint')}</div>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                                {t('task_drawer.reschedule_reason_label')} <span className="text-red-400">*</span>
                            </label>
                            <textarea
                                value={dueDateReason}
                                onChange={e => setDueDateReason(e.target.value)}
                                rows={3}
                                autoFocus
                                placeholder={t('task_drawer.reschedule_reason_placeholder')}
                                className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-orange-500/50 resize-none"
                            />
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setShowDueDateModal(false)} className="px-4 py-2 text-sm text-navy-300 hover:bg-navy-800 rounded-lg transition-colors">
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={confirmDueDateChange}
                                disabled={!dueDateReason.trim() || !newDueDate || newDueDate === task.due_date || td.changeDueDate.isPending}
                                className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm disabled:opacity-30 transition-all flex items-center gap-1.5"
                            >
                                {td.changeDueDate.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                {t('task_drawer.confirm_change')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ─── Org Assignment Editor (Department / Subdepartament / Post) ──────────────

function OrgAssignmentEditor({ task, onUpdate }: { task: TaskDetail; onUpdate: () => void }) {
    const { t } = useTranslation();
    const [editing, setEditing] = useState(false);
    const [orgDepts, setOrgDepts] = useState<any[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState('');
    const [selectedSectionId, setSelectedSectionId] = useState('');
    const [selectedPostId, setSelectedPostId] = useState('');
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (!editing) return;
        import('../../services/api').then(({ departmentsApi }) => {
            departmentsApi.list().then(data => {
                const depts = data.departments || [];
                setOrgDepts(depts);
                // Pre-select current values
                if (task.assigned_post_id) {
                    for (const dept of depts) {
                        for (const sec of (dept.sections || [])) {
                            for (const post of (sec.posts || [])) {
                                if (post.id === task.assigned_post_id) {
                                    setSelectedDeptId(dept.id);
                                    setSelectedSectionId(sec.id);
                                    setSelectedPostId(post.id);
                                    return;
                                }
                            }
                        }
                    }
                }
            });
        });
    }, [editing]);

    const selectedDept = orgDepts.find(d => d.id === selectedDeptId);
    const availableSections = selectedDept?.sections || [];
    const selectedSection = availableSections.find((s: any) => s.id === selectedSectionId);
    const availablePosts = selectedSection?.posts || [];

    // Map dept to old enum
    const deptNameToEnum: Record<string, Department> = {
        '7 - Administrativ': 'departament_7',
        '1 - HR - Comunicare': 'departament_1',
        '2 - Vânzări': 'departament_2',
        '3 - Financiar': 'departament_3',
        '4 - Producție': 'departament_4',
        '5 - Calitate și calificare': 'departament_5',
        '6 - Extindere': 'departament_6',
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updates: any = {};
            if (selectedDeptId && selectedDept) {
                const enumVal = deptNameToEnum[selectedDept.name];
                if (enumVal) updates.department_label = enumVal;
            }
            if (selectedPostId) {
                updates.assigned_post_id = selectedPostId;
                // Resolve user from post
                const post = availablePosts.find((p: any) => p.id === selectedPostId);
                if (post?.user_id) updates.assigned_to = post.user_id;
            } else {
                updates.assigned_post_id = null;
            }
            await tasksApi.update(task.id, updates);
            showToast(t('task_drawer.toast_org_updated'));
            setEditing(false);
            onUpdate();
        } catch {
            showToast(t('common.error_saving'), 'error');
        } finally {
            setSaving(false);
        }
    };

    // Look up the post's "official" user (to detect delegation: assigned_to ≠ post.user_id)
    let postUser: { id: string | null; name: string | null } = { id: null, name: null };
    if (task.assigned_post_id) {
        for (const d of orgDepts) {
            for (const s of (d.sections || [])) {
                for (const p of (s.posts || [])) {
                    if (p.id === task.assigned_post_id) {
                        postUser = { id: p.user_id, name: p.user_name };
                    }
                }
            }
        }
    }
    const isDelegated = postUser.id && task.assigned_to && postUser.id !== task.assigned_to;

    if (!editing) {
        return (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
                {task.assigned_department_name && (
                    <span className="text-[10px] px-2 py-1 rounded bg-navy-800/50 text-navy-400">
                        {task.assigned_department_name}
                    </span>
                )}
                {task.assigned_section_name && (
                    <span className="text-[10px] px-2 py-1 rounded bg-navy-800/50 text-navy-400">
                        {task.assigned_section_name}
                    </span>
                )}
                {task.assigned_post_name && (
                    <span className="text-[10px] px-2 py-1 rounded bg-navy-800/50 text-navy-400">
                        {task.assigned_post_name}
                    </span>
                )}
                {isDelegated && (
                    <span
                        className="text-[10px] px-2 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        title={t('task_drawer.delegated_tooltip', { name: postUser.name || t('task_drawer.delegated_other_colleague') })}
                    >
                        ⚠ {t('task_drawer.delegated_badge')}
                    </span>
                )}
                <button
                    onClick={() => setEditing(true)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                >
                    {t('task_drawer.change_org')}
                </button>
            </div>
        );
    }

    const selectCls = "w-full px-3 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500/50";

    return (
        <div className="mt-3 p-3 bg-navy-800/30 rounded-lg border border-navy-700/30 space-y-2">
            <select value={selectedDeptId} onChange={e => { setSelectedDeptId(e.target.value); setSelectedSectionId(''); setSelectedPostId(''); }} className={selectCls}>
                <option value="">— {t('tasks.department')} —</option>
                {orgDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {selectedDeptId && availableSections.length > 0 && (
                <select value={selectedSectionId} onChange={e => { setSelectedSectionId(e.target.value); setSelectedPostId(''); }} className={selectCls}>
                    <option value="">— {t('task_form.section')} —</option>
                    {availableSections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            )}
            {selectedSectionId && availablePosts.length > 0 && (
                <select value={selectedPostId} onChange={e => setSelectedPostId(e.target.value)} className={selectCls}>
                    <option value="">— {t('task_drawer.post_label')} —</option>
                    {availablePosts.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.user_name ? ` → ${p.user_name}` : ''}</option>)}
                </select>
            )}
            <div className="flex gap-2 justify-end">
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-navy-400 hover:text-white">{t('common.cancel')}</button>
                <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-400 text-white rounded-lg disabled:opacity-50">
                    {saving ? t('task_form.saving') : t('common.save')}
                </button>
            </div>
        </div>
    );
}
