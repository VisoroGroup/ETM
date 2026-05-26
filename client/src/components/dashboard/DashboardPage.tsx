import React, { lazy, Suspense, useEffect, useState } from 'react';
import { dashboardApi, tasksApi, alertsApi } from '../../services/api';
import { DashboardStats, DashboardCharts, Task, TaskStatus, STATUSES, DEPARTMENTS } from '../../types';
import { getDueDateStatus, formatDate, getDaysOverdue, getDaysUntil } from '../../utils/helpers';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCompany } from '../../hooks/useCompany';
import { useTranslation } from '../../i18n/I18nContext';
import {
    AlertTriangle, Ban, CheckCircle2, Activity,
    ChevronRight, ChevronDown, Loader2, CalendarDays, List, Bell, FileDown, Settings, UserCircle, Briefcase, RefreshCw, Users
} from 'lucide-react';
import { timeAgo } from '../../utils/helpers';
import InlineStatusPill from '../tasks/InlineStatusPill';
import type { WidgetConfig } from '../../types';

// Lazy-load the heavy children (audit-3 H30). These three pull in
// recharts, react-big-calendar, @hello-pangea/dnd, and react-easy-crop —
// roughly 600 KB combined — into the main bundle even when the user
// never opens the calendar/customizer/drawer. Lazy-loading drops the
// dashboard's first-paint cost dramatically.
const CalendarView = lazy(() => import('./CalendarView'));
const ReportModal = lazy(() => import('./ReportModal'));
const DashboardCustomizer = lazy(() => import('./DashboardCustomizer'));
const TaskDrawer = lazy(() => import('../tasks/TaskDrawer'));

