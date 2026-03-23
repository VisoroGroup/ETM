import { useState, useEffect } from 'react';
import { SkeletonDrawer } from '../ui/Skeleton';
import { useTaskDetail } from '../../hooks/useTaskDetail';
import { tasksApi } from '../../services/api';
import type { TaskDetail, TaskStatus, Department, TaskAlert } from '../../types';
import { STATUSES, DEPARTMENTS, FREQUENCIES } from '../../types';
import { useAuth } from '../../hooks/useAuth';
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

interface Props {
    taskId: string;
    onClose: () => void;
    onUpdate: () => void;
}

type Tab = 'subtasks' | 'checklist' | 'comments' | 'files' | 'activity' | 'alerts' | 'dependencies';

export default function TaskDrawer({ taskId, onClose, onUpdate }: Props) {
    const td = useTaskDetail(taskId);
    const task = td.task;
    const loading = td.loading;
    const [activeTab, setActiveTab] = useState<Tab>('subtasks');
    const [statusMenuOpen, setStatusMenuOpen] = useState(false);
    const { user, users } = useAuth();
    const { showToast } = useToast();

    // Modals
    const [showBlockedModal, setShowBlockedModal] = useState(false);
    const [showDueDateModal, setShowDueDateModal] = useState(false);
    const [blockedReason, setBlockedReason] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    const [dueDateReason, setDueDateReason] = useState('');
    const [_pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);

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

    // Status change
    async function handleStatusChange(newStatus: TaskStatus) {
        setStatusMenuOpen(false);
        if (newStatus === 'blocat') {
            setPendingStatus(newStatus);
            setBlockedReason('');
            setShowBlockedModal(true);
            return;
        }

        td.changeStatus.mutate({ status: newStatus }, {
            onSuccess: () => { showToast(`Status schimbat în "${STATUSES[newStatus].label}"`); onUpdate(); },
            onError: (err: any) => showToast(err.response?.data?.error || 'Eroare', 'error'),
        });
    }

    async function confirmBlockedStatus() {
        if (!blockedReason.trim()) return;
        td.changeStatus.mutate({ status: 'blocat', reason: blockedReason.trim() }, {
            onSuccess: () => { showToast('Task marcat ca Blocat'); setShowBlockedModal(false); onUpdate(); },
            onError: (err: any) => showToast(err.response?.data?.error || 'Eroare', 'error'),
        });
    }

    // Due date change
    function openDueDateModal() {
        if (task) {
            setNewDueDate(task.due_date);
            setDueDateReason('');
            setShowDueDateModal(true);
        }
    }

    async function confirmDueDateChange() {
        if (!dueDateReason.trim() || !newDueDate) return;
        td.changeDueDate.mutate({ date: newDueDate, reason: dueDateReason.trim() }, {
            onSuccess: () => { showToast('Data limită schimbată'); setShowDueDateModal(false); onUpdate(); },
            onError: (err: any) => showToast(err.response?.data?.error || 'Eroare', 'error'),
        });
    }

    // Title update
    async function handleTitleSave() {
        if (!task || !editTitleValue.trim() || editTitleValue.trim() === task.title) {
            setIsEditingTitle(false);
            setEditTitleValue(task?.title || '');
            return;
        }
        td.updateTask.mutate({ title: editTitleValue.trim() }, {
            onSuccess: () => { setIsEditingTitle(false); showToast('Titlu actualizat!'); onUpdate(); },
            onError: () => showToast('Eroare la actualizarea titlului', 'error'),
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
            onSuccess: () => { setIsEditingDesc(false); showToast('Descriere actualizată!'); onUpdate(); },
            onError: () => showToast('Eroare la actualizarea descrierii', 'error'),
        });
    }

    // Department change
    async function handleDeptChange(dept: Department) {
        td.updateTask.mutate({ department_label: dept }, {
            onSuccess: () => { showToast('Departament schimbat'); onUpdate(); },
            onError: () => showToast('Eroare la schimbarea departamentului', 'error'),
        });
    }

    // Delete task
    async function handleDeleteTask() {
        setShowDeleteConfirm(false);
        td.deleteTask.mutate(undefined, {
            onSuccess: () => {
                showToast('Task șters');
                onClose();
                setTimeout(() => onUpdate(), 300);
            },
            onError: (err: any) => showToast(err.response?.data?.error || 'Eroare', 'error'),
        });
    }

    // Recurring toggle
    async function toggleRecurring() {
        if (!task) return;
        td.toggleRecurring.mutate(undefined, {
            onSuccess: () => showToast(task.is_recurring ? 'Recurență dezactivată' : 'Recurență activată (săptămânal)'),
            onError: () => showToast('Eroare', 'error'),
        });
    }

    if (loading || !task) {
        return (
            <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
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
        { key: 'subtasks', label: 'Subtask-uri', icon: <CheckCircle2 className="w-3.5 h-3.5" />, count: totalSubtasks },
        {
            key: 'checklist' as Tab,
            label: 'Checklist',
            icon: <ListChecks className="w-3.5 h-3.5" />,
            count: task.checklist?.length ?? 0,
        },
        { key: 'comments', label: 'Comentarii', icon: <MessageSquare className="w-3.5 h-3.5" />, count: task.comments.length },
        { key: 'files', label: 'Fișiere', icon: <Paperclip className="w-3.5 h-3.5" />, count: task.attachments.length },
        { key: 'activity', label: 'Activitate', icon: <Activity className="w-3.5 h-3.5" />, count: task.activity.length },
        {
            key: 'alerts',
            label: 'În Atenție',
            icon: <AlertTriangle className="w-3.5 h-3.5" />,
            count: activeAlerts.length,
            alertActive: activeAlerts.length > 0,
        },
        {
            key: 'dependencies' as Tab,
            label: 'Dependențe',
            icon: <Link2 className="w-3.5 h-3.5" />,
            count: (task.dependencies?.blocks?.length ?? 0) + (task.dependencies?.blocked_by?.length ?? 0),
        },
    ];

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
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
                                        title="Click pentru a edita titlul"
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
                                        placeholder="Adaugă o descriere..."
                                        className="w-full mt-1 bg-navy-800 border border-blue-500/50 rounded px-2 py-1.5 text-sm text-navy-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-navy-500"
                                    />
                                ) : (
                                    <p
                                        onClick={() => {
                                            setEditDescValue(task.description || '');
                                            setIsEditingDesc(true);
                                        }}
                                        className="text-sm text-navy-400 mt-1 cursor-text hover:bg-navy-800/50 rounded px-1 -ml-1 py-0.5 transition-colors border border-transparent hover:border-navy-600/50 flex items-center gap-1 group"
                                        title="Click pentru a edita descrierea"
                                    >
                                        {task.description || <span className="text-navy-600 italic">Adaugă o descriere...</span>}
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
                                    {STATUSES[task.status].label}
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
                                                {STATUSES[s].label}
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
                                {dueStat === 'overdue' && <span className="text-[10px]">(depășit {getDaysOverdue(task.due_date)}z)</span>}
                            </button>


                            {/* Recurring */}
                            <button
                                onClick={toggleRecurring}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${task.is_recurring ? 'bg-cyan-500/20 text-cyan-400' : 'bg-navy-800/50 text-navy-500 hover:text-navy-300'
                                    }`}
                            >
                                <RefreshCw className="w-3 h-3" />
                                {task.is_recurring ? FREQUENCIES[task.recurring_frequency!] || 'Recurent' : 'Recurent'}
                            </button>

                            {/* Blocked reason badge */}
                            {task.status === 'blocat' && task.blocked_reason && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 max-w-xs">
                                    <Ban className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{task.blocked_reason}</span>
                                </div>
                            )}
                        </div>

                        {/* Subtask progress */}
                        {totalSubtasks > 0 && (
                            <div className="mt-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-navy-400">{completedSubtasks}/{totalSubtasks} completate</span>
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
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-[9px] font-bold">
                                {task.creator_name?.charAt(0)}
                            </div>
                            Creat de {task.creator_name} · {timeAgo(task.created_at)}
                        </div>

                        {/* Assignee */}
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-navy-500">Responsabil:</span>
                            <select
                                value={task.assigned_to || ''}
                                onChange={(e) => {
                                    const val = e.target.value || null;
                                    td.updateTask.mutate({ assigned_to: val } as any, {
                                        onSuccess: () => { showToast(val ? 'Responsabil setat' : 'Responsabil eliminat'); onUpdate(); },
                                        onError: () => showToast('Eroare', 'error'),
                                    });
                                }}
                                className="flex-1 max-w-[200px] px-2.5 py-1.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500/50"
                            >
                                <option value="">— Neasignat —</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
                                ))}
                            </select>
                            {task.assigned_to && task.assignee_name && (
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-[9px] font-bold">
                                        {task.assignee_name.charAt(0)}
                                    </div>
                                    <span className="text-xs text-navy-300">{task.assignee_name}</span>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Tabs */}
                    <div className="flex-shrink-0 flex border-b border-navy-700/50 overflow-x-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
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
                                {tab.label}
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
                            <ErrorBoundary><AlertsTab task={task} taskId={taskId} onReload={td.refetch} /></ErrorBoundary>
                        )}
                        {activeTab === 'dependencies' && (
                            <ErrorBoundary><DependenciesTab taskId={taskId} onReload={td.refetch} /></ErrorBoundary>
                        )}
                        {activeTab === 'checklist' && (
                            <ErrorBoundary><ChecklistTab taskId={taskId} checklist={task.checklist ?? []} onUpdate={td.refetch} /></ErrorBoundary>
                        )}
                    </div>

                    {/* Footer actions */}
                    <div className="flex-shrink-0 p-4 border-t border-navy-700/50 flex justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setShowDeleteConfirm(true)} className="text-xs text-red-500/70 hover:text-red-400 flex items-center gap-1 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" /> Șterge
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await tasksApi.duplicate(taskId);
                                        showToast('Task duplicat cu succes!');
                                        onUpdate();
                                    } catch { showToast('Eroare la duplicare', 'error'); }
                                }}
                                className="text-xs text-navy-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
                            >
                                <Copy className="w-3.5 h-3.5" /> Duplică
                            </button>
                        </div>
                        <button onClick={onClose} className="px-4 py-2 bg-navy-800/50 text-navy-300 rounded-lg text-sm hover:bg-navy-700/50 transition-colors">
                            Închide
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
                                <h3 className="font-semibold text-white">Șterge task</h3>
                                <p className="text-xs text-navy-400">Acțiunea este ireversibilă</p>
                            </div>
                        </div>
                        <p className="text-sm text-navy-300 mb-6">
                            Ești sigur că vrei să ștergi <strong className="text-white">"{task.title}"</strong>?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium bg-navy-700 hover:bg-navy-600 text-navy-300 transition-colors"
                            >
                                Anulează
                            </button>
                            <button
                                onClick={handleDeleteTask}
                                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
                            >
                                Șterge definitiv
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
                            <h3 className="text-lg font-bold">Motiv blocare</h3>
                        </div>
                        <p className="text-sm text-navy-400 mb-4">
                            Explică de ce acest task este blocat. Câmpul este <strong className="text-red-400">obligatoriu</strong>.
                        </p>
                        <textarea
                            value={blockedReason}
                            onChange={e => setBlockedReason(e.target.value)}
                            rows={3}
                            autoFocus
                            placeholder="Motivul blocării..."
                            className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-red-500/50 resize-none"
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setShowBlockedModal(false)} className="px-4 py-2 text-sm text-navy-300 hover:bg-navy-800 rounded-lg transition-colors">
                                Anulează
                            </button>
                            <button
                                onClick={confirmBlockedStatus}
                                disabled={!blockedReason.trim()}
                                className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg text-sm disabled:opacity-30 transition-all"
                            >
                                Confirmă blocare
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
                            <h3 className="text-lg font-bold">Schimbă data limită</h3>
                        </div>

                        <div className="flex items-center gap-3 mb-4 p-3 bg-navy-800/50 rounded-lg">
                            <div className="text-center flex-1">
                                <p className="text-[10px] text-navy-500 mb-1">DATA VECHE</p>
                                <p className="text-sm font-medium text-red-400">{formatDateFull(task.due_date)}</p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-navy-500" />
                            <div className="text-center flex-1">
                                <p className="text-[10px] text-navy-500 mb-1">DATA NOUĂ</p>
                                <input
                                    type="date"
                                    value={newDueDate}
                                    onChange={e => setNewDueDate(e.target.value)}
                                    className="w-full px-2 py-1 bg-navy-700/50 border border-navy-600 rounded text-sm text-white text-center focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                                Motivul reprogramării <span className="text-red-400">*</span>
                            </label>
                            <textarea
                                value={dueDateReason}
                                onChange={e => setDueDateReason(e.target.value)}
                                rows={3}
                                autoFocus
                                placeholder="Explică de ce se schimbă data limită..."
                                className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-orange-500/50 resize-none"
                            />
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setShowDueDateModal(false)} className="px-4 py-2 text-sm text-navy-300 hover:bg-navy-800 rounded-lg transition-colors">
                                Anulează
                            </button>
                            <button
                                onClick={confirmDueDateChange}
                                disabled={!dueDateReason.trim() || !newDueDate || newDueDate === task.due_date}
                                className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm disabled:opacity-30 transition-all"
                            >
                                Confirmă schimbarea
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
