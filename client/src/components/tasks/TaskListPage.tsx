import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { tasksApi } from '../../services/api';
import { Task, TaskFilters, TaskStatus, Department, STATUSES, DEPARTMENTS } from '../../types';
import { getDueDateStatus, formatDate, timeAgo, getDaysOverdue, getDaysUntil } from '../../utils/helpers';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import TaskDrawer from './TaskDrawer';
import TaskFormModal from './TaskFormModal';
import {
    Search, Filter, Plus, ChevronDown, X, Loader2,
    AlertTriangle, Clock, CheckCircle2, Ban, Calendar, RefreshCw, ListTodo
} from 'lucide-react';

export default function TaskListPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<TaskFilters>({});
    const [searchText, setSearchText] = useState('');
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const { showToast } = useToast();
    const location = useLocation();

    useEffect(() => {
        loadTasks();
    }, [filters]);

    useEffect(() => {
        const state = location.state as any;
        if (state?.openTaskId) {
            setSelectedTaskId(state.openTaskId);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const loadTasks = useCallback(async () => {
        try {
            setLoading(true);
            const result = await tasksApi.list(filters);
            setTasks(result.tasks);
            setTotal(result.total);
        } catch (err) {
            showToast('Eroare la încărcarea task-urilor', 'error');
        } finally {
            setLoading(false);
        }
    }, [filters, showToast]);

    function handleSearch() {
        setFilters(prev => ({ ...prev, search: searchText || undefined }));
    }

    function toggleStatusFilter(status: TaskStatus) {
        setFilters(prev => {
            const current = prev.status?.split(',') || [];
            const idx = current.indexOf(status);
            if (idx >= 0) {
                current.splice(idx, 1);
            } else {
                current.push(status);
            }
            return { ...prev, status: current.length > 0 ? current.join(',') : undefined };
        });
    }

    function toggleDeptFilter(dept: Department) {
        setFilters(prev => {
            const current = prev.department?.split(',') || [];
            const idx = current.indexOf(dept);
            if (idx >= 0) {
                current.splice(idx, 1);
            } else {
                current.push(dept);
            }
            return { ...prev, department: current.length > 0 ? current.join(',') : undefined };
        });
    }

    function clearFilters() {
        setFilters({});
        setSearchText('');
    }

    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    return (
        <div className="p-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Sarcini</h1>
                    <p className="text-navy-400 text-sm mt-1">{total} task-uri</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-lg text-sm font-medium shadow-lg hover:shadow-blue-500/25 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Task nou
                </button>
            </div>

            {/* Search & Filters */}
            <div className="mb-4 space-y-3">
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
                        <input
                            type="text"
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder="Caută în titlu, descriere sau comentarii..."
                            className="w-full pl-10 pr-4 py-2.5 bg-navy-900/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        className="px-4 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-navy-300 hover:bg-navy-700/50 transition-colors"
                    >
                        Caută
                    </button>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm transition-colors ${showFilters || activeFilterCount > 0
                                ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                                : 'bg-navy-800/50 border-navy-700/50 text-navy-300 hover:bg-navy-700/50'
                            }`}
                    >
                        <Filter className="w-4 h-4" />
                        Filtre {activeFilterCount > 0 && `(${activeFilterCount})`}
                    </button>
                </div>

                {/* Filter panel */}
                {showFilters && (
                    <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-4 animate-slide-up space-y-4">
                        {/* Status filters */}
                        <div>
                            <label className="text-xs font-medium text-navy-400 mb-2 block">Status</label>
                            <div className="flex flex-wrap gap-2">
                                {(Object.keys(STATUSES) as TaskStatus[]).map(status => {
                                    const active = filters.status?.includes(status);
                                    return (
                                        <button
                                            key={status}
                                            onClick={() => toggleStatusFilter(status)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${active
                                                    ? 'text-white shadow-md'
                                                    : 'bg-navy-800/50 text-navy-300 hover:bg-navy-700/50'
                                                }`}
                                            style={active ? { background: STATUSES[status].color } : undefined}
                                        >
                                            {STATUSES[status].label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Department filters */}
                        <div>
                            <label className="text-xs font-medium text-navy-400 mb-2 block">Departament</label>
                            <div className="flex flex-wrap gap-2">
                                {(Object.keys(DEPARTMENTS) as Department[]).map(dept => {
                                    const active = filters.department?.includes(dept);
                                    return (
                                        <button
                                            key={dept}
                                            onClick={() => toggleDeptFilter(dept)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${active
                                                    ? 'text-white shadow-md'
                                                    : 'bg-navy-800/50 text-navy-300 hover:bg-navy-700/50'
                                                }`}
                                            style={active ? { background: DEPARTMENTS[dept].color } : undefined}
                                        >
                                            {DEPARTMENTS[dept].label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Period filter */}
                        <div>
                            <label className="text-xs font-medium text-navy-400 mb-2 block">Perioadă</label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { value: 'today', label: 'Azi' },
                                    { value: 'this_week', label: 'Săptămâna aceasta' },
                                    { value: 'this_month', label: 'Luna aceasta' },
                                    { value: 'overdue', label: 'Depășite' },
                                ].map(p => (
                                    <button
                                        key={p.value}
                                        onClick={() => setFilters(prev => ({ ...prev, period: prev.period === p.value ? undefined : p.value }))}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filters.period === p.value
                                                ? 'bg-blue-500 text-white shadow-md'
                                                : 'bg-navy-800/50 text-navy-300 hover:bg-navy-700/50'
                                            }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {activeFilterCount > 0 && (
                            <button onClick={clearFilters} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                                <X className="w-3 h-3" /> Șterge filtrele
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Task List Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </div>
            ) : tasks.length === 0 ? (
                <div className="text-center py-20">
                    <ListTodo className="w-16 h-16 text-navy-700 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-navy-400 mb-1">Niciun task găsit</h3>
                    <p className="text-sm text-navy-500 mb-4">Creează primul tău task sau schimbă filtrele.</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm transition-colors"
                    >
                        <Plus className="w-4 h-4 inline mr-1" /> Creează task
                    </button>
                </div>
            ) : (
                <div className="bg-navy-900/30 border border-navy-700/50 rounded-xl overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_120px_130px_140px_80px_130px_100px] gap-2 px-4 py-3 bg-navy-800/30 text-xs font-medium text-navy-400 border-b border-navy-700/50">
                        <span>Titlu</span>
                        <span>Status</span>
                        <span>Data limită</span>
                        <span>Departament</span>
                        <span>Subtask</span>
                        <span>Creat de</span>
                        <span>Activitate</span>
                    </div>

                    {/* Task rows */}
                    {tasks.map((task, index) => {
                        const dueStat = task.status !== 'terminat' ? getDueDateStatus(task.due_date) : 'normal';
                        return (
                            <div
                                key={task.id}
                                onClick={() => setSelectedTaskId(task.id)}
                                className={`grid grid-cols-[1fr_120px_130px_140px_80px_130px_100px] gap-2 px-4 py-3.5 border-b border-navy-800/50 cursor-pointer transition-all hover:bg-navy-800/30 ${dueStat === 'overdue' ? 'bg-red-500/5 border-l-2 border-l-red-500' :
                                        dueStat === 'today' ? 'bg-yellow-500/5 border-l-2 border-l-yellow-500' :
                                            ''
                                    }`}
                                style={{ animationDelay: `${index * 30}ms` }}
                            >
                                {/* Title */}
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{task.title}</p>
                                    {task.status === 'blocat' && task.blocked_reason && (
                                        <div className="flex items-center gap-1 mt-1">
                                            <Ban className="w-3 h-3 text-red-400 flex-shrink-0" />
                                            <p className="text-[11px] text-red-400 truncate">{task.blocked_reason}</p>
                                        </div>
                                    )}
                                    {task.is_recurring && (
                                        <div className="flex items-center gap-1 mt-1">
                                            <RefreshCw className="w-3 h-3 text-cyan-400" />
                                            <span className="text-[10px] text-cyan-400">Recurent</span>
                                        </div>
                                    )}
                                </div>

                                {/* Status */}
                                <div>
                                    <span
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
                                        style={{ background: STATUSES[task.status]?.bg, color: STATUSES[task.status]?.color }}
                                    >
                                        {task.status === 'blocat' && <Ban className="w-3 h-3" />}
                                        {task.status === 'terminat' && <CheckCircle2 className="w-3 h-3" />}
                                        {STATUSES[task.status]?.label}
                                    </span>
                                </div>

                                {/* Due date */}
                                <div>
                                    <span className={`text-xs font-medium ${dueStat === 'overdue' ? 'text-red-400' :
                                            dueStat === 'today' ? 'text-yellow-400' :
                                                dueStat === 'tomorrow' ? 'text-orange-400' :
                                                    dueStat === 'soon' ? 'text-amber-400' :
                                                        'text-navy-300'
                                        }`}>
                                        <Calendar className="w-3 h-3 inline mr-1" />
                                        {formatDate(task.due_date)}
                                    </span>
                                    {dueStat === 'overdue' && (
                                        <p className="text-[10px] text-red-400/80 mt-0.5">
                                            Depășit cu {getDaysOverdue(task.due_date)} zile
                                        </p>
                                    )}
                                </div>

                                {/* Department */}
                                <div>
                                    <span
                                        className="inline-block px-2.5 py-1 rounded-full text-[11px] font-medium text-white"
                                        style={{ background: DEPARTMENTS[task.department_label]?.color }}
                                    >
                                        {DEPARTMENTS[task.department_label]?.label}
                                    </span>
                                </div>

                                {/* Subtask progress */}
                                <div>
                                    {(task.subtask_total ?? 0) > 0 && (
                                        <div>
                                            <span className="text-xs text-navy-300">
                                                {task.subtask_completed}/{task.subtask_total}
                                            </span>
                                            <div className="w-full h-1.5 bg-navy-700 rounded-full mt-1">
                                                <div
                                                    className="h-full bg-blue-400 rounded-full transition-all"
                                                    style={{ width: `${((task.subtask_completed || 0) / (task.subtask_total || 1)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Creator */}
                                <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                        {task.creator_name?.charAt(0) || '?'}
                                    </div>
                                    <span className="text-xs text-navy-300 truncate">{task.creator_name}</span>
                                </div>

                                {/* Last activity */}
                                <div>
                                    <span className="text-[11px] text-navy-500">
                                        {task.last_activity ? timeAgo(task.last_activity) : '-'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Task Drawer */}
            {selectedTaskId && (
                <TaskDrawer
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                    onUpdate={loadTasks}
                />
            )}

            {/* Create Task Modal */}
            {showCreateModal && (
                <TaskFormModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={() => {
                        setShowCreateModal(false);
                        loadTasks();
                        showToast('Task creat cu succes!');
                    }}
                />
            )}
        </div>
    );
}
