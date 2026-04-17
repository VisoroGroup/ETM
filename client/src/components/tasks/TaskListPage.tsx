import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { tasksApi, savedFiltersApi, userPreferencesApi, departmentsApi } from '../../services/api';
import { Task, TaskFilters, TaskStatus, Department, STATUSES, DEPARTMENTS, OrgDepartment } from '../../types';
import { getDueDateStatus, formatDate, timeAgo, getDaysOverdue, getDaysUntil } from '../../utils/helpers';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import TaskDrawer from './TaskDrawer';
import TaskFormModal from './TaskFormModal';
import OrgDepartmentAccordion from './OrgDepartmentAccordion';
import PolicyDrawer from './PolicyDrawer';
import { DepartmentEditModal, SectionEditModal, PostEditModal } from './OrgEditModals';
import { SkeletonTaskList } from '../ui/Skeleton';
import {
    Search, Filter, Plus, X, Loader2,
    AlertTriangle, Clock, CheckCircle2, Ban, Calendar, RefreshCw, ListTodo,
    LayoutList, Trash2, CheckSquare, Square, ChevronDown, UserCircle, Tag,
    Bookmark, BookmarkPlus, Link2, ChevronRight, ArrowUp, ArrowDown, FileText
} from 'lucide-react';
import { authApi } from '../../services/api';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import { exportToCSV } from '../../utils/exportUtils';
import UserAvatar from '../ui/UserAvatar';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

