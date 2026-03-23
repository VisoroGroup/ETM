import React, { useState, useEffect, useCallback } from 'react';
import { activityFeedApi, authApi } from '../../services/api';
import { DEPARTMENTS, Department } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { timeAgo } from '../../utils/helpers';
import {
    Activity, Filter, Loader2, User as UserIcon, Tag, ChevronDown,
    CheckCircle2, ArrowRight, MessageSquare, Paperclip, Calendar, RefreshCw,
    AlertTriangle, Banknote
} from 'lucide-react';

const ACTION_LABELS: Record<string, string> = {
    created: 'a creat',
    status_changed: 'a schimbat statusul',
    due_date_changed: 'a schimbat data limită',
    comment_added: 'a adăugat un comentariu',
    subtask_added: 'a adăugat un subtask',
    subtask_completed: 'a completat un subtask',
    subtask_assigned: 'a asignat un subtask',
    attachment_added: 'a atașat un fișier',
    label_changed: 'a schimbat departamentul',
    recurring_created: 'a setat recurența',
    marked_paid: 'a marcat ca plătit',
    date_changed: 'a schimbat data scadentă',
    category_changed: 'a schimbat categoria',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
    created: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
    status_changed: <ArrowRight className="w-3.5 h-3.5 text-blue-400" />,
    due_date_changed: <Calendar className="w-3.5 h-3.5 text-amber-400" />,
    comment_added: <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />,
    subtask_added: <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />,
    subtask_completed: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
    attachment_added: <Paperclip className="w-3.5 h-3.5 text-navy-300" />,
    marked_paid: <Banknote className="w-3.5 h-3.5 text-green-400" />,
};

const DEPT_KEYS = Object.keys(DEPARTMENTS) as Department[];
const ACTION_TYPES = [
    'created', 'status_changed', 'due_date_changed', 'comment_added',
    'subtask_added', 'subtask_completed', 'subtask_assigned',
    'attachment_added', 'label_changed', 'recurring_created',
    'marked_paid', 'date_changed',
];

interface FeedItem {
    id: string;
    task_id: string;
    user_id: string;
    action_type: string;
    details: any;
    created_at: string;
    user_name: string;
    avatar_url: string | null;
    task_title: string;
    department_label: string | null;
    source_type: 'task' | 'payment';
}

