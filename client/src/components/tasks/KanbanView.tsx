import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Task, TaskStatus, STATUSES, DEPARTMENTS } from '../../types';
import { getDueDateStatus, formatDate, getDaysOverdue } from '../../utils/helpers';
import { Calendar, Ban, CheckCircle2, AlertTriangle, UserCircle, X, Link2 } from 'lucide-react';
import { tasksApi, commentsApi } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import UserAvatar from '../ui/UserAvatar';

interface Props {
    tasks: Task[];
    onTaskClick: (taskId: string) => void;
    onUpdate: () => void;
}

const COLUMNS: { key: TaskStatus; label: string; color: string; bg: string; border: string }[] = [
    { key: 'de_rezolvat', label: 'De rezolvat', color: '#2563EB', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.25)' },
    { key: 'in_realizare', label: 'În realizare', color: '#D97706', bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.25)' },
    { key: 'blocat',       label: 'Blocat',       color: '#DC2626', bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.25)' },
    { key: 'terminat',     label: 'Terminat',     color: '#16A34A', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.25)' },
];

export default function KanbanView({ tasks, onTaskClick, onUpdate }: Props) {
    const { showToast } = useToast();
    const [draggingId, setDraggingId] = useState<string | null>(null);

    // Local tasks copy for optimistic updates
    const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
    useEffect(() => { setLocalTasks(tasks); }, [tasks]);

    // Blocat modal state
    const [blocatModal, setBlocatModal] = useState<{ taskId: string; taskTitle: string } | null>(null);
    const [blocatReason, setBlocatReason] = useState('');
    const [saving, setSaving] = useState(false);

    // Track in-flight drag operations to prevent race conditions
    const [pendingDrags, setPendingDrags] = useState<Set<string>>(new Set());

    const grouped: Record<TaskStatus, Task[]> = {
        de_rezolvat: [],
        in_realizare: [],
        blocat: [],
        terminat: [],
    };
    for (const t of localTasks) {
        if (grouped[t.status]) grouped[t.status].push(t);
    }

    async function onDragEnd(result: DropResult) {
        setDraggingId(null);
        if (!result.destination) return;
        const newStatus = result.destination.droppableId as TaskStatus;
        const taskId = result.draggableId;
        const task = localTasks.find(t => t.id === taskId);
        if (!task || task.status === newStatus) return;

        // Block if this card already has an in-flight drag
        if (pendingDrags.has(taskId)) return;

        if (newStatus === 'blocat') {
            // Show modal for mandatory reason
            setBlocatReason('');
            setBlocatModal({ taskId, taskTitle: task.title });
            return;
        }

        // Optimistic update — move card instantly
        const previousStatus = task.status;
        setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        setPendingDrags(prev => new Set(prev).add(taskId));

        try {
            await tasksApi.changeStatus(taskId, newStatus);
            showToast(`„${task.title}" → ${STATUSES[newStatus].label}`);
            onUpdate();
        } catch (err: any) {
            // Revert on failure
            setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: previousStatus } : t));
            showToast(err.response?.data?.error || 'Eroare la schimbarea statusului', 'error');
        } finally {
            setPendingDrags(prev => { const next = new Set(prev); next.delete(taskId); return next; });
        }
    }

    async function confirmBlocat() {
        if (!blocatModal || !blocatReason.trim()) return;
        setSaving(true);
        try {
            // Change status with reason
            await tasksApi.changeStatus(blocatModal.taskId, 'blocat', blocatReason.trim());
            // Also save reason as a comment
            await commentsApi.create(
                blocatModal.taskId,
                `🔴 Blocat — Motiv: ${blocatReason.trim()}`,
                []
            );
            showToast(`„${blocatModal.taskTitle}" → Blocat`);
            setBlocatModal(null);
            setBlocatReason('');
            onUpdate();
        } catch (err: any) {
            showToast(err.response?.data?.error || 'Eroare', 'error');
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <DragDropContext onDragStart={(e) => setDraggingId(e.draggableId)} onDragEnd={onDragEnd}>
                <div className="flex gap-4 h-full overflow-x-auto pb-20 md:pb-4">
                    {COLUMNS.map(col => {
                        const colTasks = grouped[col.key];
                        return (
                            <div
                                key={col.key}
                                className="flex-shrink-0 w-72 flex flex-col rounded-xl border"
                                style={{ background: col.bg, borderColor: col.border }}
                            >
                                {/* Column header */}
                                <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: col.border }}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                                        <span className="text-sm font-semibold" style={{ color: col.color }}>
                                            {col.label}
                                        </span>
                                    </div>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: col.color }}>
                                        {colTasks.length}
                                    </span>
                                </div>

                                {/* Drop zone */}
                                <Droppable droppableId={col.key}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className="flex-1 p-2 space-y-2 min-h-[120px] transition-colors rounded-b-xl"
                                            style={{
                                                background: snapshot.isDraggingOver
                                                    ? `var(${col.key === 'de_rezolvat' ? '--kanban-drag-default' : col.key === 'in_realizare' ? '--kanban-drag-progress' : col.key === 'blocat' ? '--kanban-drag-blocked' : '--kanban-drag-done'})`
                                                    : undefined,
                                            }}
                                        >
                                            {colTasks.map((task, index) => (
                                                <KanbanCard
                                                    key={task.id}
                                                    task={task}
                                                    index={index}
                                                    isDragging={draggingId === task.id}
                                                    isPending={pendingDrags.has(task.id)}
                                                    onClick={() => onTaskClick(task.id)}
                                                />
                                            ))}
                                            {provided.placeholder}
                                            {colTasks.length === 0 && !snapshot.isDraggingOver && (
                                                <div className="flex items-center justify-center py-8 text-xs opacity-40" style={{ color: col.color }}>
                                                    Nicio sarcină
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        );
                    })}
                </div>
            </DragDropContext>

            {/* Blocat reason modal */}
            {blocatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-md bg-navy-900 border border-red-500/30 rounded-2xl shadow-2xl animate-slide-up">
                        <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
                            <div className="flex items-center gap-2">
                                <Ban className="w-5 h-5 text-red-400" />
                                <h2 className="text-base font-bold">Motiv blocare</h2>
                            </div>
                            <button onClick={() => setBlocatModal(null)} className="text-navy-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-navy-300">
                                <span className="font-medium text-white">„{blocatModal.taskTitle}"</span> — explică de ce e blocat:
                            </p>
                            <textarea
                                value={blocatReason}
                                onChange={e => setBlocatReason(e.target.value)}
                                autoFocus
                                rows={3}
                                placeholder="Ex: Lipsă informații de la client, așteptăm approval..."
                                className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-red-500/30 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-red-400/60 resize-none"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setBlocatModal(null)}
                                    className="px-4 py-2 bg-navy-800/50 text-navy-300 rounded-lg text-sm hover:bg-navy-700/50 transition-colors"
                                >
                                    Anulează
                                </button>
                                <button
                                    onClick={confirmBlocat}
                                    disabled={!blocatReason.trim() || saving}
                                    className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium disabled:opacity-40 transition-all"
                                >
                                    {saving ? 'Se salvează...' : 'Confirmă blocare'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function KanbanCard({ task, index, isDragging, isPending, onClick }: {
    task: Task;
    index: number;
    isDragging: boolean;
    isPending: boolean;
    onClick: () => void;
}) {
    const dueStat = task.status !== 'terminat' ? getDueDateStatus(task.due_date) : 'normal';
    const dept = DEPARTMENTS[task.department_label];

    return (
        <Draggable draggableId={task.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={onClick}
                    className={`bg-navy-900/90 border rounded-lg p-3 cursor-pointer transition-all select-none ${
                        snapshot.isDragging
                            ? 'shadow-2xl shadow-blue-500/20 border-blue-500/50 rotate-1 scale-105'
                            : 'border-navy-700/50 hover:border-navy-600/70 hover:bg-navy-800/90'
                    }`}
                    style={{
                        ...provided.draggableProps.style,
                        ...(isPending && !snapshot.isDragging ? { opacity: 0.5, pointerEvents: 'none' as const } : {}),
                    }}
                >
                    {/* Status icons */}
                    <div className="flex items-center justify-end mb-1.5">
                        {task.status === 'blocat' && <Ban className="w-3.5 h-3.5 text-red-400" />}
                        {task.status === 'terminat' && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                    </div>

                    {/* Title */}
                    <p className="text-sm font-medium leading-snug mb-2 line-clamp-2">{task.title}</p>

                    {/* Dependency badge */}
                    {(task.dependency_count ?? 0) > 0 && (
                        <div className="flex items-center gap-1 mb-2">
                            <Link2 className="w-3 h-3 text-orange-400" />
                            <span className="text-[10px] text-orange-400">Blocat de {task.dependency_count}</span>
                        </div>
                    )}

                    {/* Blocked reason — ONLY when status is blocat */}
                    {task.status === 'blocat' && task.blocked_reason && (
                        <p className="text-[11px] text-red-400 line-clamp-1 mb-2 flex items-center gap-1">
                            <Ban className="w-3 h-3 flex-shrink-0" />{task.blocked_reason}
                        </p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-2">
                        <span className={`flex items-center gap-1 text-[11px] font-medium ${
                            dueStat === 'overdue' ? 'text-red-400' :
                            dueStat === 'today' ? 'text-yellow-400' :
                            dueStat === 'tomorrow' ? 'text-orange-400' : 'text-navy-400'
                        }`}>
                            {dueStat === 'overdue' ? (
                                <AlertTriangle className="w-3 h-3" />
                            ) : (
                                <Calendar className="w-3 h-3" />
                            )}
                            {dueStat === 'overdue'
                                ? `${getDaysOverdue(task.due_date)}z`
                                : formatDate(task.due_date)}
                        </span>

                        <div className="flex items-center gap-1.5">
                            {(task.subtask_total ?? 0) > 0 && (
                                <span className="text-[10px] text-navy-500">
                                    {task.subtask_completed}/{task.subtask_total}
                                </span>
                            )}
                            {task.assignee_name ? (
                                <div title={task.assignee_name}>
                                    <UserAvatar
                                        name={task.assignee_name}
                                        avatarUrl={task.assignee_avatar}
                                        size="xs"
                                    />
                                </div>
                            ) : (
                                <UserCircle className="w-4 h-4 text-navy-600" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Draggable>
    );
}