function LazyLoadFallback() {
    return (
        <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        </div>
    );
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [charts, setCharts] = useState<DashboardCharts | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCalendar, setShowCalendar] = useState(false);
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
    const [showReport, setShowReport] = useState(false);
    const [widgetLayout, setWidgetLayout] = useState<WidgetConfig[]>([]);
    const [showCustomizer, setShowCustomizer] = useState(false);
    const [collapsedStatuses, setCollapsedStatuses] = useState<Set<string>>(new Set());
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const navigate = useNavigate();
    const { user } = useAuth();
    const { activeCompany } = useCompany();
    const { t } = useTranslation();

    // Admins/superadmins also see "all tasks grouped by user" — for that we
    // need every open task in the company, not just the ones the current user
    // is involved in. Regular users + managers keep the scoped `my_tasks`
    // call so the page stays lightweight for them.
    const isOverseer = user?.role === 'superadmin' || user?.role === 'admin';

    useEffect(() => {
        // Skip until we know which company to query — the X-Active-Company
        // header would otherwise be missing and the API would 400.
        // If the user belongs to NO companies, drop the spinner so the page
        // shows an empty/no-access state instead of hanging on Loader2 forever.
        if (!activeCompany) {
            setLoading(false);
            return;
        }
        let cancelled = false;

        async function loadDashboard() {
            try {
                setLoading(true);
                const taskParams = isOverseer
                    ? { exclude_status: 'terminat', limit: 1000 }
                    : { my_tasks: 'true', exclude_status: 'terminat', limit: 500 };
                const [s, c, tasks, alerts, prefs] = await Promise.all([
                    dashboardApi.stats(),
                    dashboardApi.charts(),
                    tasksApi.list(taskParams),
                    dashboardApi.activeAlerts().catch(() => []),
                    dashboardApi.getPreferences().catch(() => []),
                ]);
                if (cancelled) return;
                setStats(s);
                setCharts(c);
                setAllTasks(tasks.tasks || tasks);
                setActiveAlerts(alerts);
                setWidgetLayout(prefs);
            } catch (err) {
                if (cancelled) return;
                console.error('Dashboard load error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadDashboard();
        return () => { cancelled = true; };
    }, [activeCompany?.id, isOverseer]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
        );
    }

    // Stat card color logic: if the "bad news" card shows 0, use a neutral color
    // (a red "0 Depășite" or orange "0 Blocate" wrongly screams for attention)
    const overdueColor = (stats?.overdue || 0) === 0
        ? { bg: 'from-navy-600 to-navy-700', text: 'text-navy-400' }
        : { bg: 'from-red-500 to-red-600', text: 'text-red-400' };

    const blockedColor = (stats?.blocked || 0) === 0
        ? { bg: 'from-navy-600 to-navy-700', text: 'text-navy-400' }
        : { bg: 'from-orange-500 to-orange-600', text: 'text-orange-400' };

    const statCards = [
        {
            label: t('dashboard.stat_active'), value: stats?.active || 0,
            icon: Activity, color: 'from-blue-500 to-blue-600', textColor: 'text-blue-400',
            onClick: () => navigate('/tasks')
        },
        {
            label: t('dashboard.stat_overdue'), value: stats?.overdue || 0,
            icon: AlertTriangle, color: overdueColor.bg, textColor: overdueColor.text,
            onClick: () => navigate('/tasks', { state: { filter: 'overdue' } })
        },
        {
            label: t('dashboard.stat_blocked'), value: stats?.blocked || 0,
            icon: Ban, color: blockedColor.bg, textColor: blockedColor.text,
            onClick: () => navigate('/tasks', { state: { filter: 'blocat' } })
        },
        {
            label: t('dashboard.stat_completed_this_month'), value: stats?.completed_this_month || 0,
            icon: CheckCircle2, color: 'from-green-500 to-green-600', textColor: 'text-green-400',
            onClick: undefined
        },
    ];

    // Widget visibility helper
    const isVisible = (widgetId: string) => {
        if (widgetLayout.length === 0) return true;
        const w = widgetLayout.find(w => w.widget_id === widgetId);
        return w ? w.visible : true;
    };

    // MY TASKS: tasks assigned to current user (I'm responsible)
    const myAssignedTasks = allTasks.filter(t => t.assigned_to === user?.id && t.status !== 'terminat');

    // CREATED BY ME: tasks I created but someone else is responsible
    const myCreatedTasks = allTasks.filter(t => t.created_by === user?.id && t.assigned_to !== user?.id && t.status !== 'terminat');

    // ALL TASKS PER USER (overseer only): group every open task by assignee
    // so admins can see the full org-wide workload at a glance. Tasks I'm
    // already personally involved in still appear here under their owner,
    // because the goal is full visibility into who's working on what.
    type UserBucket = { userId: string | null; userName: string; tasks: Task[] };
    const tasksByUser: UserBucket[] = (() => {
        if (!isOverseer) return [];
        const open = allTasks.filter(task => task.status !== 'terminat');
        const buckets = new Map<string, UserBucket>();
        const unassignedLabel = t('dashboard.unassigned');
        for (const task of open) {
            const key = task.assigned_to || '__unassigned__';
            const name = task.assigned_to
                ? (task.assignee_name || task.assignee_email || '—')
                : unassignedLabel;
            if (!buckets.has(key)) {
                buckets.set(key, { userId: task.assigned_to, userName: name, tasks: [] });
            }
            buckets.get(key)!.tasks.push(task);
        }
        return Array.from(buckets.values()).sort((a, b) => {
            // Unassigned bucket goes last; everyone else alphabetical
            if (a.userId === null) return 1;
            if (b.userId === null) return -1;
            return a.userName.localeCompare(b.userName, 'hu');
        });
    })();

    // Group tasks by status
    const statusOrder: TaskStatus[] = ['de_rezolvat', 'in_realizare', 'blocat', 'terminat'];
    const groupByStatus = (tasks: Task[]) => {
        const groups: { status: TaskStatus; label: string; color: string; tasks: Task[] }[] = [];
        for (const s of statusOrder) {
            const matching = tasks.filter(t => t.status === s);
            if (matching.length > 0) {
                // Sort by due date (soonest first)
                matching.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
                groups.push({
                    status: s,
                    label: STATUSES[s]?.label || s,
                    color: STATUSES[s]?.color || '#999',
                    tasks: matching
                });
            }
        }
        return groups;
    };

    const toggleStatusCollapse = (key: string) => {
        setCollapsedStatuses(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Hungary/Neo Plan don't have department/section/post — those columns would
    // always render '—' and waste 43% of horizontal space. Widen `title` and
    // promote `assignee` to its own visible column instead.
    const isFullTemplate = activeCompany?.template_type === 'full';

    // Fixed column width classes for consistent alignment across all tables
    const COL = isFullTemplate ? {
        title: 'w-[35%]',
        dept: 'w-[14%]',
        subdept: 'w-[13%]',
        post: 'w-[16%]',
        date: 'w-[12%]',
        status: 'w-[10%]',
    } : {
        title: 'w-[55%]',
        dept: 'hidden',
        subdept: 'hidden',
        post: 'w-[22%]',
        date: 'w-[13%]',
        status: 'w-[10%]',
    };

    // Render a task row for the flat list
    const renderTaskRow = (task: Task, showAssignee = false) => {
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
                <td className={`px-4 py-2.5 ${COL.title}`}>
                    <div className="flex items-center gap-2">
                        <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: STATUSES[task.status]?.color }}
                            title={STATUSES[task.status]?.label}
                            aria-label={`${t('common.status')}: ${STATUSES[task.status]?.label}`}
                        />
                        {task.is_recurring && (
                            <span
                                title={t('dashboard.recurring_tooltip')}
                                aria-label={t('dashboard.recurring_label')}
                                className="inline-flex flex-shrink-0 text-cyan-400"
                            >
                                <RefreshCw className="w-3 h-3" />
                            </span>
                        )}
                        <span className="font-medium text-white text-sm truncate">{task.title}</span>
                    </div>
                    <div className="md:hidden mt-1 text-[10px] text-navy-400 space-y-0.5">
                        <div>
                            {task.assigned_department_name || DEPARTMENTS[task.department_label]?.label || '—'}
                            {task.assigned_section_name && ` · ${task.assigned_section_name}`}
                        </div>
                        {task.assigned_post_name && (
                            <div className="text-navy-500">
                                {task.assigned_post_name}
                                {showAssignee && task.assignee_name && ` → ${task.assignee_name}`}
                            </div>
                        )}
                    </div>
                </td>
                {isFullTemplate && (
                    <>
                        <td className={`px-4 py-2.5 text-navy-300 text-xs hidden md:table-cell truncate ${COL.dept}`}>
                            {task.assigned_department_name || DEPARTMENTS[task.department_label]?.label || '—'}
                        </td>
                        <td className={`px-4 py-2.5 text-navy-400 text-xs hidden md:table-cell truncate ${COL.subdept}`}>
                            {task.assigned_section_name || '—'}
                        </td>
                    </>
                )}
                <td className={`px-4 py-2.5 text-navy-400 text-xs hidden lg:table-cell truncate ${COL.post}`}>
                    {isFullTemplate
                        ? (showAssignee ? (task.assignee_name || '—') : (task.assigned_post_name || '—'))
                        : (task.assignee_name || '—')}
                </td>
                <td className={`px-4 py-2.5 whitespace-nowrap ${COL.date}`}>
                    <span className={`text-xs font-medium ${
                        isOverdue ? 'text-red-400' : isDueSoon ? 'text-amber-400' : 'text-navy-300'
                    }`}>
                        {formatDate(task.due_date)}
                        {isOverdue && <span className="ml-1 text-[10px]">(-{daysOverdue}{t('dashboard.days_short')})</span>}
                    </span>
                </td>
                <td className={`px-4 py-2.5 ${COL.status}`}>
                    <InlineStatusPill
                        taskId={task.id}
                        currentStatus={task.status}
                        onChanged={(newStatus) => {
                            // Optimistically update allTasks so the row and groupings reflect the change
                            setAllTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
                        }}
                    />
                </td>
            </tr>
        );
    };

    // Render a grouped task section
    const renderTaskSection = (title: string, icon: React.ReactNode, tasks: Task[], sectionKey: string, showAssignee = false) => {
        const groups = groupByStatus(tasks);
        const fourthColHeader = showAssignee ? t('dashboard.col_assignee') : t('dashboard.col_post');

        return (
            <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-navy-700/50 flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        {icon}
                        {title}
                        <span className="text-xs text-navy-400 font-normal ml-1">({tasks.length})</span>
                    </h3>
                </div>

                {tasks.length === 0 ? (
                    <div className="text-center py-8">
                        <CheckCircle2 className="w-8 h-8 text-green-400/30 mx-auto mb-2" />
                        <p className="text-navy-500 text-sm">{t('tasks.no_tasks')}</p>
                    </div>
                ) : (
                    <div>
                        {groups.map(group => {
                            const collapseKey = `${sectionKey}_${group.status}`;
                            const isCollapsed = collapsedStatuses.has(collapseKey);
                            return (
                                <div key={group.status}>
                                    <button
                                        onClick={() => toggleStatusCollapse(collapseKey)}
                                        className="w-full flex items-center gap-2 px-5 py-2.5 bg-navy-800/30 hover:bg-navy-800/50 transition-colors border-t border-navy-700/30"
                                    >
                                        <ChevronRight className={`w-3.5 h-3.5 text-navy-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                                        <span className="text-xs font-semibold" style={{ color: group.color }}>{group.label}</span>
                                        <span className="text-[10px] text-navy-500">({group.tasks.length})</span>
                                    </button>
                                    {!isCollapsed && (
                                        <table className="w-full text-sm table-fixed">
                                            <thead>
                                                <tr className="bg-navy-800/20">
                                                    <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider ${COL.title}`}>{t('dashboard.col_task')}</th>
                                                    {isFullTemplate && (
                                                        <>
                                                            <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider hidden md:table-cell ${COL.dept}`}>{t('tasks.department')}</th>
                                                            <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider hidden md:table-cell ${COL.subdept}`}>{t('dashboard.col_subdepartment')}</th>
                                                        </>
                                                    )}
                                                    <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider hidden lg:table-cell ${COL.post}`}>{isFullTemplate ? fourthColHeader : t('dashboard.col_assignee')}</th>
                                                    <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider ${COL.date}`}>{t('tasks.due_date')}</th>
                                                    <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider ${COL.status}`}>{t('common.status')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.tasks.map(task => renderTaskRow(task, showAssignee))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 animate-fade-in overflow-x-hidden max-w-full">
            {/* Header + Controls */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">{t('nav.dashboard')}</h1>
                    <p className="text-navy-400 text-sm mt-1">{t('dashboard.welcome')}</p>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                    {/* Report button — admin/manager only */}
                    {(user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'manager') && (
                        <button
                            onClick={() => setShowReport(true)}
                            className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-xs md:text-sm text-navy-300 hover:text-white hover:border-navy-600 transition-all"
                        >
                            <FileDown className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t('dashboard.report')}</span>
                        </button>
                    )}

                    {/* Calendar / Listă toggle */}
                    <div className="flex items-center bg-navy-800/50 border border-navy-700/50 rounded-lg p-0.5">
                        <button
                            onClick={() => setShowCalendar(false)}
                            className={`flex items-center gap-1 px-2 md:px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                !showCalendar ? 'bg-navy-600 text-white' : 'text-navy-400 hover:text-white'
                            }`}
                        >
                            <List className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t('dashboard.view_list')}</span>
                        </button>
                        <button
                            onClick={() => setShowCalendar(true)}
                            className={`flex items-center gap-1 px-2 md:px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                showCalendar ? 'bg-navy-600 text-white' : 'text-navy-400 hover:text-white'
                            }`}
                        >
                            <CalendarDays className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t('dashboard.view_calendar')}</span>
                        </button>
                    </div>

                    {/* Settings gear */}
                    <button
                        onClick={() => setShowCustomizer(true)}
                        className="p-1.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-navy-400 hover:text-white hover:border-navy-600 transition-all"
                        title={t('dashboard.customize_tooltip')}
                        aria-label={t('dashboard.customize_label')}
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* "În Atenție" — Active alerts panel (compact; still pulsing) */}
            {isVisible('active_alerts') && activeAlerts.length > 0 && (
                <div className="relative rounded-xl border-2 border-red-500/60 bg-gradient-to-r from-red-500/10 via-orange-500/5 to-red-500/10 p-2.5 md:p-3 shadow-lg shadow-red-500/5 animate-slide-up overflow-hidden">
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500/20 via-orange-500/10 to-red-500/20 blur-sm animate-pulse pointer-events-none" />
                    <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs md:text-sm font-bold flex items-center gap-2 text-red-400">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                                </span>
                                <Bell className="w-3.5 h-3.5" />
                                {t('dashboard.attention')} — {activeAlerts.length} {activeAlerts.length === 1 ? t('dashboard.alert_singular') : t('dashboard.alert_plural')}
                            </h3>
                        </div>
                        <div className="space-y-1">
                            {activeAlerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-navy-900/60 border border-red-500/20 transition-all hover:bg-navy-800/80 hover:border-red-500/40 group"
                                >
                                    <div
                                        onClick={() => setSelectedTaskId(alert.task_id)}
                                        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:translate-x-0.5 transition-transform"
                                    >
                                        <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                                        <div className="flex-1 min-w-0 flex items-center gap-2">
                                            <p className="text-xs font-semibold truncate group-hover:text-white transition-colors">
                                                {alert.task_title}
                                            </p>
                                            <span className="text-[10px] text-navy-400 truncate hidden md:inline">— {alert.content}</span>
                                            <span className="text-[10px] text-navy-500 flex-shrink-0 ml-auto">{timeAgo(alert.created_at)}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                                await alertsApi.resolve(alert.task_id, alert.id);
                                                setActiveAlerts(prev => prev.filter(a => a.id !== alert.id));
                                            } catch {}
                                        }}
                                        title={t('dashboard.mark_resolved')}
                                        aria-label={t('dashboard.mark_resolved')}
                                        className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                                    >
                                        <CheckCircle2 className="w-3 h-3" />
                                        {t('dashboard.resolved')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Stat Cards — slim */}
            {isVisible('global_stats') && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                {statCards.map((card, i) => (
                    <div
                        key={i}
                        onClick={card.onClick}
                        className={`bg-navy-900/50 border border-navy-700/50 rounded-lg px-3 py-2 md:px-4 md:py-2.5 transition-all flex items-center gap-2 md:gap-3 ${
                            card.onClick ? 'cursor-pointer hover:border-navy-500/70 hover:bg-navy-800/50' : ''
                        }`}
                        title={card.onClick ? t('dashboard.click_for_filtered') : undefined}
                    >
                        <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${card.color} flex items-center justify-center flex-shrink-0`}>
                            <card.icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-2xl md:text-3xl font-bold leading-none">{card.value}</p>
                            <p className="text-navy-400 text-[9px] md:text-[10px] leading-tight mt-0.5 truncate">{card.label}</p>
                        </div>
                    </div>
                ))}
            </div>
            )}

            {/* Calendar mode */}
            {showCalendar && isVisible('calendar') ? (
                <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-5">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-blue-400" />
                        {t('dashboard.calendar_title')}
                    </h3>
                    <Suspense fallback={<LazyLoadFallback />}>
                        <CalendarView />
                    </Suspense>
                </div>
            ) : (
                <>
                    {/* MY ASSIGNED TASKS — grouped by status */}
                    {renderTaskSection(
                        t('dashboard.my_tasks'),
                        <UserCircle className="w-4 h-4 text-cyan-400" />,
                        myAssignedTasks,
                        'assigned'
                    )}

                    {/* TASKS I CREATED (assigned to others) — grouped by status */}
                    {renderTaskSection(
                        t('dashboard.created_by_me'),
                        <Briefcase className="w-4 h-4 text-purple-400" />,
                        myCreatedTasks,
                        'created',
                        true // show assignee name instead of post
                    )}

                    {/* ALL TASKS PER USER (overseer only) — full org workload */}
                    {isOverseer && tasksByUser.length > 0 && (
                        <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-navy-700/50 flex items-center gap-2">
                                <Users className="w-4 h-4 text-emerald-400" />
                                <h3 className="text-sm font-semibold">{t('dashboard.all_tasks_by_user')}</h3>
                                <span className="text-xs text-navy-400 font-normal ml-1">
                                    ({tasksByUser.reduce((sum, b) => sum + b.tasks.length, 0)})
                                </span>
                            </div>
                            <div className="divide-y divide-navy-700/40">
                                {tasksByUser.map(bucket => {
                                    const key = `user_${bucket.userId || 'unassigned'}`;
                                    const isCollapsed = collapsedStatuses.has(key);
                                    return (
                                        <div key={key}>
                                            <button
                                                onClick={() => toggleStatusCollapse(key)}
                                                className="w-full flex items-center gap-2 px-5 py-3 bg-navy-800/20 hover:bg-navy-800/40 transition-colors"
                                            >
                                                <ChevronRight className={`w-3.5 h-3.5 text-navy-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                                                <UserCircle className="w-4 h-4 text-navy-300" />
                                                <span className="text-sm font-medium text-white">{bucket.userName}</span>
                                                <span className="text-xs text-navy-400 ml-1">({bucket.tasks.length})</span>
                                            </button>
                                            {!isCollapsed && (
                                                <div className="px-3 pb-3 pt-1">
                                                    {groupByStatus(bucket.tasks).map(group => {
                                                        const innerKey = `${key}_${group.status}`;
                                                        const innerCollapsed = collapsedStatuses.has(innerKey);
                                                        return (
                                                            <div key={group.status} className="rounded-lg overflow-hidden border border-navy-700/30 mt-2">
                                                                <button
                                                                    onClick={() => toggleStatusCollapse(innerKey)}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 bg-navy-800/30 hover:bg-navy-800/50 transition-colors"
                                                                >
                                                                    <ChevronRight className={`w-3 h-3 text-navy-400 transition-transform ${innerCollapsed ? '' : 'rotate-90'}`} />
                                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                                                                    <span className="text-xs font-semibold" style={{ color: group.color }}>{group.label}</span>
                                                                    <span className="text-[10px] text-navy-500">({group.tasks.length})</span>
                                                                </button>
                                                                {!innerCollapsed && (
                                                                    <table className="w-full text-sm table-fixed">
                                                                        <thead>
                                                                            <tr className="bg-navy-800/20">
                                                                                <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider ${COL.title}`}>{t('dashboard.col_task')}</th>
                                                                                {isFullTemplate && (
                                                                                    <>
                                                                                        <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider hidden md:table-cell ${COL.dept}`}>{t('tasks.department')}</th>
                                                                                        <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider hidden md:table-cell ${COL.subdept}`}>{t('dashboard.col_subdepartment')}</th>
                                                                                    </>
                                                                                )}
                                                                                <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider hidden lg:table-cell ${COL.post}`}>{isFullTemplate ? t('dashboard.col_post') : t('dashboard.col_assignee')}</th>
                                                                                <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider ${COL.date}`}>{t('tasks.due_date')}</th>
                                                                                <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider ${COL.status}`}>{t('common.status')}</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {group.tasks.map(task => renderTaskRow(task, false))}
                                                                        </tbody>
                                                                    </table>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
            {showReport && (
                <Suspense fallback={<LazyLoadFallback />}>
                    <ReportModal isOpen={showReport} onClose={() => setShowReport(false)} />
                </Suspense>
            )}
            {showCustomizer && (
                <Suspense fallback={<LazyLoadFallback />}>
                    <DashboardCustomizer isOpen={showCustomizer} onClose={() => setShowCustomizer(false)} layout={widgetLayout} onSave={setWidgetLayout} />
                </Suspense>
            )}
            {selectedTaskId && (
                <Suspense fallback={<LazyLoadFallback />}>
                    <TaskDrawer
                        taskId={selectedTaskId}
                        onClose={() => setSelectedTaskId(null)}
                        onUpdate={() => {
                            // Reload tasks after update — mirror the initial
                            // call's shape so superadmin's per-user view and
                            // regular users' scoped lists both stay accurate.
                            const taskParams = isOverseer
                                ? { exclude_status: 'terminat', limit: 1000 }
                                : { my_tasks: 'true', exclude_status: 'terminat', limit: 500 };
                            tasksApi.list(taskParams)
                                .then(res => setAllTasks(res.tasks || res))
                                .catch(() => {});
                            // Also refresh the "În Atenție" banner: a new
                            // alert / resolved alert inside the drawer would
                            // otherwise leave the dashboard's aggregated list
                            // stale until the next company switch.
                            dashboardApi.activeAlerts()
                                .then(setActiveAlerts)
                                .catch(() => {});
                        }}
                    />
                </Suspense>
            )}
        </div>
    );
}
