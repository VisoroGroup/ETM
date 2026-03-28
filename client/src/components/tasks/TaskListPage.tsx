import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { tasksApi, savedFiltersApi } from '../../services/api';
import { Task, TaskFilters, TaskStatus, Department, STATUSES, DEPARTMENTS } from '../../types';
import { getDueDateStatus, formatDate, timeAgo, getDaysOverdue, getDaysUntil } from '../../utils/helpers';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import TaskDrawer from './TaskDrawer';
import TaskFormModal from './TaskFormModal';
import KanbanView from './KanbanView';
import { SkeletonTaskList } from '../ui/Skeleton';
import {
    Search, Filter, Plus, X, Loader2,
    AlertTriangle, Clock, CheckCircle2, Ban, Calendar, RefreshCw, ListTodo,
    LayoutList, LayoutGrid, Trash2, CheckSquare, Square, ChevronDown, UserCircle, Tag,
    Bookmark, BookmarkPlus, Link2
} from 'lucide-react';
import { authApi } from '../../services/api';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import { exportToCSV } from '../../utils/exportUtils';

export default function TaskListPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<TaskFilters>({});
    const [searchText, setSearchText] = useState('');
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showKanban, setShowKanban] = useState(false);
    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
    const [bulkDeptOpen, setBulkDeptOpen] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deptDropdownId, setDeptDropdownId] = useState<string | null>(null);
    const [savedViews, setSavedViews] = useState<any[]>([]);
    const [savingView, setSavingView] = useState(false);
    const [viewName, setViewName] = useState('');
    const { user } = useAuth();
    const { showToast } = useToast();
    const location = useLocation();
    const searchRef = useRef<HTMLInputElement>(null);

    // Keyboard shortcuts
    const shortcuts = useMemo(() => ({
        '/': () => searchRef.current?.focus(),
        'Escape': () => {
            if (selectedTaskId) setSelectedTaskId(null);
            else if (showCreateModal) setShowCreateModal(false);
        },
        'Ctrl+n': () => setShowCreateModal(true),
    }), [selectedTaskId, showCreateModal]);
    useKeyboardShortcuts(shortcuts);

    useEffect(() => { authApi.users().then(setUsers).catch(() => {}); }, []);
    useEffect(() => { savedFiltersApi.list().then(setSavedViews).catch(() => {}); }, []);
    const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== '');
    async function saveView() {
        if (!viewName.trim()) return;
        try {
            const created = await savedFiltersApi.create(viewName.trim(), 'tasks', filters);
            setSavedViews(prev => [...prev, created]);
            setViewName('');
            setSavingView(false);
            showToast('Vedere salvată!');
        } catch { showToast('Eroare la salvare', 'error'); }
    }
    async function deleteView(id: string) {
        try {
            await savedFiltersApi.delete(id);
            setSavedViews(prev => prev.filter(v => v.id !== id));
            showToast('Vedere ștearsă');
        } catch { showToast('Eroare', 'error'); }
    }
    function applyView(view: any) {
        setFilters(view.filter_config || {});
        if (view.filter_config?.search) setSearchText(view.filter_config.search);
        setShowFilters(true);
    }

    useEffect(() => {
        loadTasks();
    }, [filters]);

    useEffect(() => {
        const state = location.state as any;
        if (state?.openTaskId) {
            setSelectedTaskId(state.openTaskId);
            window.history.replaceState({}, document.title);
        }
        // Support email links: /tasks?openTaskId=xyz
        const urlParams = new URLSearchParams(window.location.search);
        const openTaskIdParam = urlParams.get('openTaskId');
        if (openTaskIdParam) {
            setSelectedTaskId(openTaskIdParam);
            // Clean URL without reload
            urlParams.delete('openTaskId');
            const cleanUrl = urlParams.toString()
                ? `${window.location.pathname}?${urlParams.toString()}`
                : window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        }
        if (state?.filter === 'overdue') {
            setFilters({ period: 'overdue' });
            setShowFilters(true);
            window.history.replaceState({}, document.title);
        }
        if (state?.filter === 'blocat') {
            setFilters({ status: 'blocat' });
            setShowFilters(true);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const loadTasks = useCallback(async () => {
        try {
            setLoading(true);
            const result = await tasksApi.list({ ...filters, exclude_status: 'terminat' });
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

    const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== 'my_tasks' && Boolean(v)).length;

    // Bulk helpers
    const allSelected = tasks.length > 0 && selectedIds.size === tasks.length;
    const someSelected = selectedIds.size > 0 && !allSelected;
    function toggleAll() {
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(tasks.map(t => t.id)));
    }
    function toggleId(id: string) {
        setSelectedIds(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    }
    async function bulkChangeStatus(status: TaskStatus) {
        setBulkStatusOpen(false);
        let ok = 0;
        for (const id of selectedIds) {
            try { await tasksApi.changeStatus(id, status); ok++; } catch {}
        }
        showToast(`${ok} task → ${STATUSES[status].label}`);
        setSelectedIds(new Set());
        loadTasks();
    }
    async function bulkDelete() {
        setShowDeleteConfirm(false);
        let ok = 0;
        let fail = 0;
        let lastError = '';
        for (const id of selectedIds) {
            try { await tasksApi.delete(id); ok++; } catch (e: any) {
                fail++;
                lastError = e.response?.data?.error || e.message || 'Unknown error';
                console.error(`[bulkDelete] Failed to delete task ${id}:`, e.response?.status, lastError);
            }
        }
        if (fail > 0) {
            showToast(`${ok} șters, ${fail} eșuat: ${lastError}`, 'error');
        } else {
            showToast(`${ok} task-uri șterse`);
        }
        setSelectedIds(new Set());
        loadTasks();
    }
    async function bulkAssign(userId: string | null) {
        setBulkAssignOpen(false);
        let ok = 0;
        for (const id of selectedIds) {
            try { await tasksApi.update(id, { assigned_to: userId } as any); ok++; } catch {}
        }
        showToast(userId ? `${ok} task asignat` : `${ok} task neasignat`);
        setSelectedIds(new Set());
        loadTasks();
    }

    async function changeDepartment(taskId: string, dept: Department) {
        setDeptDropdownId(null);
        try {
            await tasksApi.update(taskId, { department_label: dept } as any);
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, department_label: dept } : t));
            showToast(`Departament actualizat`);
        } catch {
            showToast('Eroare la actualizare', 'error');
        }
    }

    async function bulkChangeDept(dept: Department) {
        setBulkDeptOpen(false);
        let ok = 0;
        for (const id of selectedIds) {
            try { await tasksApi.update(id, { department_label: dept } as any); ok++; } catch {}
        }
        showToast(`${ok} task → ${DEPARTMENTS[dept].label}`);
        setSelectedIds(new Set());
        loadTasks();
    }

    return (
        <div className="p-4 md:p-6 animate-fade-in max-w-[1350px] mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Sarcini</h1>
                    <p className="text-navy-400 text-sm mt-1">{total} task-uri</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Kanban / Listă toggle */}
                    <div className="flex items-center bg-navy-800/50 border border-navy-700/50 rounded-lg p-1">
                        <button
                            onClick={() => setShowKanban(false)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                !showKanban ? 'bg-blue-500 text-white shadow' : 'text-navy-400 hover:text-navy-200'
                            }`}
                        >
                            <LayoutList className="w-3.5 h-3.5" /> Listă
                        </button>
                        <button
                            onClick={() => setShowKanban(true)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                showKanban ? 'bg-blue-500 text-white shadow' : 'text-navy-400 hover:text-navy-200'
                            }`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
                        </button>
                    </div>
                    <button
                        onClick={() => exportToCSV(tasks)}
                        className="hidden md:flex items-center gap-2 px-3 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-navy-300 hover:bg-navy-700/50 transition-colors"
                        title="Exportă lista curentă"
                    >
                        CSV
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-lg text-sm font-medium shadow-lg hover:shadow-blue-500/25 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Task nou
                    </button>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="mb-4 space-y-3">
                <div className="flex flex-col md:flex-row gap-2">
                    <div className="flex-1 relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder="Caută în titlu, descriere sau comentarii..."
                            className="w-full pl-10 pr-4 py-2.5 bg-navy-900/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSearch}
                            className="flex-1 md:flex-none px-4 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-navy-300 hover:bg-navy-700/50 transition-colors"
                        >
                            Caută
                        </button>
                        <button
                            onClick={() => setFilters(prev => ({
                                ...prev,
                                my_tasks: prev.my_tasks === 'true' ? undefined : 'true'
                            }))}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg text-sm transition-colors ${
                                filters.my_tasks === 'true'
                                    ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                                    : 'bg-navy-800/50 border-navy-700/50 text-navy-300 hover:bg-navy-700/50'
                            }`}
                        >
                            <UserCircle className="w-4 h-4" />
                            Sarcinile mele
                        </button>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg text-sm transition-colors ${showFilters || activeFilterCount > 0
                                    ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                                    : 'bg-navy-800/50 border-navy-700/50 text-navy-300 hover:bg-navy-700/50'
                                }`}
                        >
                            <Filter className="w-4 h-4" />
                            Filtre {activeFilterCount > 0 && `(${activeFilterCount})`}
                        </button>
                    </div>
                </div>

                {/* Saved filter chips */}
                {(savedViews.length > 0 || hasActiveFilters) && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {savedViews.filter(v => v.page === 'tasks').map(v => (
                            <div key={v.id} className="flex items-center group">
                                <button
                                    onClick={() => applyView(v)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-800/50 border border-navy-700/50 rounded-l-lg text-xs text-navy-300 hover:bg-navy-700/50 hover:text-white transition-colors"
                                >
                                    <Bookmark className="w-3 h-3 text-blue-400" /> {v.name}
                                </button>
                                <button
                                    onClick={() => deleteView(v.id)}
                                    className="px-1.5 py-1.5 bg-navy-800/50 border border-l-0 border-navy-700/50 rounded-r-lg text-navy-500 hover:text-red-400 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        {hasActiveFilters && !savingView && (
                            <button
                                onClick={() => setSavingView(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-navy-600 rounded-lg text-xs text-navy-400 hover:border-blue-500/50 hover:text-blue-400 transition-colors"
                            >
                                <BookmarkPlus className="w-3 h-3" /> Salvează vederea
                            </button>
                        )}
                        {savingView && (
                            <div className="flex items-center gap-1.5">
                                <input
                                    autoFocus
                                    value={viewName}
                                    onChange={e => setViewName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && saveView()}
                                    placeholder="Numele vederii..."
                                    className="px-2 py-1 bg-navy-800 border border-navy-600 rounded text-xs text-white w-40 outline-none focus:border-blue-500"
                                />
                                <button onClick={saveView} className="text-xs text-blue-400 hover:text-blue-300">Salvează</button>
                                <button onClick={() => { setSavingView(false); setViewName(''); }} className="text-xs text-navy-500 hover:text-navy-300">Anulează</button>
                            </div>
                        )}
                    </div>
                )}

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

            {/* Task List / Kanban */}
            {loading ? (
                <SkeletonTaskList rows={6} />
            ) : showKanban ? (
                <KanbanView
                    tasks={tasks}
                    onTaskClick={(id) => setSelectedTaskId(id)}
                    onUpdate={loadTasks}
                />
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
                <>
                    {/* ===== MOBILE CARD LAYOUT (<md) ===== */}
                    <div className="md:hidden space-y-2">
                        {tasks.map((task, index) => {
                            const dueStat = task.status !== 'terminat' ? getDueDateStatus(task.due_date) : 'normal';
                            const isChecked = selectedIds.has(task.id);
                            return (
                                <div
                                    key={task.id}
                                    onClick={() => setSelectedTaskId(task.id)}
                                    className={`bg-navy-900/30 border border-navy-700/50 rounded-xl p-4 cursor-pointer transition-all active:scale-[0.98] ${
                                        isChecked ? 'border-l-4 border-l-blue-500 bg-blue-500/5' :
                                        dueStat === 'overdue' ? 'border-l-4 border-l-red-500 bg-red-500/5' :
                                        dueStat === 'today' ? 'border-l-4 border-l-yellow-500 bg-yellow-500/5' : ''
                                    }`}
                                    style={{ animationDelay: `${index * 30}ms` }}
                                >
                                    {/* Top row: checkbox + title */}
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="mt-0.5 flex-shrink-0"
                                            onClick={e => { e.stopPropagation(); toggleId(task.id); }}
                                        >
                                            {isChecked
                                                ? <CheckSquare className="w-5 h-5 text-blue-400" />
                                                : <Square className="w-5 h-5 text-navy-600" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold leading-snug">{task.title}</p>
                                            {task.status === 'blocat' && task.blocked_reason && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Ban className="w-3 h-3 text-red-400 flex-shrink-0" />
                                                    <p className="text-[11px] text-red-400 truncate">{task.blocked_reason}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom row: status + date + subtasks + dept */}
                                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                                        {/* Status badge */}
                                        <span
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                                            style={{ background: STATUSES[task.status]?.bg, color: STATUSES[task.status]?.color, borderColor: STATUSES[task.status]?.border }}
                                        >
                                            {task.status === 'blocat' && <Ban className="w-2.5 h-2.5" />}
                                            {task.status === 'terminat' && <CheckCircle2 className="w-2.5 h-2.5" />}
                                            {STATUSES[task.status]?.label}
                                        </span>

                                        {/* Due date */}
                                        <span className={`text-[10px] font-medium flex items-center gap-1 ${
                                            dueStat === 'overdue' ? 'text-red-400' :
                                            dueStat === 'today' ? 'text-yellow-400' :
                                            dueStat === 'tomorrow' ? 'text-orange-400' :
                                            dueStat === 'soon' ? 'text-amber-400' :
                                            'text-navy-400'
                                        }`}>
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(task.due_date)}
                                            {dueStat === 'overdue' && (
                                                <span className="text-red-400/70 ml-1">Depășit cu {getDaysOverdue(task.due_date)}z</span>
                                            )}
                                        </span>

                                        {/* Subtask progress */}
                                        {(task.subtask_total ?? 0) > 0 && (
                                            <span className="text-[10px] text-navy-400 flex items-center gap-1">
                                                {task.subtask_completed}/{task.subtask_total}
                                                <div className="w-10 h-1 bg-navy-700 rounded-full">
                                                    <div
                                                        className="h-full bg-blue-400 rounded-full"
                                                        style={{ width: `${((task.subtask_completed || 0) / (task.subtask_total || 1)) * 100}%` }}
                                                    />
                                                </div>
                                            </span>
                                        )}

                                        {/* Department */}
                                        {task.department_label && DEPARTMENTS[task.department_label] && (
                                            <span
                                                className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
                                                style={{ background: DEPARTMENTS[task.department_label].bg, color: DEPARTMENTS[task.department_label].color, borderColor: DEPARTMENTS[task.department_label].border }}
                                            >
                                                {DEPARTMENTS[task.department_label].label}
                                            </span>
                                        )}

                                        {/* Recurring / dependency icons */}
                                        {task.is_recurring && (
                                            <RefreshCw className="w-3 h-3 text-cyan-400" />
                                        )}
                                        {(task.dependency_count ?? 0) > 0 && (
                                            <span className="text-[10px] text-orange-400 flex items-center gap-0.5">
                                                <Link2 className="w-3 h-3" /> {task.dependency_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ===== DESKTOP TABLE LAYOUT (md+) ===== */}
                    <div className="hidden md:block bg-navy-900/30 border border-navy-700/50 rounded-xl overflow-hidden shadow-2xl">
                        {/* Table header */}
                        <div className="grid grid-cols-[32px_1fr_200px_160px_140px] gap-4 px-5 py-3.5 bg-navy-800/40 text-[11px] uppercase tracking-wider font-semibold text-navy-400 border-b border-navy-700/50 items-center">
                            {/* Select all checkbox */}
                            <div className="flex items-center justify-center cursor-pointer" onClick={toggleAll}>
                                {allSelected
                                    ? <CheckSquare className="w-4 h-4 text-blue-400 cursor-pointer" />
                                    : someSelected
                                        ? <CheckSquare className="w-4 h-4 text-blue-400/50 cursor-pointer" />
                                        : <Square className="w-4 h-4 text-navy-600 cursor-pointer hover:text-navy-400" />}
                            </div>
                            <div>Detalii Sarcină</div>
                            <div>Responsabil</div>
                            <div>Termen & Status</div>
                            <div>Departament</div>
                        </div>

                        {/* Task rows */}
                        {tasks.map((task, index) => {
                            const dueStat = task.status !== 'terminat' ? getDueDateStatus(task.due_date) : 'normal';
                            const isChecked = selectedIds.has(task.id);
                            return (
                                <div
                                    key={task.id}
                                    onClick={() => setSelectedTaskId(task.id)}
                                    className={`grid grid-cols-[32px_1fr_200px_160px_140px] gap-4 px-5 py-4 border-b border-navy-800/80 cursor-pointer transition-colors items-start group hover:bg-navy-800/30 ${
                                        isChecked ? 'bg-blue-500/5 border-l-2 border-l-blue-500' :
                                        dueStat === 'overdue' ? 'bg-red-500/5 border-l-2 border-l-red-500' :
                                        dueStat === 'today' ? 'bg-yellow-500/5 border-l-2 border-l-yellow-500' : ''
                                    }`}
                                    style={{ animationDelay: `${index * 30}ms` }}
                                >
                                    {/* Row checkbox */}
                                    <div
                                        className="flex items-center justify-center mt-1"
                                        onClick={e => { e.stopPropagation(); toggleId(task.id); }}
                                    >
                                        {isChecked
                                            ? <CheckSquare className="w-4 h-4 text-blue-400 cursor-pointer" />
                                            : <Square className="w-4 h-4 text-navy-600 hover:text-navy-400 cursor-pointer" />}
                                    </div>

                                    {/* Task Info */}
                                    <div className="flex flex-col gap-1.5 pr-6 min-w-0">
                                        <h3 className="text-[14px] font-semibold text-white leading-snug group-hover:text-blue-400 transition-colors truncate">
                                            {task.title}
                                        </h3>
                                        
                                        {task.description && (
                                            <p className="text-[12px] text-navy-300 line-clamp-2 leading-relaxed font-normal">
                                                {task.description}
                                            </p>
                                        )}
                                        
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            {task.status === 'blocat' && task.blocked_reason && (
                                                <span className="text-[10px] font-medium text-red-400 flex items-center gap-1 bg-red-900/20 px-2 py-1 rounded border border-red-800/30">
                                                    <Ban className="w-3 h-3" /> <span className="truncate max-w-[150px]">{task.blocked_reason}</span>
                                                </span>
                                            )}
                                            
                                            {(task.subtask_total ?? 0) > 0 && (
                                                <span className="text-[10px] font-medium text-navy-300 flex items-center gap-1.5 bg-navy-800/60 px-2 py-1 rounded border border-navy-700/50">
                                                    <span className={`w-3 h-3 rounded-[3px] ${task.subtask_completed === task.subtask_total ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-blue-500/20 border-blue-500/50'} border flex items-center justify-center`}>
                                                        {task.subtask_completed === task.subtask_total && <CheckSquare className="w-2 h-2 text-emerald-400" />}
                                                    </span>
                                                    {task.subtask_completed}/{task.subtask_total} Subtasks
                                                </span>
                                            )}
                                            
                                            {task.is_recurring && (
                                                <span className="text-[10px] font-medium text-cyan-400 flex items-center gap-1 bg-cyan-900/20 px-2 py-1 rounded border border-cyan-800/30">
                                                    <RefreshCw className="w-3 h-3" /> Recurent
                                                </span>
                                            )}
                                            
                                            {(task.dependency_count ?? 0) > 0 && (
                                                <span className="text-[10px] font-medium text-orange-400 flex items-center gap-1 bg-orange-900/20 px-2 py-1 rounded border border-orange-800/30">
                                                    <Link2 className="w-3 h-3" /> Blocat de {task.dependency_count}
                                                </span>
                                            )}
                                            
                                            {(task.blocks_count ?? 0) > 0 && !(task.dependency_count ?? 0) && (
                                                <span className="text-[10px] font-medium text-amber-400 flex items-center gap-1 bg-amber-900/20 px-2 py-1 rounded border border-amber-800/30">
                                                    <Link2 className="w-3 h-3" /> Blochează {task.blocks_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Responsabil */}
                                    <div className="flex items-center gap-3 mt-0.5">
                                        {task.assignee_name ? (
                                            <>
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white text-[13px] font-bold shadow-md shadow-blue-500/20 flex-shrink-0">
                                                    {task.assignee_name.charAt(0)}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[9px] text-navy-400 uppercase tracking-widest font-semibold mb-0.5">Responsabil</span>
                                                    <span className="text-[13px] font-semibold text-white truncate">{task.assignee_name}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                 <div className="w-9 h-9 rounded-full bg-navy-800 border border-navy-700 flex items-center justify-center text-navy-500 flex-shrink-0">
                                                    <UserCircle className="w-5 h-5" />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[9px] text-navy-400 uppercase tracking-widest font-semibold mb-0.5">Responsabil</span>
                                                    <span className="text-[13px] font-medium text-navy-500 truncate">Neasignat</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Termen & Status */}
                                    <div className="flex flex-col gap-2 items-start mt-0.5">
                                        <div>
                                            <div className={`flex items-center gap-1.5 ${
                                                dueStat === 'overdue' ? 'text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-md' :
                                                dueStat === 'today' ? 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-md' :
                                                dueStat === 'tomorrow' ? 'text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-md' :
                                                dueStat === 'soon' ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md' :
                                                'text-navy-300 px-1 py-1'
                                            }`}>
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span className="text-[11px] font-semibold">{formatDate(task.due_date)}</span>
                                            </div>
                                            {dueStat === 'overdue' && (
                                                <span className="text-[9px] text-red-400/80 font-medium ml-1 block mt-1">
                                                    Depășit cu {getDaysOverdue(task.due_date)}z
                                                </span>
                                            )}
                                        </div>
                                        
                                        <span
                                            className="inline-flex items-center gap-1 mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border"
                                            style={{ background: STATUSES[task.status]?.bg, color: STATUSES[task.status]?.color, borderColor: STATUSES[task.status]?.border }}
                                        >
                                            {task.status === 'blocat' && <Ban className="w-2.5 h-2.5" />}
                                            {task.status === 'terminat' && <CheckCircle2 className="w-2.5 h-2.5" />}
                                            {STATUSES[task.status]?.label}
                                        </span>
                                    </div>

                                    {/* Departament & Activity */}
                                    <div className="flex flex-col gap-2 items-start mt-0.5 relative" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => setDeptDropdownId(deptDropdownId === task.id ? null : task.id)}
                                            className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1.5 transition-opacity hover:opacity-80"
                                            style={task.department_label && DEPARTMENTS[task.department_label]
                                                ? { background: DEPARTMENTS[task.department_label].bg, color: DEPARTMENTS[task.department_label].color, borderColor: DEPARTMENTS[task.department_label].border }
                                                : { background: 'rgba(255,255,255,0.05)', color: '#64748b', borderColor: 'rgba(255,255,255,0.1)' }
                                            }
                                        >
                                            <span className="truncate">
                                                {task.department_label && DEPARTMENTS[task.department_label]
                                                    ? DEPARTMENTS[task.department_label].label
                                                    : 'Fără departament'
                                                }
                                            </span>
                                            <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-60" />
                                        </button>
                                        {deptDropdownId === task.id && (
                                            <div className="absolute top-8 left-0 z-50 bg-navy-800 border border-navy-700 rounded-xl shadow-2xl py-1 min-w-[160px] animate-slide-up">
                                                {(Object.keys(DEPARTMENTS) as Department[]).map(dept => (
                                                    <button
                                                        key={dept}
                                                        onClick={() => changeDepartment(task.id, dept)}
                                                        className="flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors hover:bg-navy-700 font-medium"
                                                        style={{ color: DEPARTMENTS[dept].color }}
                                                    >
                                                        <span
                                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                                            style={{ background: DEPARTMENTS[dept].color }}
                                                        />
                                                        {DEPARTMENTS[dept].label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        
                                        <div className="text-[10px] text-navy-500 font-medium flex items-center gap-1 mt-1">
                                            <Clock className="w-3 h-3" />
                                            {task.last_activity ? timeAgo(task.last_activity) : '—'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 md:px-4 py-2.5 md:py-3 bg-navy-900 border border-blue-500/40 rounded-2xl shadow-2xl shadow-blue-500/10 animate-slide-up flex-wrap justify-center max-w-[95vw]">
                    <span className="text-sm font-semibold text-blue-400 mr-2">{selectedIds.size} selectat{selectedIds.size > 1 ? 'e' : ''}</span>

                    {/* Status change */}
                    <div className="relative">
                        <button
                            onClick={() => { setBulkStatusOpen(o => !o); setBulkAssignOpen(false); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-800 hover:bg-navy-700 border border-navy-600 rounded-lg text-xs font-medium text-white transition-colors"
                        >
                            <CheckSquare className="w-3.5 h-3.5" /> Status <ChevronDown className="w-3 h-3" />
                        </button>
                        {bulkStatusOpen && (
                            <div className="absolute bottom-10 left-0 bg-navy-800 border border-navy-700 rounded-xl shadow-xl py-1 min-w-[160px] animate-slide-up">
                                {(Object.keys(STATUSES) as TaskStatus[]).map(s => (
                                    <button
                                        key={s}
                                        onClick={() => bulkChangeStatus(s)}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-navy-700 transition-colors"
                                        style={{ color: STATUSES[s].color }}
                                    >
                                        {STATUSES[s].label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Assign */}
                    <div className="relative">
                        <button
                            onClick={() => { setBulkAssignOpen(o => !o); setBulkStatusOpen(false); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-800 hover:bg-navy-700 border border-navy-600 rounded-lg text-xs font-medium text-white transition-colors"
                        >
                            <UserCircle className="w-3.5 h-3.5" /> Asignează <ChevronDown className="w-3 h-3" />
                        </button>
                        {bulkAssignOpen && (
                            <div className="absolute bottom-10 left-0 bg-navy-800 border border-navy-700 rounded-xl shadow-xl py-1 min-w-[180px] animate-slide-up">
                                <button onClick={() => bulkAssign(null)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-navy-400 hover:bg-navy-700">— Neasignat —</button>
                                {users.map(u => (
                                    <button key={u.id} onClick={() => bulkAssign(u.id)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-white hover:bg-navy-700">
                                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-[9px] font-bold">
                                            {(u.display_name || u.email).charAt(0)}
                                        </div>
                                        {u.display_name || u.email}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Department */}
                    <div className="relative">
                        <button
                            onClick={() => { setBulkDeptOpen(o => !o); setBulkStatusOpen(false); setBulkAssignOpen(false); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-800 hover:bg-navy-700 border border-navy-600 rounded-lg text-xs font-medium text-white transition-colors"
                        >
                            <Tag className="w-3.5 h-3.5" /> Dept <ChevronDown className="w-3 h-3" />
                        </button>
                        {bulkDeptOpen && (
                            <div className="absolute bottom-10 left-0 bg-navy-800 border border-navy-700 rounded-xl shadow-xl py-1 min-w-[180px] animate-slide-up">
                                {(Object.keys(DEPARTMENTS) as Department[]).map(dept => (
                                    <button
                                        key={dept}
                                        onClick={() => bulkChangeDept(dept)}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-navy-700 transition-colors"
                                        style={{ color: DEPARTMENTS[dept].color }}
                                    >
                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DEPARTMENTS[dept].color }} />
                                        {DEPARTMENTS[dept].label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Delete */}
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 rounded-lg text-xs font-medium text-red-400 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Șterge
                    </button>

                    {/* Clear */}
                    <button onClick={() => setSelectedIds(new Set())} className="ml-1 text-navy-500 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Confirmare ștergere</h3>
                                <p className="text-xs text-navy-400">Acțiunea este ireversibilă</p>
                            </div>
                        </div>
                        <p className="text-sm text-navy-300 mb-6">
                            Ești sigur că vrei să ștergi <strong className="text-white">{selectedIds.size} task-uri</strong>?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium bg-navy-700 hover:bg-navy-600 text-navy-300 transition-colors"
                            >
                                Anulează
                            </button>
                            <button
                                onClick={bulkDelete}
                                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
                            >
                                Șterge definitiv
                            </button>
                        </div>
                    </div>
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
