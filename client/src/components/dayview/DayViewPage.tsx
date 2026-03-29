import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { dayViewApi } from '../../services/api';
import { STATUSES, TaskStatus, DEPARTMENTS, Department } from '../../types';
import {
    CalendarClock, ChevronDown, ChevronRight, FileDown,
    GripVertical, CheckCircle2, Circle, AlertTriangle, Loader2
} from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import { safeLocalStorage } from '../../utils/storage';

interface DaySubtask {
    title: string;
    is_completed: boolean;
    due_date: string | null;
}

interface DayTask {
    id: string;
    title: string;
    status: TaskStatus;
    due_date: string;
    description: string | null;
    department_label: Department;
    subtasks: DaySubtask[];
}

interface DayUser {
    id: string;
    display_name: string;
    email: string;
    avatar_url: string | null;
    tasks: DayTask[];
}

const STORAGE_KEY = 'dayview-user-order';

function getStoredOrder(): string[] {
    try {
        return JSON.parse(safeLocalStorage.get(STORAGE_KEY) || '[]');
    } catch { return []; }
}

function setStoredOrder(order: string[]) {
    safeLocalStorage.set(STORAGE_KEY, JSON.stringify(order));
}

export default function DayViewPage() {
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [userOrder, setUserOrder] = useState<string[]>(getStoredOrder);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [downloading, setDownloading] = useState<string | null>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ['day-view', date],
        queryFn: () => dayViewApi.get(date),
        staleTime: 30_000,
    });

    const users: DayUser[] = data?.users || [];

    // Sort users by stored order
    const sortedUsers = [...users].sort((a, b) => {
        const ai = userOrder.indexOf(a.id);
        const bi = userOrder.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });

    // Persist order when users load
    useEffect(() => {
        if (users.length && !userOrder.length) {
            const order = users.map(u => u.id);
            setUserOrder(order);
            setStoredOrder(order);
        }
    }, [users]);

    function onDragEnd(result: DropResult) {
        if (!result.destination) return;
        const newOrder = [...sortedUsers.map(u => u.id)];
        const [removed] = newOrder.splice(result.source.index, 1);
        newOrder.splice(result.destination.index, 0, removed);
        setUserOrder(newOrder);
        setStoredOrder(newOrder);
    }

    function toggleCollapse(userId: string) {
        setCollapsed(prev => ({ ...prev, [userId]: !prev[userId] }));
    }

    async function handleDownloadPdf(userId: string) {
        setDownloading(userId);
        try {
            await dayViewApi.downloadPdf(userId, date);
        } catch (e) {
            console.error('PDF download error:', e);
        } finally {
            setDownloading(null);
        }
    }

    const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('ro-RO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const totalTasks = sortedUsers.reduce((sum, u) => sum + u.tasks.length, 0);

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <CalendarClock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Napi nézet</h1>
                        <p className="text-sm text-navy-400 capitalize">{formattedDate}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Quick date navigation */}
                    <button
                        onClick={() => {
                            const d = new Date(date + 'T00:00:00');
                            d.setDate(d.getDate() - 1);
                            setDate(d.toISOString().split('T')[0]);
                        }}
                        className="px-3 py-2 rounded-lg text-sm bg-navy-800 hover:bg-navy-700 text-navy-300 transition-colors"
                    >
                        ← Tegnap
                    </button>
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="px-3 py-2 rounded-lg text-sm bg-navy-800 border border-navy-700 text-white focus:outline-none focus:border-blue-500"
                    />
                    <button
                        onClick={() => setDate(new Date().toISOString().split('T')[0])}
                        className="px-3 py-2 rounded-lg text-sm bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                    >
                        Ma
                    </button>
                    <button
                        onClick={() => {
                            const d = new Date(date + 'T00:00:00');
                            d.setDate(d.getDate() + 1);
                            setDate(d.toISOString().split('T')[0]);
                        }}
                        className="px-3 py-2 rounded-lg text-sm bg-navy-800 hover:bg-navy-700 text-navy-300 transition-colors"
                    >
                        Holnap →
                    </button>
                </div>
            </div>

            {/* Summary pill */}
            {!isLoading && (
                <div className="mb-6 flex gap-3 flex-wrap">
                    <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-navy-800 text-navy-300">
                        {sortedUsers.length} munkatárs
                    </span>
                    <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400">
                        {totalTasks} feladat összesen
                    </span>
                    <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400">
                        {sortedUsers.filter(u => u.tasks.length === 0).length} szabad
                    </span>
                </div>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="text-center py-12">
                    <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                    <p className="text-red-400 text-sm">Hiba történt az adatok betöltésekor.</p>
                </div>
            )}

            {/* User sections — drag to reorder */}
            {!isLoading && !error && (
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="users">
                        {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                                {sortedUsers.map((user, index) => (
                                    <Draggable key={user.id} draggableId={user.id} index={index}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`rounded-xl border transition-all ${
                                                    snapshot.isDragging
                                                        ? 'bg-navy-800 border-blue-500/50 shadow-2xl shadow-blue-500/10'
                                                        : 'bg-navy-900/60 border-navy-700/50'
                                                }`}
                                            >
                                                {/* User header */}
                                                <div className="flex items-center gap-3 px-4 py-3">
                                                    {/* Drag handle */}
                                                    <div {...provided.dragHandleProps} className="cursor-grab text-navy-600 hover:text-navy-400">
                                                        <GripVertical className="w-4 h-4" />
                                                    </div>

                                                    {/* Avatar */}
                                                    <UserAvatar
                                                        name={user.display_name}
                                                        avatarUrl={user.avatar_url}
                                                        size="sm"
                                                    />

                                                    {/* Name + task count */}
                                                    <button
                                                        onClick={() => toggleCollapse(user.id)}
                                                        className="flex items-center gap-2 flex-1 text-left"
                                                    >
                                                        <span className="font-semibold text-sm">{user.display_name}</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                            user.tasks.length === 0
                                                                ? 'bg-green-500/15 text-green-400'
                                                                : 'bg-blue-500/15 text-blue-400'
                                                        }`}>
                                                            {user.tasks.length === 0 ? 'Szabad' : `${user.tasks.length} feladat`}
                                                        </span>
                                                        {collapsed[user.id]
                                                            ? <ChevronRight className="w-4 h-4 text-navy-500" />
                                                            : <ChevronDown className="w-4 h-4 text-navy-500" />
                                                        }
                                                    </button>

                                                    {/* PDF export button */}
                                                    {user.tasks.length > 0 && (
                                                        <button
                                                            onClick={() => handleDownloadPdf(user.id)}
                                                            disabled={downloading === user.id}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                                                            title="PDF letöltés"
                                                        >
                                                            {downloading === user.id
                                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                : <FileDown className="w-3.5 h-3.5" />
                                                            }
                                                            PDF
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Task rows */}
                                                {!collapsed[user.id] && user.tasks.length > 0 && (
                                                    <div className="border-t border-navy-700/40">
                                                        {user.tasks.map((task, ti) => (
                                                            <div
                                                                key={task.id}
                                                                className={`px-5 py-3 ${ti < user.tasks.length - 1 ? 'border-b border-navy-800/50' : ''} hover:bg-navy-800/30 transition-colors`}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    {/* Status indicator */}
                                                                    <div className="mt-0.5">
                                                                        {task.status === 'terminat'
                                                                            ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                                                                            : <Circle className="w-4 h-4 text-navy-500" />
                                                                        }
                                                                    </div>

                                                                    <div className="flex-1 min-w-0">
                                                                        {/* Title row */}
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="text-sm font-medium">{task.title}</span>
                                                                            <span
                                                                                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                                                                style={{
                                                                                    color: STATUSES[task.status]?.color,
                                                                                    background: STATUSES[task.status]?.bg,
                                                                                    border: `1px solid ${STATUSES[task.status]?.border}`,
                                                                                }}
                                                                            >
                                                                                {STATUSES[task.status]?.label}
                                                                            </span>
                                                                            {task.department_label && DEPARTMENTS[task.department_label] && (
                                                                                <span
                                                                                    className="text-[10px] px-1.5 py-0.5 rounded"
                                                                                    style={{
                                                                                        color: DEPARTMENTS[task.department_label]?.color,
                                                                                        background: DEPARTMENTS[task.department_label]?.bg,
                                                                                    }}
                                                                                >
                                                                                    {DEPARTMENTS[task.department_label]?.label}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {/* Description preview */}
                                                                        {task.description && (
                                                                            <p className="text-xs text-navy-400 mt-1 line-clamp-2">
                                                                                {task.description}
                                                                            </p>
                                                                        )}

                                                                        {/* Subtasks */}
                                                                        {task.subtasks.length > 0 && (
                                                                            <div className="mt-2 space-y-1">
                                                                                <span className="text-[10px] text-navy-500 font-medium">
                                                                                    Subtask-uri ({task.subtasks.filter(s => s.is_completed).length}/{task.subtasks.length})
                                                                                </span>
                                                                                {task.subtasks.slice(0, 5).map((sub, si) => (
                                                                                    <div key={si} className="flex items-center gap-1.5 text-xs">
                                                                                        {sub.is_completed
                                                                                            ? <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                                                                                            : <Circle className="w-3 h-3 text-navy-600 flex-shrink-0" />
                                                                                        }
                                                                                        <span className={sub.is_completed ? 'text-navy-500 line-through' : 'text-navy-300'}>
                                                                                            {sub.title}
                                                                                        </span>
                                                                                    </div>
                                                                                ))}
                                                                                {task.subtasks.length > 5 && (
                                                                                    <span className="text-[10px] text-navy-500">
                                                                                        +{task.subtasks.length - 5} további...
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Empty state */}
                                                {!collapsed[user.id] && user.tasks.length === 0 && (
                                                    <div className="border-t border-navy-700/40 px-5 py-4 text-center">
                                                        <p className="text-xs text-navy-500">Nincs feladat erre a napra</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            )}
        </div>
    );
}