export default function ActivityFeedPage() {
    const { user } = useAuth();
    const [items, setItems] = useState<FeedItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [users, setUsers] = useState<any[]>([]);

    // Filters
    const [filterUser, setFilterUser] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterAction, setFilterAction] = useState('');

    useEffect(() => { authApi.users().then(setUsers).catch(() => {}); }, []);

    const loadFeed = useCallback(async (pageNum: number, append = false) => {
        if (append) setLoadingMore(true);
        else setLoading(true);

        try {
            const params: any = { page: pageNum, limit: 50 };
            if (filterUser) params.user_id = filterUser;
            if (filterDept) params.department = filterDept;
            if (filterAction) params.action_type = filterAction;

            const data = await activityFeedApi.list(params);
            if (append) {
                setItems(prev => [...prev, ...data.items]);
            } else {
                setItems(data.items);
            }
            setTotal(data.total);
            setPage(pageNum);
        } catch (err) {
            console.error('Feed load error:', err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filterUser, filterDept, filterAction]);

    useEffect(() => { loadFeed(1); }, [loadFeed]);

    const hasMore = items.length < total;

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
                <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">Activitate</h1>
                        <p className="text-navy-400 text-xs md:text-sm mt-0.5">{total} activități</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadFeed(1)}
                        className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 md:py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-xs md:text-sm text-navy-300 hover:bg-navy-700/50 transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4" /> Reîncarcă
                    </button>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 md:py-2 border rounded-lg text-xs md:text-sm transition-colors ${
                            showFilters || filterUser || filterDept || filterAction
                                ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                                : 'bg-navy-800/50 border-navy-700/50 text-navy-300 hover:bg-navy-700/50'
                        }`}
                    >
                        <Filter className="w-3.5 h-3.5 md:w-4 md:h-4" /> Filtre
                    </button>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="mb-4 bg-navy-900/50 border border-navy-700/50 rounded-xl p-3 md:p-4 animate-slide-up grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label className="text-[10px] md:text-xs text-navy-400 mb-1 block">Utilizator</label>
                        <select
                            value={filterUser}
                            onChange={e => setFilterUser(e.target.value)}
                            className="w-full bg-navy-800 border border-navy-600 rounded px-2 py-1.5 text-xs text-white outline-none"
                        >
                            <option value="">Toți</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] md:text-xs text-navy-400 mb-1 block">Departament</label>
                        <select
                            value={filterDept}
                            onChange={e => setFilterDept(e.target.value)}
                            className="w-full bg-navy-800 border border-navy-600 rounded px-2 py-1.5 text-xs text-white outline-none"
                        >
                            <option value="">Toate</option>
                            {DEPT_KEYS.map(d => <option key={d} value={d}>{DEPARTMENTS[d].label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] md:text-xs text-navy-400 mb-1 block">Tip acțiune</label>
                        <select
                            value={filterAction}
                            onChange={e => setFilterAction(e.target.value)}
                            className="w-full bg-navy-800 border border-navy-600 rounded px-2 py-1.5 text-xs text-white outline-none"
                        >
                            <option value="">Toate</option>
                            {ACTION_TYPES.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
                        </select>
                    </div>
                    {(filterUser || filterDept || filterAction) && (
                        <div className="flex items-end sm:col-span-3">
                            <button
                                onClick={() => { setFilterUser(''); setFilterDept(''); setFilterAction(''); }}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1.5"
                            >
                                Resetează filtrele
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Timeline */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-16">
                    <Activity className="w-12 h-12 text-navy-700 mx-auto mb-3" />
                    <p className="text-navy-400 text-sm">Nicio activitate găsită</p>
                </div>
            ) : (
                <div className="space-y-0">
                    {items.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="flex gap-3 py-3 border-b border-navy-800/50 hover:bg-navy-800/20 transition-colors rounded-lg px-2 -mx-2">
                            {/* Avatar */}
                            <div className="flex-shrink-0 mt-0.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-xs font-bold">
                                    {item.user_name?.charAt(0).toUpperCase() || '?'}
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm">
                                    <span className="font-medium text-white">{item.user_name}</span>
                                    {' '}
                                    <span className="text-navy-400">{ACTION_LABELS[item.action_type] || item.action_type}</span>
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="inline-flex items-center gap-1 text-xs text-navy-300">
                                        {ACTION_ICONS[item.action_type] || <Activity className="w-3 h-3 text-navy-500" />}
                                        {item.source_type === 'payment' ? '💰' : ''}
                                        <span className="truncate max-w-[250px]">{item.task_title || '—'}</span>
                                    </span>
                                    {item.department_label && (
                                        <span
                                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                            style={{
                                                background: `${DEPARTMENTS[item.department_label as Department]?.color}20`,
                                                color: DEPARTMENTS[item.department_label as Department]?.color,
                                            }}
                                        >
                                            {DEPARTMENTS[item.department_label as Department]?.label}
                                        </span>
                                    )}
                                </div>
                                {/* Show details if present */}
                                {item.details && typeof item.details === 'object' && item.details.reason && (
                                    <p className="text-xs text-navy-500 mt-1 italic">„{item.details.reason}"</p>
                                )}
                            </div>

                            {/* Timestamp */}
                            <div className="flex-shrink-0">
                                <span className="text-xs text-navy-500">{timeAgo(item.created_at)}</span>
                            </div>
                        </div>
                    ))}

                    {/* Load more */}
                    {hasMore && (
                        <div className="flex justify-center pt-6">
                            <button
                                onClick={() => loadFeed(page + 1, true)}
                                disabled={loadingMore}
                                className="flex items-center gap-2 px-4 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-navy-300 hover:bg-navy-700/50 transition-colors disabled:opacity-50"
                            >
                                {loadingMore ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Se încarcă...</>
                                ) : (
                                    <>Mai multe ({items.length}/{total})</>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
