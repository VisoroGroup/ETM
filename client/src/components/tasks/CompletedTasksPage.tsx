import React, { useState, useEffect, useCallback } from 'react';
import { tasksApi } from '../../services/api';
import { Task, STATUSES, DEPARTMENTS } from '../../types';
import { formatDate, timeAgo } from '../../utils/helpers';
import { useToast } from '../../hooks/useToast';
import TaskDrawer from './TaskDrawer';
import {
    Search, CheckCircle2, RotateCcw, Calendar, Loader2, Archive
} from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';

export default function CompletedTasksPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [reactivatingId, setReactivatingId] = useState<string | null>(null);
    const { showToast } = useToast();

    const loadTasks = useCallback(async () => {
        try {
            setLoading(true);
            const result = await tasksApi.list({
                status: 'terminat',
                search: searchQuery || undefined,
                limit: 200,
            });
            setTasks(result.tasks);
            setTotal(result.total);
        } catch {
            showToast('Eroare la încărcarea task-urilor', 'error');
        } finally {
            setLoading(false);
        }
    }, [searchQuery, showToast]);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    function handleSearch() {
        setSearchQuery(searchText);
    }

    async function reactivateTask(taskId: string) {
        setReactivatingId(taskId);
        try {
            await tasksApi.changeStatus(taskId, 'de_rezolvat');
            showToast('Task reactivat!');
            setTasks(prev => prev.filter(t => t.id !== taskId));
            setTotal(prev => prev - 1);
        } catch {
            showToast('Eroare la reactivare', 'error');
        } finally {
            setReactivatingId(null);
        }
    }

    return (
        <div className="p-4 md:p-6 animate-fade-in">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Taskuri Terminate</h1>
                        <p className="text-navy-400 text-sm">{total} task-uri finalizate</p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="mb-5 flex flex-col md:flex-row gap-2">
                <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
                    <input
                        type="text"
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="Caută în taskuri terminate..."
                        className="w-full pl-10 pr-4 py-2.5 bg-navy-900/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                </div>
                <button
                    onClick={handleSearch}
                    className="px-4 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-navy-300 hover:bg-navy-700/50 transition-colors"
                >
                    Caută
                </button>
            </div>

            {/* Task List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-navy-500 animate-spin" />
                </div>
            ) : tasks.length === 0 ? (
                <div className="text-center py-20">
                    <Archive className="w-16 h-16 text-navy-700 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-navy-400 mb-1">
                        {searchQuery ? 'Niciun rezultat' : 'Niciun task terminat'}
                    </h3>
                    <p className="text-sm text-navy-500">
                        {searchQuery ? 'Încearcă cu alți termeni de căutare.' : 'Taskurile completate vor apărea aici.'}
                    </p>
                </div>
            ) : (
                <>
                    {/* Mobile cards */}
                    <div className="md:hidden space-y-2">
                        {tasks.map(task => (
                            <div
                                key={task.id}
                                className="bg-navy-900/30 border border-navy-700/50 rounded-xl p-4 cursor-pointer transition-all active:scale-[0.98] border-l-4 border-l-emerald-500/40"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0" onClick={() => setSelectedTaskId(task.id)}>
                                        <p className="text-sm font-semibold leading-snug">{task.title}</p>
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                            <span className="text-[10px] text-navy-400 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(task.due_date)}
                                            </span>
                                            {task.department_label && DEPARTMENTS[task.department_label] && (
                                                <span
                                                    className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
                                                    style={{
                                                        background: DEPARTMENTS[task.department_label].bg,
                                                        color: DEPARTMENTS[task.department_label].color,
                                                        borderColor: DEPARTMENTS[task.department_label].border
                                                    }}
                                                >
                                                    {DEPARTMENTS[task.department_label].label}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); reactivateTask(task.id); }}
                                        disabled={reactivatingId === task.id}
                                        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg text-[11px] font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                                    >
                                        <RotateCcw className={`w-3 h-3 ${reactivatingId === task.id ? 'animate-spin' : ''}`} />
                                        Reactivează
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block bg-navy-900/30 border border-navy-700/50 rounded-xl">
                        {/* Header */}
                        <div className="grid grid-cols-[1fr_120px_160px_140px_100px_120px] gap-3 px-4 py-3 bg-navy-800/30 text-xs font-medium text-navy-400 border-b border-navy-700/50 rounded-t-xl">
                            <span>Titlu</span>
                            <span>Data limită</span>
                            <span>Creat de</span>
                            <span>Departament</span>
                            <span>Terminat</span>
                            <span></span>
                        </div>

                        {/* Rows */}
                        {tasks.map((task, index) => (
                            <div
                                key={task.id}
                                className="grid grid-cols-[1fr_120px_160px_140px_100px_120px] gap-3 px-4 py-3.5 border-b border-navy-800/50 cursor-pointer transition-all hover:bg-navy-800/30 items-center"
                                style={{ animationDelay: `${index * 20}ms` }}
                            >
                                {/* Title */}
                                <div className="min-w-0" onClick={() => setSelectedTaskId(task.id)}>
                                    <p className="text-sm font-medium truncate">{task.title}</p>
                                </div>

                                {/* Due date */}
                                <div>
                                    <span className="text-xs text-navy-400 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {formatDate(task.due_date)}
                                    </span>
                                </div>

                                {/* Creator */}
                                <div className="flex items-center gap-1.5">
                                    <UserAvatar
                                        name={task.creator_name}
                                        avatarUrl={task.creator_avatar}
                                        size="xs"
                                    />
                                    <span className="text-xs text-navy-300 truncate">{task.creator_name}</span>
                                </div>

                                {/* Department */}
                                <div>
                                    {task.department_label && DEPARTMENTS[task.department_label] && (
                                        <span
                                            className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium border"
                                            style={{
                                                background: DEPARTMENTS[task.department_label].bg,
                                                color: DEPARTMENTS[task.department_label].color,
                                                borderColor: DEPARTMENTS[task.department_label].border
                                            }}
                                        >
                                            {DEPARTMENTS[task.department_label].label}
                                        </span>
                                    )}
                                </div>

                                {/* Last activity / completed time */}
                                <div>
                                    <span className="text-[11px] text-navy-500">
                                        {task.last_activity ? timeAgo(task.last_activity) : timeAgo(task.updated_at)}
                                    </span>
                                </div>

                                {/* Reactivate button */}
                                <div onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => reactivateTask(task.id)}
                                        disabled={reactivatingId === task.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg text-[11px] font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                                    >
                                        <RotateCcw className={`w-3 h-3 ${reactivatingId === task.id ? 'animate-spin' : ''}`} />
                                        Reactivează
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Task Drawer */}
            {selectedTaskId && (
                <TaskDrawer
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                    onUpdate={loadTasks}
                />
            )}
        </div>
    );
}
