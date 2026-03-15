import { useState, useEffect, useRef } from 'react';
import { tasksApi, subtasksApi, commentsApi, attachmentsApi, recurringApi, alertsApi } from '../../services/api';
import type { TaskDetail, TaskStatus, Department, User, Subtask, TaskAlert } from '../../types';
import { STATUSES, DEPARTMENTS, FREQUENCIES } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { getDueDateStatus, formatDate, formatDateFull, timeAgo, getDaysOverdue, formatFileSize } from '../../utils/helpers';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import {
    X, Calendar, Tag, MessageSquare, Paperclip, Activity,
    ChevronDown, Plus, Check, Ban, Trash2,
    Upload, Download, GripVertical, Send, Loader2, RefreshCw,
    CheckCircle2, ArrowRight, AlertTriangle, ShieldCheck
} from 'lucide-react';

interface Props {
    taskId: string;
    onClose: () => void;
    onUpdate: () => void;
}

type Tab = 'subtasks' | 'comments' | 'files' | 'activity' | 'alerts';

export default function TaskDrawer({ taskId, onClose, onUpdate }: Props) {
    const [task, setTask] = useState<TaskDetail | null>(null);
    const [loading, setLoading] = useState(true);
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

    // Subtask
    const [newSubtask, setNewSubtask] = useState('');

    // Comment
    const [newComment, setNewComment] = useState('');
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIds, setMentionIds] = useState<string[]>([]);
    const commentRef = useRef<HTMLTextAreaElement>(null);

    // File
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Alert
    const [newAlertText, setNewAlertText] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        loadTask();
    }, [taskId]);

    async function loadTask() {
        try {
            setLoading(true);
            const data = await tasksApi.get(taskId);
            setTask(data);
        } catch {
            showToast('Eroare la încărcarea task-ului', 'error');
        } finally {
            setLoading(false);
        }
    }

    // Status change
    async function handleStatusChange(newStatus: TaskStatus) {
        setStatusMenuOpen(false);
        if (newStatus === 'blocat') {
            setPendingStatus(newStatus);
            setBlockedReason('');
            setShowBlockedModal(true);
            return;
        }

        try {
            await tasksApi.changeStatus(taskId, newStatus);
            showToast(`Status schimbat în "${STATUSES[newStatus].label}"`);
            loadTask();
            onUpdate();
        } catch (err: any) {
            showToast(err.response?.data?.error || 'Eroare', 'error');
        }
    }

    async function confirmBlockedStatus() {
        if (!blockedReason.trim()) return;
        try {
            await tasksApi.changeStatus(taskId, 'blocat', blockedReason.trim());
            showToast('Task marcat ca Blocat');
            setShowBlockedModal(false);
            loadTask();
            onUpdate();
        } catch (err: any) {
            showToast(err.response?.data?.error || 'Eroare', 'error');
        }
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
        try {
            await tasksApi.changeDueDate(taskId, newDueDate, dueDateReason.trim());
            showToast('Data limită schimbată');
            setShowDueDateModal(false);
            loadTask();
            onUpdate();
        } catch (err: any) {
            showToast(err.response?.data?.error || 'Eroare', 'error');
        }
    }

    // Department change
    async function handleDeptChange(dept: Department) {
        try {
            await tasksApi.update(taskId, { department_label: dept });
            showToast('Departament schimbat');
            loadTask();
            onUpdate();
        } catch (err: any) {
            showToast('Eroare la schimbarea departamentului', 'error');
        }
    }

    // Subtasks
    async function addSubtask() {
        if (!newSubtask.trim()) return;
        try {
            await subtasksApi.create(taskId, { title: newSubtask.trim() });
            setNewSubtask('');
            loadTask();
            onUpdate();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    async function toggleSubtask(subtask: Subtask) {
        try {
            await subtasksApi.update(taskId, subtask.id, { is_completed: !subtask.is_completed });
            loadTask();
            onUpdate();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    async function assignSubtask(subtaskId: string, userId: string | null) {
        try {
            await subtasksApi.update(taskId, subtaskId, { assigned_to: userId } as any);
            loadTask();
            onUpdate();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    async function deleteSubtask(subtaskId: string) {
        try {
            await subtasksApi.delete(taskId, subtaskId);
            loadTask();
            onUpdate();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    async function onDragEnd(result: DropResult) {
        if (!result.destination || !task) return;
        const items = Array.from(task.subtasks);
        const [moved] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, moved);
        const order = items.map((item, idx) => ({ id: item.id, order_index: idx }));
        try {
            await subtasksApi.reorder(taskId, order);
            loadTask();
        } catch {
            showToast('Eroare la reordonare', 'error');
        }
    }

    // Comments
    function handleCommentInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
        const val = e.target.value;
        setNewComment(val);

        const lastAt = val.lastIndexOf('@');
        if (lastAt >= 0) {
            const afterAt = val.substring(lastAt + 1);
            if (!afterAt.includes(' ') && afterAt.length <= 30) {
                setMentionQuery(afterAt.toLowerCase());
                setShowMentionDropdown(true);
                return;
            }
        }
        setShowMentionDropdown(false);
    }

    function selectMention(u: User) {
        const lastAt = newComment.lastIndexOf('@');
        const before = newComment.substring(0, lastAt);
        setNewComment(`${before}@${u.display_name} `);
        setMentionIds(prev => [...prev, u.id]);
        setShowMentionDropdown(false);
        commentRef.current?.focus();
    }

    async function submitComment() {
        if (!newComment.trim()) return;
        try {
            await commentsApi.create(taskId, newComment.trim(), mentionIds);
            setNewComment('');
            setMentionIds([]);
            loadTask();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    async function deleteComment(commentId: string) {
        try {
            await commentsApi.delete(taskId, commentId);
            loadTask();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    // Files
    async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            await attachmentsApi.upload(taskId, file);
            showToast('Fișier încărcat!');
            loadTask();
            onUpdate();
        } catch {
            showToast('Eroare la încărcare', 'error');
        }
        e.target.value = '';
    }

    async function deleteAttachment(attachmentId: string) {
        try {
            await attachmentsApi.delete(taskId, attachmentId);
            showToast('Fișier șters');
            loadTask();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    // Delete task
    async function handleDeleteTask() {
        setShowDeleteConfirm(false);
        try {
            await tasksApi.delete(taskId);
            showToast('Task șters');
            onClose();
            onUpdate();
        } catch (err: any) {
            showToast(err.response?.data?.error || 'Eroare', 'error');
        }
    }

    // Recurring toggle
    async function toggleRecurring() {
        if (!task) return;
        try {
            if (task.is_recurring) {
                await recurringApi.remove(taskId);
                showToast('Recurență dezactivată');
            } else {
                await recurringApi.set(taskId, 'weekly');
                showToast('Recurență activată (săptămânal)');
            }
            loadTask();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    // Alerts
    async function addAlert() {
        if (!newAlertText.trim()) return;
        try {
            await alertsApi.create(taskId, newAlertText.trim());
            setNewAlertText('');
            showToast('Alertă adăugată!');
            loadTask();
        } catch {
            showToast('Eroare la adăugarea alertei', 'error');
        }
    }

    async function resolveAlert(alertId: string) {
        try {
            await alertsApi.resolve(taskId, alertId);
            showToast('Alertă marcată ca rezolvată');
            loadTask();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    async function deleteAlert(alertId: string) {
        try {
            await alertsApi.delete(taskId, alertId);
            showToast('Alertă ștearsă');
            loadTask();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    // Activity action descriptions
    function getActionDescription(entry: any): string {
        const d = entry.details || {};
        switch (entry.action_type) {
            case 'created': return `a creat task-ul`;
            case 'status_changed':
                return `a schimbat statusul din "${STATUSES[d.old_status as TaskStatus]?.label || d.old_status}" în "${STATUSES[d.new_status as TaskStatus]?.label || d.new_status}"${d.reason ? ` — Motiv: ${d.reason}` : ''}`;
            case 'due_date_changed':
                return `a schimbat data limită din ${formatDate(d.old_date)} în ${formatDate(d.new_date)} — Motiv: ${d.reason}`;
            case 'comment_added': return `a adăugat un comentariu`;
            case 'subtask_added': return `a adăugat subtask-ul "${d.subtask_title}"`;
            case 'subtask_completed': return `a ${d.completed ? 'completat' : 'debifat'} subtask-ul "${d.subtask_title}"`;
            case 'subtask_assigned': return `a asignat subtask-ul "${d.subtask_title}" lui ${d.assigned_to_name || 'nimeni'}`;
            case 'attachment_added': return `a atașat fișierul "${d.file_name}"`;
            case 'label_changed': return `a schimbat departamentul din "${DEPARTMENTS[d.old_label as Department]?.label}" în "${DEPARTMENTS[d.new_label as Department]?.label}"`;
            case 'recurring_created': return `a setat task-ul ca recurent (${d.frequency})`;
            case 'alert_added': return `a adăugat o alertă în "În Atenție"`;
            case 'alert_resolved': return `a rezolvat o alertă din "În Atenție"`;
            default: return entry.action_type;
        }
    }

    if (loading || !task) {
        return (
            <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
                <div className="w-full md:max-w-2xl h-full bg-navy-900 shadow-2xl animate-slide-in flex items-center justify-center" onClick={e => e.stopPropagation()}>
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </div>
            </div>
        );
    }

    const dueStat = task.status !== 'terminat' ? getDueDateStatus(task.due_date) : 'normal';
    const completedSubtasks = task.subtasks.filter(s => s.is_completed).length;
    const totalSubtasks = task.subtasks.length;

    const filteredMentionUsers = users.filter(u =>
        u.display_name.toLowerCase().includes(mentionQuery) ||
        u.email.toLowerCase().includes(mentionQuery)
    );

    const activeAlerts = task.alerts?.filter((a: TaskAlert) => !a.is_resolved) ?? [];
    const resolvedAlerts = task.alerts?.filter((a: TaskAlert) => a.is_resolved) ?? [];

    const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number; alertActive?: boolean }[] = [
        { key: 'subtasks', label: 'Subtask-uri', icon: <CheckCircle2 className="w-3.5 h-3.5" />, count: totalSubtasks },
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
                                <h2 className="text-lg font-bold leading-snug">{task.title}</h2>
                                {task.description && (
                                    <p className="text-sm text-navy-400 mt-1 line-clamp-2">{task.description}</p>
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
                                onChange={async (e) => {
                                    const val = e.target.value || null;
                                    try {
                                        await tasksApi.update(taskId, { assigned_to: val } as any);
                                        showToast(val ? 'Responsabil setat' : 'Responsabil eliminat');
                                        loadTask();
                                        onUpdate();
                                    } catch {
                                        showToast('Eroare', 'error');
                                    }
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
                        {/* SUBTASKS TAB */}
                        {activeTab === 'subtasks' && (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newSubtask}
                                        onChange={e => setNewSubtask(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addSubtask()}
                                        placeholder="Adaugă subtask..."
                                        className="flex-1 px-3 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50"
                                    />
                                    <button onClick={addSubtask} className="px-3 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>

                                <DragDropContext onDragEnd={onDragEnd}>
                                    <Droppable droppableId="subtasks">
                                        {(provided) => (
                                            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                                                {task.subtasks.map((subtask, index) => (
                                                    <Draggable key={subtask.id} draggableId={subtask.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={`flex items-center gap-2 p-2.5 rounded-lg transition-colors ${snapshot.isDragging ? 'bg-navy-700/50 shadow-lg' : 'hover:bg-navy-800/30'
                                                                    }`}
                                                            >
                                                                <div {...provided.dragHandleProps} className="text-navy-600 hover:text-navy-400 cursor-grab">
                                                                    <GripVertical className="w-4 h-4" />
                                                                </div>
                                                                <button
                                                                    onClick={() => toggleSubtask(subtask)}
                                                                    className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-all ${subtask.is_completed
                                                                        ? 'bg-blue-500 border-blue-500'
                                                                        : 'border-navy-600 hover:border-blue-400'
                                                                        }`}
                                                                >
                                                                    {subtask.is_completed && <Check className="w-3 h-3 text-white" />}
                                                                </button>
                                                                <span className={`flex-1 text-sm ${subtask.is_completed ? 'line-through text-navy-500' : ''}`}>
                                                                    {subtask.title}
                                                                </span>

                                                                {/* Assign user */}
                                                                <select
                                                                    value={subtask.assigned_to || ''}
                                                                    onChange={e => assignSubtask(subtask.id, e.target.value || null)}
                                                                    className="px-2 py-1 bg-navy-800/50 border border-navy-700/50 rounded text-[11px] text-navy-300 focus:outline-none max-w-[120px]"
                                                                >
                                                                    <option value="">Neasignat</option>
                                                                    {users.map(u => (
                                                                        <option key={u.id} value={u.id}>{u.display_name}</option>
                                                                    ))}
                                                                </select>

                                                                <button
                                                                    onClick={() => deleteSubtask(subtask.id)}
                                                                    className="text-navy-600 hover:text-red-400 transition-colors"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>

                                {task.subtasks.length === 0 && (
                                    <div className="text-center py-8">
                                        <CheckCircle2 className="w-10 h-10 text-navy-700 mx-auto mb-2" />
                                        <p className="text-navy-500 text-sm">Niciun subtask încă</p>
                                        <p className="text-navy-600 text-xs">Adaugă subtask-uri pentru a organiza task-ul.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* COMMENTS TAB */}
                        {activeTab === 'comments' && (
                            <div className="space-y-4">
                                {/* Comment input */}
                                <div className="relative">
                                    <textarea
                                        ref={commentRef}
                                        value={newComment}
                                        onChange={handleCommentInput}
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                                        rows={3}
                                        placeholder="Scrie un comentariu... folosește @ pentru a menționa"
                                        className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50 resize-none"
                                    />
                                    {showMentionDropdown && filteredMentionUsers.length > 0 && (
                                        <div className="absolute top-full left-0 w-64 mt-1 bg-navy-800 border border-navy-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto animate-fade-in">
                                            {filteredMentionUsers.slice(0, 5).map(u => (
                                                <button
                                                    key={u.id}
                                                    onClick={() => selectMention(u)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-navy-700/50 text-sm text-left transition-colors"
                                                >
                                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                                        {u.display_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium">{u.display_name}</p>
                                                        <p className="text-[10px] text-navy-500">{u.email}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <button
                                        onClick={submitComment}
                                        disabled={!newComment.trim()}
                                        className="absolute right-2 bottom-2 p-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg disabled:opacity-30 transition-all"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Comments list */}
                                {task.comments.length > 0 ? (
                                    <div className="space-y-3">
                                        {task.comments.map(comment => (
                                            <div key={comment.id} className="flex gap-2.5 group">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                                                    {comment.author_name?.charAt(0)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium">{comment.author_name}</span>
                                                        <span className="text-[10px] text-navy-500">{timeAgo(comment.created_at)}</span>
                                                        {comment.author_id === user?.id && (
                                                            <button
                                                                onClick={() => deleteComment(comment.id)}
                                                                className="opacity-0 group-hover:opacity-100 text-navy-600 hover:text-red-400 transition-all"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-navy-200 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <MessageSquare className="w-10 h-10 text-navy-700 mx-auto mb-2" />
                                        <p className="text-navy-500 text-sm">Niciun comentariu încă</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* FILES TAB */}
                        {activeTab === 'files' && (
                            <div className="space-y-3">
                                <input ref={fileInputRef} type="file" onChange={uploadFile} className="hidden" />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-navy-700 rounded-lg text-sm text-navy-400 hover:border-blue-500/50 hover:text-blue-400 transition-all"
                                >
                                    <Upload className="w-4 h-4" /> Încarcă fișier
                                </button>

                                {task.attachments.length > 0 ? (
                                    <div className="space-y-2">
                                        {task.attachments.map(att => (
                                            <div key={att.id} className="flex items-center gap-3 p-3 bg-navy-800/30 rounded-lg group">
                                                <Paperclip className="w-4 h-4 text-navy-500 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm truncate">{att.file_name}</p>
                                                    <p className="text-xs text-navy-500">{formatFileSize(att.file_size)} · {att.uploader_name} · {timeAgo(att.created_at)}</p>
                                                </div>
                                                <a
                                                    href={att.file_url}
                                                    download={att.file_name}
                                                    className="text-navy-500 hover:text-blue-400 transition-colors"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </a>
                                                {(att.uploaded_by === user?.id || user?.role === 'admin') && (
                                                    <button
                                                        onClick={() => deleteAttachment(att.id)}
                                                        className="opacity-0 group-hover:opacity-100 text-navy-500 hover:text-red-400 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Paperclip className="w-10 h-10 text-navy-700 mx-auto mb-2" />
                                        <p className="text-navy-500 text-sm">Niciun fișier atașat</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ACTIVITY TAB */}
                        {activeTab === 'activity' && (
                            <div>
                                {task.activity.length > 0 ? (
                                    <div className="space-y-3">
                                        {task.activity.map(entry => (
                                            <div key={entry.id} className="flex gap-2.5">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-navy-600 to-navy-700 flex items-center justify-center text-navy-300 text-[9px] font-bold flex-shrink-0 mt-0.5">
                                                    {entry.user_name?.charAt(0)}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs">
                                                        <span className="font-medium">{entry.user_name}</span>
                                                        <span className="text-navy-400"> {getActionDescription(entry)}</span>
                                                    </p>
                                                    <p className="text-[10px] text-navy-500 mt-0.5">{timeAgo(entry.created_at)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Activity className="w-10 h-10 text-navy-700 mx-auto mb-2" />
                                        <p className="text-navy-500 text-sm">Nicio activitate încă</p>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* ALERTS TAB */}
                        {activeTab === 'alerts' && (
                            <div className="space-y-4">
                                {/* Warning banner */}
                                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-300 leading-relaxed">
                                        Adaugă lucruri <strong>critice</strong> de care trebuie să ții cont. Dacă acestea nu sunt rezolvate, pot apărea probleme grave.
                                    </p>
                                </div>

                                {/* Add new alert */}
                                <div className="flex gap-2">
                                    <textarea
                                        value={newAlertText}
                                        onChange={e => setNewAlertText(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addAlert(); } }}
                                        rows={2}
                                        placeholder="Descrie ce trebuie urmărit cu atenție..."
                                        className="flex-1 px-3 py-2 bg-navy-800/50 border border-red-500/30 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-red-400/60 resize-none"
                                    />
                                    <button
                                        onClick={addAlert}
                                        disabled={!newAlertText.trim()}
                                        className="px-3 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg transition-colors self-end disabled:opacity-30"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Active alerts */}
                                {activeAlerts.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400/70">⚠ Active ({activeAlerts.length})</p>
                                        {activeAlerts.map((alert: TaskAlert) => (
                                            <div key={alert.id} className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl group">
                                                <div className="flex items-start gap-2">
                                                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                                    <p className="flex-1 text-sm text-red-100 leading-relaxed">{alert.content}</p>
                                                </div>
                                                <div className="flex items-center justify-between mt-2 pl-6">
                                                    <span className="text-[10px] text-navy-500">{alert.creator_name} · {timeAgo(alert.created_at)}</span>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                        <button
                                                            onClick={() => resolveAlert(alert.id)}
                                                            title="Marchează rezolvat"
                                                            className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg text-[11px] transition-colors"
                                                        >
                                                            <ShieldCheck className="w-3 h-3" /> Rezolvat
                                                        </button>
                                                        {alert.created_by === user?.id || user?.role === 'admin' ? (
                                                            <button
                                                                onClick={() => deleteAlert(alert.id)}
                                                                className="p-1 text-navy-500 hover:text-red-400 transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Resolved alerts */}
                                {resolvedAlerts.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-500">✓ Rezolvate ({resolvedAlerts.length})</p>
                                        {resolvedAlerts.map((alert: TaskAlert) => (
                                            <div key={alert.id} className="p-3 bg-navy-800/20 border border-navy-700/30 rounded-xl group opacity-60">
                                                <div className="flex items-start gap-2">
                                                    <ShieldCheck className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                    <p className="flex-1 text-sm text-navy-400 line-through leading-relaxed">{alert.content}</p>
                                                </div>
                                                <div className="flex items-center justify-between mt-1 pl-6">
                                                    <span className="text-[10px] text-navy-600">
                                                        Rezolvat de {alert.resolved_by_name} · {alert.resolved_at ? timeAgo(alert.resolved_at) : ''}
                                                    </span>
                                                    {(alert.created_by === user?.id || user?.role === 'admin') && (
                                                        <button
                                                            onClick={() => deleteAlert(alert.id)}
                                                            className="opacity-0 group-hover:opacity-100 p-1 text-navy-600 hover:text-red-400 transition-all"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeAlerts.length === 0 && resolvedAlerts.length === 0 && (
                                    <div className="text-center py-8">
                                        <AlertTriangle className="w-10 h-10 text-navy-700 mx-auto mb-2" />
                                        <p className="text-navy-500 text-sm">Nicio alertă înregistrată</p>
                                        <p className="text-navy-600 text-xs">Adaugă lucruri critice de urmărit.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer actions */}
                    <div className="flex-shrink-0 p-4 border-t border-navy-700/50 flex justify-between">
                        <button onClick={() => setShowDeleteConfirm(true)} className="text-xs text-red-500/70 hover:text-red-400 flex items-center gap-1 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" /> Șterge task
                        </button>
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
