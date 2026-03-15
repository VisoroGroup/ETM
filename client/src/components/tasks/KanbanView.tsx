import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Task, TaskStatus, STATUSES, DEPARTMENTS } from '../../types';
import { getDueDateStatus, formatDate, getDaysOverdue } from '../../utils/helpers';
import { Calendar, Ban, CheckCircle2, AlertTriangle, UserCircle } from 'lucide-react';
import { tasksApi } from '../../services/api';
import { useToast } from '../../hooks/useToast';

interface Props {
    tasks: Task[];
    onTaskClick: (taskId: string) => void;
    onUpdate: () => void;
}

const COLUMNS: { key: TaskStatus; label: string; color: string; bg: string; border: string }[] = [
    { key: 'de_rezolvat', label: 'De rezolvat', color: '#64748B', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.25)' },
    { key: 'in_realizare', label: 'În realizare', color: '#2563EB', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.25)' },
    { key: 'blocat',       label: 'Blocat',       color: '#DC2626', bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.25)' },
    { key: 'terminat',     label: 'Terminat',     color: '#16A34A', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.25)' },
];

export default function KanbanView({ tasks, onTaskClick, onUpdate }: Props) {
    const { showToast } = useToast();
    const [draggingId, setDraggingId] = useState<string | null>(null);

    const grouped: Record<TaskStatus, Task[]> = {
        de_rezolvat: [],
        in_realizare: [],
        blocat: [],
        terminat: [],
    };
    for (const t of tasks) {
        if (grouped[t.status]) grouped[t.status].push(t);
    }

    async function onDragEnd(result: DropResult) {
        setDraggingId(null);
        if (!result.destination) return;
        const newStatus = result.destination.droppableId as TaskStatus;
        const taskId = result.draggableId;
        const task = tasks.find(t => t.id === taskId);
        if (!task || task.status === newStatus) return;

        // If dropping into 'blocat' — we skip the reason modal for Kanban simplicity
        // and set a default reason
        try {
            if (newStatus === 'blocat') {
                await tasksApi.changeStatus(taskId, newStatus, 'Mutat în Blocat via Kanban');
            } else {
                await tasksApi.changeStatus(taskId, newStatus);
            }
            showToast(`„${task.title}" → ${STATUSES[newStatus].label}`);
            onUpdate();
        } catch (err: any) {
            showToast(err.response?.data?.error || 'Eroare la schimbarea statusului', 'error');
        }
    }

    return (
        <DragDropContext onDragStart={(e) => setDraggingId(e.draggableId)} onDragEnd={onDragEnd}>
            <div className="flex gap-4 h-full overflow-x-auto pb-4">
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
                                                ? `rgba(${col.key === 'de_rezolvat' ? '100,116,139' : col.key === 'in_realizare' ? '37,99,235' : col.key === 'blocat' ? '220,38,38' : '22,163,74'},0.15)`
                                                : undefined,
                                        }}
                                    >
                                        {colTasks.map((task, index) => (
                                            <KanbanCard
                                                key={task.id}
                                                task={task}
                                                index={index}
                                                isDragging={draggingId === task.id}
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
    );
}

function KanbanCard({ task, index, isDragging, onClick }: {
    task: Task;
    index: number;
    isDragging: boolean;
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
                >
                    {/* Department badge */}
                    <div className="flex items-center justify-between mb-2">
                        <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                            style={{ background: dept?.color || '#3b82f6' }}
                        >
                            {dept?.label || task.department_label}
                        </span>
                        {task.status === 'blocat' && <Ban className="w-3.5 h-3.5 text-red-400" />}
                        {task.status === 'terminat' && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
                    </div>

                    {/* Title */}
                    <p className="text-sm font-medium leading-snug mb-2 line-clamp-2">{task.title}</p>

                    {/* Overdue/blocked reason */}
                    {task.blocked_reason && (
                        <p className="text-[11px] text-red-400 line-clamp-1 mb-2 flex items-center gap-1">
                            <Ban className="w-3 h-3 flex-shrink-0" />{task.blocked_reason}
                        </p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-2">
                        {/* Due date */}
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
                            {/* Subtask progress */}
                            {(task.subtask_total ?? 0) > 0 && (
                                <span className="text-[10px] text-navy-500">
                                    {task.subtask_completed}/{task.subtask_total}
                                </span>
                            )}
                            {/* Assignee */}
                            {task.assignee_name ? (
                                <div
                                    className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-[9px] font-bold"
                                    title={task.assignee_name}
                                >
                                    {task.assignee_name.charAt(0)}
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
