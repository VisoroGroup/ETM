import React, { useEffect, useState } from 'react';
import { dayViewApi } from '../../services/api';
import { CalendarRange, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import TaskDrawer from '../tasks/TaskDrawer';
import { useToast } from '../../hooks/useToast';
import { useCompany } from '../../hooks/useCompany';
import { useTranslation, TFunction } from '../../i18n/I18nContext';

interface Task {
    id: string;
    title: string;
    status: string;
    department_label: string;
    is_recurring?: boolean;
    assigned_scope?: 'post' | 'section' | 'department' | null;
    assigned_post_name?: string | null;
    assigned_section_name?: string | null;
    assigned_department_name?: string | null;
}

/**
 * Build the scope label shown above each task cell, so people learn to
 * think in terms of posts/sections/departments, not individuals.
 *   post scope     → just the post name (e.g. "Vânzări")
 *   section scope  → section name + " (conducător)" — it's a leadership task
 *   dept scope     → department name + " (conducător)" — same
 */
function scopeLabel(task: Task, t: TFunction): string {
    if (task.assigned_scope === 'post') return task.assigned_post_name || '—';
    if (task.assigned_scope === 'section') return `${task.assigned_section_name || '—'} (${t('week_view.leader_suffix')})`;
    if (task.assigned_scope === 'department') return `${task.assigned_department_name || '—'} (${t('week_view.leader_suffix')})`;
    return '—';
}
interface DayUser {
    id: string;
    display_name: string;
    email: string;
    avatar_url: string | null;
    tasks: Task[];
}
interface Day {
    date: string;
    users: DayUser[];
}
interface WeekResponse {
    start: string;
    end: string;
    days: Day[];
}

const STATUS_COLOR: Record<string, string> = {
    de_rezolvat: '#3b82f6',
    in_realizare: '#f59e0b',
    blocat: '#ef4444',
    terminat: '#10b981',
};
function statusLabel(status: string, t: TFunction): string {
    // Reuse existing task_status namespace; falls back to the raw key for unknowns.
    const translated = t(`task_status.${status}`);
    return translated === `task_status.${status}` ? status : translated;
}

// Local-date ISO string (YYYY-MM-DD). We deliberately avoid toISOString() because
// it converts to UTC first — in timezones east of UTC (e.g. Europe/Bucharest, +3)
// Monday 00:00 local becomes Sunday 21:00 UTC, and toISOString().split('T')[0]
// then returns the wrong date. The week view would render days shifted by one.
function toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Given any date, return the Monday of that ISO week
function mondayOf(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const diff = (day + 6) % 7; // days to subtract to reach Monday
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

export default function WeekViewPage() {
    const [start, setStart] = useState(() => mondayOf(new Date()));
    const [week, setWeek] = useState<WeekResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [mode, setMode] = useState<'by-user' | 'by-day'>('by-user');
    const { showToast } = useToast();
    const { activeCompany } = useCompany();
    const { t } = useTranslation();
    const dateLocale = activeCompany?.language === 'hu' ? 'hu-HU' : 'ro-RO';
    // Build day labels through Intl for proper locale capitalization & inflection.
    const DAY_LABELS = React.useMemo(() => {
        const fmt = new Intl.DateTimeFormat(dateLocale, { weekday: 'long' });
        // Pick a reference Monday (any Monday works) — Jan 5, 2026 is a Monday.
        const ref = new Date(2026, 0, 5);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(ref);
            d.setDate(ref.getDate() + i);
            const s = fmt.format(d);
            return s.charAt(0).toLocaleUpperCase(dateLocale) + s.slice(1);
        });
    }, [dateLocale]);
    // 'full' (Visoro) keeps the post/section/department scope label above each task.
    // Other templates render a flat per-user grid with just the task title.
    const isFull = activeCompany?.template_type === 'full';

    useEffect(() => {
        setLoading(true);
        dayViewApi.getWeek(toIsoDate(start))
            .then((w: WeekResponse) => setWeek(w))
            .catch(() => showToast(t('week_view.load_error'), 'error'))
            .finally(() => setLoading(false));
    }, [start]);

    function shiftWeek(deltaDays: number) {
        const d = new Date(start);
        d.setDate(d.getDate() + deltaDays);
        setStart(mondayOf(d));
    }

    function jumpToThisWeek() {
        setStart(mondayOf(new Date()));
    }

    // Build aggregated view: users along one axis, days along the other
    const allUsers = React.useMemo(() => {
        const m = new Map<string, DayUser>();
        if (!week) return [];
        for (const day of week.days) {
            for (const u of day.users) {
                if (!m.has(u.id)) m.set(u.id, { ...u, tasks: [] });
            }
        }
        return Array.from(m.values()).sort((a, b) => a.display_name.localeCompare(b.display_name));
    }, [week]);

    // user_id+date → tasks
    const tasksGrid = React.useMemo(() => {
        const grid = new Map<string, Task[]>();
        if (!week) return grid;
        for (const day of week.days) {
            for (const u of day.users) {
                grid.set(`${u.id}__${day.date}`, u.tasks);
            }
        }
        return grid;
    }, [week]);

    const today = toIsoDate(new Date());

    return (
        <div className="p-4 md:p-6 animate-fade-in max-w-full mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <CalendarRange className="w-6 h-6 text-cyan-400" />
                        {t('week_view.title')}
                    </h1>
                    <p className="text-navy-400 text-sm mt-1">
                        {week ? `${week.start} — ${week.end}` : t('week_view.loading')}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Mode toggle */}
                    <div className="flex items-center bg-navy-800/50 border border-navy-700/50 rounded-lg p-0.5">
                        <button
                            onClick={() => setMode('by-user')}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                mode === 'by-user' ? 'bg-navy-600 text-white' : 'text-navy-400 hover:text-white'
                            }`}
                        >
                            {t('week_view.mode_by_user')}
                        </button>
                        <button
                            onClick={() => setMode('by-day')}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                mode === 'by-day' ? 'bg-navy-600 text-white' : 'text-navy-400 hover:text-white'
                            }`}
                        >
                            {t('week_view.mode_by_day')}
                        </button>
                    </div>
                    {/* Nav */}
                    <button onClick={() => shiftWeek(-7)} className="flex items-center gap-1 px-2.5 py-1.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-xs hover:bg-navy-700/50">
                        <ChevronLeft className="w-3 h-3" /> {t('week_view.prev_week')}
                    </button>
                    <button onClick={jumpToThisWeek} className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/40 rounded-lg text-xs font-medium text-blue-300 hover:bg-blue-500/30">
                        {t('week_view.this_week')}
                    </button>
                    <button onClick={() => shiftWeek(7)} className="flex items-center gap-1 px-2.5 py-1.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-xs hover:bg-navy-700/50">
                        {t('week_view.next_week')} <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-16 text-navy-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('week_view.loading')}
                </div>
            )}

            {!loading && week && mode === 'by-user' && (
                <div className="overflow-x-auto border border-navy-700/50 rounded-xl bg-navy-900/30">
                    <table className="w-full text-sm min-w-[1000px]">
                        <thead>
                            <tr className="bg-navy-800/60 border-b border-navy-700/50">
                                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-navy-400 font-semibold w-[180px]">{t('week_view.col_user')}</th>
                                {week.days.map((d, i) => (
                                    <th
                                        key={d.date}
                                        className={`text-left px-3 py-2 text-[10px] uppercase tracking-wider text-navy-400 font-semibold ${
                                            d.date === today ? 'bg-blue-500/10 text-blue-300' : ''
                                        }`}
                                    >
                                        {DAY_LABELS[i]} <span className="text-navy-500 font-normal normal-case">{d.date.slice(5)}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {allUsers.length === 0 && (
                                <tr>
                                    <td colSpan={week.days.length + 1} className="px-4 py-8 text-center text-xs text-navy-400">
                                        {t('week_view.empty_state')}
                                    </td>
                                </tr>
                            )}
                            {allUsers.map(u => (
                                <tr key={u.id} className="border-t border-navy-700/30">
                                    <td className="px-3 py-2 align-top">
                                        <div className="flex items-center gap-2">
                                            <UserAvatar name={u.display_name} avatarUrl={u.avatar_url} size="xs" />
                                            <span className="text-xs font-medium truncate">{u.display_name}</span>
                                        </div>
                                    </td>
                                    {week.days.map(d => {
                                        const tasks = tasksGrid.get(`${u.id}__${d.date}`) || [];
                                        return (
                                            <td
                                                key={d.date}
                                                className={`px-2 py-1.5 align-top border-l border-navy-800/40 ${
                                                    d.date === today ? 'bg-blue-500/5' : ''
                                                }`}
                                            >
                                                {tasks.length === 0 ? (
                                                    <span className="text-[10px] text-navy-600">—</span>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {tasks.slice(0, 4).map(tk => (
                                                            <button
                                                                key={tk.id}
                                                                onClick={() => setSelectedTaskId(tk.id)}
                                                                className="w-full text-left flex flex-col gap-0.5 px-1.5 py-1 rounded bg-navy-800/50 hover:bg-navy-700/70 transition-colors"
                                                                title={isFull ? `${scopeLabel(tk, t)} · ${statusLabel(tk.status, t)} — ${tk.title}` : `${statusLabel(tk.status, t)} — ${tk.title}`}
                                                            >
                                                                {/* Post / scope name — above, smaller but prominent in cyan.
                                                                    Only shown for 'full' template; other templates have no org structure. */}
                                                                {isFull && (
                                                                    <span className="text-[9px] text-cyan-300 font-semibold uppercase tracking-wide truncate leading-none">
                                                                        {scopeLabel(tk, t)}
                                                                    </span>
                                                                )}
                                                                {/* Task title — below */}
                                                                <div className="flex items-center gap-1">
                                                                    <span
                                                                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                                        style={{ backgroundColor: STATUS_COLOR[tk.status] || '#9ca3af' }}
                                                                    />
                                                                    {tk.is_recurring && (
                                                                        <RefreshCw className="w-2.5 h-2.5 text-cyan-400 flex-shrink-0" />
                                                                    )}
                                                                    <span className="text-[11px] truncate">{tk.title}</span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                        {tasks.length > 4 && (
                                                            <p className="text-[9px] text-navy-500 pl-2">{t('week_view.more_tasks', { count: tasks.length - 4 })}</p>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {!loading && week && mode === 'by-day' && (
                <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                    {week.days.map((d, i) => {
                        const totalTasks = d.users.reduce((n, u) => n + u.tasks.length, 0);
                        return (
                            <div
                                key={d.date}
                                className={`rounded-xl border p-3 min-h-[200px] ${
                                    d.date === today
                                        ? 'border-blue-500/40 bg-blue-500/5'
                                        : 'border-navy-700/50 bg-navy-900/30'
                                }`}
                            >
                                <div className="flex items-baseline justify-between mb-2">
                                    <span className={`text-xs font-semibold ${d.date === today ? 'text-blue-300' : 'text-navy-300'}`}>
                                        {DAY_LABELS[i]}
                                    </span>
                                    <span className="text-[10px] text-navy-500">{d.date.slice(5)}</span>
                                </div>
                                <p className="text-[10px] text-navy-500 mb-2">{t(totalTasks === 1 ? 'week_view.task_count_one' : 'week_view.task_count_many', { count: totalTasks })}</p>
                                <div className="space-y-1.5">
                                    {d.users.flatMap(u => u.tasks.map(tk => ({ ...tk, user: u }))).slice(0, 20).map(tk => (
                                        <button
                                            key={`${tk.user.id}-${tk.id}`}
                                            onClick={() => setSelectedTaskId(tk.id)}
                                            className="w-full text-left flex flex-col gap-0.5 px-1.5 py-1 rounded bg-navy-800/50 hover:bg-navy-700/70 transition-colors"
                                            title={isFull ? `${scopeLabel(tk, t)} — ${tk.title}` : tk.title}
                                        >
                                            {/* Post / scope above — only for 'full' template. */}
                                            {isFull && (
                                                <span className="text-[9px] text-cyan-300 font-semibold uppercase tracking-wide truncate leading-none">
                                                    {scopeLabel(tk, t)}
                                                </span>
                                            )}
                                            <div className="flex items-start gap-1.5">
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1"
                                                    style={{ backgroundColor: STATUS_COLOR[tk.status] || '#9ca3af' }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] truncate leading-tight flex items-center gap-1">
                                                        {tk.is_recurring && <RefreshCw className="w-2.5 h-2.5 text-cyan-400 flex-shrink-0" />}
                                                        <span className="truncate">{tk.title}</span>
                                                    </p>
                                                    {/* Responsible user — smaller, below title */}
                                                    <p className="text-[9px] text-navy-500 truncate">{tk.user.display_name}</p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedTaskId && (
                <TaskDrawer
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                    onUpdate={() => {
                        // refresh current week after any edit
                        dayViewApi.getWeek(toIsoDate(start)).then(setWeek).catch(() => {});
                    }}
                />
            )}
        </div>
    );
}