export default function TaskListPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<TaskFilters>({});
    const [searchText, setSearchText] = useState('');
    const debouncedSearch = useDebouncedValue(searchText, 300);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [orgDepartments, setOrgDepartments] = useState<OrgDepartment[]>([]);
    const [companyPolicyCount, setCompanyPolicyCount] = useState(0);
    const [policyDrawer, setPolicyDrawer] = useState<{ open: boolean; scope?: 'COMPANY' | 'DEPARTMENT' | 'POST'; departmentId?: string; postId?: string; title?: string }>({ open: false });
    const [editDept, setEditDept] = useState<any>(null);
    const [editSection, setEditSection] = useState<any>(null);
    const [editPost, setEditPost] = useState<any>(null);
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

    // Collapsible groups & custom order
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [savedGroupOrder, setSavedGroupOrder] = useState<string[]>([]);

    // Load user preferences on mount
    useEffect(() => {
        userPreferencesApi.get().then((prefs: any) => {
            if (prefs?.task_group_order) setSavedGroupOrder(prefs.task_group_order);
        }).catch(() => {});
    }, []);

    function toggleGroup(name: string) {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });
    }

    function moveGroup(name: string, direction: 'up' | 'down') {
        setGroupedTasksOrder(prev => {
            const names = prev.map(g => g.name);
            const idx = names.indexOf(name);
            if (idx < 0) return prev;
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= names.length) return prev;
            const newOrder = [...prev];
            [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
            // Save to server
            const newNames = newOrder.map(g => g.name);
            setSavedGroupOrder(newNames);
            userPreferencesApi.save({ task_group_order: newNames }).catch(() => {});
            return newOrder;
        });
    }

    // Group tasks by assignee, respect saved order
    const [groupedTasksOrder, setGroupedTasksOrder] = useState<{ name: string; avatar?: string; tasks: Task[] }[]>([]);

    useEffect(() => {
        const map = new Map<string, { name: string; avatar?: string; tasks: Task[] }>();
        for (const task of tasks) {
            const key = task.assignee_name || 'Neasignat';
            let group = map.get(key);
            if (!group) {
                group = { name: key, avatar: task.assignee_avatar ?? undefined, tasks: [] };
                map.set(key, group);
            }
            group!.tasks.push(task);
        }
        // Sort tasks within each group by due_date
        for (const g of map.values()) {
            g.tasks.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        }
        // Apply saved order
        const ordered: typeof groupedTasksOrder = [];
        for (const name of savedGroupOrder) {
            const g = map.get(name);
            if (g) { ordered.push(g); map.delete(name); }
        }
        // Append remaining groups alphabetically (Neasignat last)
        const remaining = Array.from(map.values()).sort((a, b) => {
            if (a.name === 'Neasignat') return 1;
            if (b.name === 'Neasignat') return -1;
            return a.name.localeCompare(b.name);
        });
        ordered.push(...remaining);
        setGroupedTasksOrder(ordered);
    }, [tasks, savedGroupOrder]);

    // Status-based card background colors
    const statusCardStyle = (status: TaskStatus) => {
        switch (status) {
            case 'de_rezolvat': return 'bg-blue-500/8 border-blue-500/20';
            case 'in_realizare': return 'bg-yellow-500/8 border-yellow-500/20';
            case 'terminat': return 'bg-emerald-500/8 border-emerald-500/20';
            case 'blocat': return 'bg-red-500/8 border-red-500/20';
            default: return '';
        }
    };

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

    // Load org structure (departments → sections → posts)
    useEffect(() => {
        departmentsApi.list()
            .then(data => {
                setOrgDepartments(data.departments || []);
                setCompanyPolicyCount(data.company_policy_count || 0);
            })
            .catch(err => console.error('Failed to load departments:', err));
    }, []);

    useEffect(() => {
        const state = location.state;
        if (state?.openTaskId) {
            setSelectedTaskId(state.openTaskId);
            window.history.replaceState({}, document.title);
        }
        // Support email links: /tasks?openTaskId=xyz
        const urlParams = new URLSearchParams(window.location.search);
        const openTaskIdParam = urlParams.get('openTaskId');
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (openTaskIdParam && uuidRegex.test(openTaskIdParam)) {
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
        const scrollY = window.scrollY;
        const isInitialLoad = tasks.length === 0;
        try {
            if (isInitialLoad) setLoading(true);
            const result = await tasksApi.list({ ...filters, exclude_status: 'terminat' });
            setTasks(result.tasks);
            setTotal(result.total);
            // Restore scroll position after DOM update (only on reload, not initial)
            if (!isInitialLoad) {
                requestAnimationFrame(() => window.scrollTo(0, scrollY));
            }
        } catch (err) {
            showToast('Eroare la încărcarea sarcinilor', 'error');
        } finally {
            setLoading(false);
        }
    }, [filters, showToast]);

    // Auto-sync debounced search to filters
    useEffect(() => {
        setFilters(prev => {
            const newSearch = debouncedSearch || undefined;
            if (prev.search === newSearch) return prev;
            return { ...prev, search: newSearch };
        });
    }, [debouncedSearch]);

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
        const failed: string[] = [];
        for (const id of selectedIds) {
            try { await tasksApi.changeStatus(id, status); ok++; } catch {
                const t = tasks.find(t => t.id === id);
                failed.push(t?.title || id);
            }
        }
        if (failed.length > 0) {
            showToast(`${ok} reușit, ${failed.length} eșuat: ${failed.join(', ')}`, 'error');
        } else {
            showToast(`${ok} task → ${STATUSES[status].label}`);
        }
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
            showToast(`${ok} ${ok === 1 ? 'sarcină ștearsă' : 'sarcini șterse'}`);
        }
        setSelectedIds(new Set());
        loadTasks();
    }
    async function bulkAssign(userId: string | null) {
        setBulkAssignOpen(false);
        let ok = 0;
        const failed: string[] = [];
        for (const id of selectedIds) {
            try { await tasksApi.update(id, { assigned_to: userId }); ok++; } catch {
                const t = tasks.find(t => t.id === id);
                failed.push(t?.title || id);
            }
        }
        if (failed.length > 0) {
            showToast(`${ok} reușit, ${failed.length} eșuat: ${failed.join(', ')}`, 'error');
        } else {
            showToast(userId ? `${ok} task asignat` : `${ok} task neasignat`);
        }
        setSelectedIds(new Set());
        loadTasks();
    }

    async function changeDepartment(taskId: string, dept: Department) {
        setDeptDropdownId(null);
        try {
            await tasksApi.update(taskId, { department_label: dept });
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, department_label: dept } : t));
            showToast(`Departament actualizat`);
        } catch {
            showToast('Eroare la actualizare', 'error');
        }
    }

    async function bulkChangeDept(dept: Department) {
        setBulkDeptOpen(false);
        let ok = 0;
        const failed: string[] = [];
        for (const id of selectedIds) {
            try { await tasksApi.update(id, { department_label: dept }); ok++; } catch {
                const t = tasks.find(t => t.id === id);
                failed.push(t?.title || id);
            }
        }
        if (failed.length > 0) {
            showToast(`${ok} reușit, ${failed.length} eșuat: ${failed.join(', ')}`, 'error');
        } else {
            showToast(`${ok} task → ${DEPARTMENTS[dept].label}`);
        }
        setSelectedIds(new Set());
        loadTasks();
    }

    return (
        <div className="p-4 md:p-6 animate-fade-in max-w-[1350px] mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Sarcini</h1>
                    <p className="text-navy-400 text-sm mt-1">{total} {total === 1 ? 'sarcină în total' : 'sarcini în total'}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
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
                        Sarcină nouă
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

            {/* Task List — My Tasks flat list OR Org Structure Accordion */}
            {loading ? (
                <SkeletonTaskList rows={6} />
            ) : tasks.length === 0 && (filters.my_tasks === 'true' || orgDepartments.length === 0) ? (
                <div className="text-center py-20">
                    <ListTodo className="w-16 h-16 text-navy-700 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-navy-400 mb-1">
                        {filters.my_tasks === 'true' ? 'Nu ai sarcini active' : 'Nicio sarcină găsită'}
                    </h3>
                    <p className="text-sm text-navy-500 mb-4">
                        {filters.my_tasks === 'true' ? 'Sarcinile tale vor apărea aici.' : 'Creează primul tău task sau schimbă filtrele.'}
                    </p>
                    {filters.my_tasks !== 'true' && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm transition-colors"
                        >
                            <Plus className="w-4 h-4 inline mr-1" /> Creează sarcină
                        </button>
                    )}
                </div>
            ) : filters.my_tasks === 'true' ? (
                /* ===== MY TASKS — FLAT LIST VIEW ===== */
                <div className="border border-navy-700/50 rounded-xl overflow-hidden">
                    <table className="w-full text-sm table-fixed">
                        <thead>
                            <tr className="bg-navy-800/80">
                                <th className="text-left px-4 py-3 font-semibold text-navy-300 text-xs w-[35%]">Sarcină</th>
                                <th className="text-left px-4 py-3 font-semibold text-navy-300 text-xs hidden md:table-cell w-[14%]">Departament</th>
                                <th className="text-left px-4 py-3 font-semibold text-navy-300 text-xs hidden lg:table-cell w-[13%]">Subdepartament</th>
                                <th className="text-left px-4 py-3 font-semibold text-navy-300 text-xs hidden lg:table-cell w-[16%]">Post</th>
                                <th className="text-left px-4 py-3 font-semibold text-navy-300 text-xs w-[12%]">Termen</th>
                                <th className="text-left px-4 py-3 font-semibold text-navy-300 text-xs w-[10%]">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tasks.map(task => {
                                const dueDateStatus = getDueDateStatus(task.due_date);
                                const daysOverdue = getDaysOverdue(task.due_date);
                                const daysUntil = getDaysUntil(task.due_date);
                                const isOverdue = daysOverdue > 0 && task.status !== 'terminat';
                                const isDueSoon = !isOverdue && daysUntil !== null && daysUntil <= 3 && task.status !== 'terminat';
                                return (
                                    <tr
                                        key={task.id}
                                        onClick={() => setSelectedTaskId(task.id)}
                                        className={`border-t border-navy-700/30 cursor-pointer transition-colors hover:bg-navy-800/40 ${
                                            isOverdue ? 'bg-red-500/5' : isDueSoon ? 'bg-amber-500/5' : ''
                                        }`}
                                    >
                                        <td className="px-4 py-3 w-[35%]">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUSES[task.status]?.color }} />
                                                <span className="font-medium text-white truncate">{task.title}</span>
                                            </div>
                                            <div className="md:hidden mt-1 text-[10px] text-navy-400">
                                                {task.assigned_department_name || DEPARTMENTS[task.department_label]?.label || '—'}
                                                {task.assigned_section_name && ` · ${task.assigned_section_name}`}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-navy-300 text-xs hidden md:table-cell w-[14%] truncate">
                                            {task.assigned_department_name || DEPARTMENTS[task.department_label]?.label || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-navy-400 text-xs hidden lg:table-cell w-[13%] truncate">
                                            {task.assigned_section_name || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-navy-400 text-xs hidden lg:table-cell w-[16%] truncate">
                                            {task.assigned_post_name || '—'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap w-[12%]">
                                            <span className={`text-xs font-medium ${
                                                isOverdue ? 'text-red-400' : isDueSoon ? 'text-amber-400' : 'text-navy-300'
                                            }`}>
                                                {formatDate(task.due_date)}
                                                {isOverdue && <span className="ml-1 text-[10px]">(-{daysOverdue}z)</span>}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                                style={{
                                                    backgroundColor: `${STATUSES[task.status]?.color}20`,
                                                    color: STATUSES[task.status]?.color
                                                }}
                                            >
                                                {STATUSES[task.status]?.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : orgDepartments.length > 0 ? (
                /* ===== ORG STRUCTURE ACCORDION VIEW ===== */
                <div className="space-y-3">
                    {/* Company-level policies link — always visible */}
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-navy-700/30 bg-navy-800/20">
                        <div className="flex items-start gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0">
                                <p className="text-sm text-navy-300 leading-tight">
                                    Directive la nivel de companie {companyPolicyCount > 0 && `(${companyPolicyCount})`}
                                </p>
                                <p className="text-[11px] text-navy-500 mt-0.5">
                                    Politici și reguli care se aplică întregii firme.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setPolicyDrawer({ open: true, scope: 'COMPANY', title: 'Directive la nivel de companie' })}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0 ml-3"
                        >
                            Deschide
                        </button>
                    </div>

                    {orgDepartments.map((dept, idx) => (
                        <OrgDepartmentAccordion
                            key={dept.id}
                            department={dept}
                            tasks={tasks}
                            onTaskClick={(id) => setSelectedTaskId(id)}
                            darkMode={true}
                            defaultExpanded={idx === 0}
                            isSuperAdmin={user?.role === 'superadmin'}
                            onEditDepartment={(d) => setEditDept(d)}
                            onEditSection={(s) => setEditSection(s)}
                            onEditPost={(p) => setEditPost(p)}
                            onTaskStatusChange={loadTasks}
                            onPolicyClick={(scope, id) => setPolicyDrawer({
                                open: true,
                                scope: scope as any,
                                departmentId: scope === 'DEPARTMENT' ? id : undefined,
                                postId: scope === 'POST' ? id : undefined,
                                title: `Directive — ${dept.name}`
                            })}
                        />
                    ))}
                </div>
            ) : (
                /* Fallback: simple task list if no org structure loaded yet */
                <div className="space-y-2">
                    {tasks.map(task => (
                        <button
                            key={task.id}
                            onClick={() => setSelectedTaskId(task.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-navy-700/30 bg-navy-800/20 hover:bg-navy-800/40 text-left transition-all"
                        >
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUSES[task.status]?.color }} />
                            <span className="flex-1 text-sm truncate">{task.title}</span>
                            <span className="text-xs text-navy-500">{task.due_date}</span>
                        </button>
                    ))}
                </div>
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
                                        <UserAvatar
                                            name={u.display_name || u.email}
                                            avatarUrl={u.avatar_url}
                                            size="xs"
                                        />
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
                            Ești sigur că vrei să ștergi <strong className="text-white">{selectedIds.size} sarcini</strong>?
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
                        // Refresh org structure too — a new post (with task_count) may have been created
                        departmentsApi.list().then(data => {
                            setOrgDepartments(data.departments || []);
                            setCompanyPolicyCount(data.company_policy_count || 0);
                        }).catch(() => {});
                        showToast('Sarcină creată cu succes!');
                    }}
                />
            )}

            {/* Policy Drawer */}
            <PolicyDrawer
                open={policyDrawer.open}
                onClose={() => setPolicyDrawer({ open: false })}
                scope={policyDrawer.scope}
                departmentId={policyDrawer.departmentId}
                postId={policyDrawer.postId}
                title={policyDrawer.title}
                darkMode={true}
            />

            {/* Superadmin Edit Modals */}
            {editDept && (
                <DepartmentEditModal
                    department={editDept}
                    onClose={() => setEditDept(null)}
                    onSaved={() => {
                        departmentsApi.list().then(data => {
                            setOrgDepartments(data.departments || []);
                            setCompanyPolicyCount(data.company_policy_count || 0);
                        });
                        loadTasks();
                    }}
                />
            )}
            {editSection && (
                <SectionEditModal
                    section={editSection}
                    onClose={() => setEditSection(null)}
                    onSaved={() => {
                        departmentsApi.list().then(data => {
                            setOrgDepartments(data.departments || []);
                        });
                    }}
                />
            )}
            {editPost && (
                <PostEditModal
                    post={editPost}
                    onClose={() => setEditPost(null)}
                    onSaved={() => {
                        departmentsApi.list().then(data => {
                            setOrgDepartments(data.departments || []);
                        });
                        loadTasks();
                    }}
                />
            )}
        </div>
    );
}
