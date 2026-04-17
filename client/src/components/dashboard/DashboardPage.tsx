import React, { useEffect, useState } from 'react';
import { dashboardApi, tasksApi, alertsApi } from '../../services/api';
import { DashboardStats, DashboardCharts, Task, TaskStatus, STATUSES, DEPARTMENTS } from '../../types';
import { getDueDateStatus, formatDate, getDaysOverdue, getDaysUntil } from '../../utils/helpers';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
    AlertTriangle, Ban, CheckCircle2, Activity,
    ChevronRight, ChevronDown, Loader2, CalendarDays, List, Bell, FileDown, Settings, UserCircle, Briefcase, RefreshCw
} from 'lucide-react';
import { timeAgo } from '../../utils/helpers';
import CalendarView from './CalendarView';
import ReportModal from './ReportModal';
import DashboardCustomizer from './DashboardCustomizer';
import TaskDrawer from '../tasks/TaskDrawer';
import InlineStatusPill from '../tasks/InlineStatusPill';
import type { WidgetConfig } from '../../types';

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

    useEffect(() => {
        let cancelled = false;

        async function loadDashboard() {
            try {
                const [s, c, tasks, alerts, prefs] = await Promise.all([
                    dashboardApi.stats(),
                    dashboardApi.charts(),
                    tasksApi.list(),
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
    }, []);

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
            label: 'Sarcini active', value: stats?.active || 0,
            icon: Activity, color: 'from-blue-500 to-blue-600', textColor: 'text-blue-400',
            onClick: () => navigate('/tasks')
        },
        {
            label: 'Depășite', value: stats?.overdue || 0,
            icon: AlertTriangle, color: overdueColor.bg, textColor: overdueColor.text,
            onClick: () => navigate('/tasks', { state: { filter: 'overdue' } })
        },
        {
            label: 'Blocate', value: stats?.blocked || 0,
            icon: Ban, color: blockedColor.bg, textColor: blockedColor.text,
            onClick: () => navigate('/tasks', { state: { filter: 'blocat' } })
        },
        {
            label: 'Finalizate luna aceasta', value: stats?.completed_this_month || 0,
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

    // Fixed column width classes for consistent alignment across all tables
    const COL = {
        title: 'w-[35%]',
        dept: 'w-[14%]',
        subdept: 'w-[13%]',
        post: 'w-[16%]',
        date: 'w-[12%]',
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
                            aria-label={`Status: ${STATUSES[task.status]?.label}`}
                        />
                        {task.is_recurring && (
                            <span
                                title="Sarcină recurentă — se regenerează automat la finalizare"
                                aria-label="Recurentă"
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
                <td className={`px-4 py-2.5 text-navy-300 text-xs hidden md:table-cell truncate ${COL.dept}`}>
                    {task.assigned_department_name || DEPARTMENTS[task.department_label]?.label || '—'}
                </td>
                <td className={`px-4 py-2.5 text-navy-400 text-xs hidden md:table-cell truncate ${COL.subdept}`}>
                    {task.assigned_section_name || '—'}
                </td>
                <td className={`px-4 py-2.5 text-navy-400 text-xs hidden lg:table-cell truncate ${COL.post}`}>
                    {showAssignee ? (task.assignee_name || '—') : (task.assigned_post_name || '—')}
                </td>
                <td className={`px-4 py-2.5 whitespace-nowrap ${COL.date}`}>
                    <span className={`text-xs font-medium ${
                        isOverdue ? 'text-red-400' : isDueSoon ? 'text-amber-400' : 'text-navy-300'
                    }`}>
                        {formatDate(task.due_date)}
                        {isOverdue && <span className="ml-1 text-[10px]">(-{daysOverdue}z)</span>}
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
        const fourthColHeader = showAssignee ? 'Responsabil' : 'Post';

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
                        <p className="text-navy-500 text-sm">Nicio sarcină</p>
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
                                                    <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider ${COL.title}`}>Sarcină</th>
                                                    <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider hidden md:table-cell ${COL.dept}`}>Departament</th>
                                                    <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider hidden md:table-cell ${COL.subdept}`}>Subdepartament</th>
                                                    <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider hidden lg:table-cell ${COL.post}`}>{fourthColHeader}</th>
                                                    <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider ${COL.date}`}>Termen</th>
                                                    <th className={`text-left px-4 py-2 font-medium text-navy-400 text-[10px] uppercase tracking-wider ${COL.status}`}>Status</th>
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
                    <h1 className="text-2xl font-bold">Dashboard</h1>
                    <p className="text-navy-400 text-sm mt-1">Bine ai venit! Iată o privire de ansamblu.</p>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                    {/* Report button — admin/manager only */}
                    {(user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'manager') && (
                        <button
                            onClick={() => setShowReport(true)}
                            className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-xs md:text-sm text-navy-300 hover:text-white hover:border-navy-600 transition-all"
                        >
                            <FileDown className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Raport</span>
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
                            <span className="hidden sm:inline">Listă</span>
                        </button>
                        <button
                            onClick={() => setShowCalendar(true)}
                            className={`flex items-center gap-1 px-2 md:px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                showCalendar ? 'bg-navy-600 text-white' : 'text-navy-400 hover:text-white'
                            }`}
                        >
                            <CalendarDays className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Calendar</span>
                        </button>
                    </div>

                    {/* Settings gear */}
                    <button
                        onClick={() => setShowCustomizer(true)}
                        className="p-1.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-navy-400 hover:text-white hover:border-navy-600 transition-all"
                        title="Personalizează panoul — afișează/ascunde widget-uri"
                        aria-label="Personalizează panoul"
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
                                În Atenție — {activeAlerts.length} {activeAlerts.length === 1 ? 'alertă activă' : 'alerte active'}
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
                                        title="Marchează rezolvat"
                                        aria-label="Marchează rezolvat"
                                        className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                                    >
                                        <CheckCircle2 className="w-3 h-3" />
                                        Rezolvat
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Stat Cards — slim */}
            {isVisible('global_stats') && (
            <div className="grid grid-cols-4 gap-2 md:gap-3">
                {statCards.map((card, i) => (
                    <div
                        key={i}
                        onClick={card.onClick}
                        className={`bg-navy-900/50 border border-navy-700/50 rounded-lg px-3 py-2 md:px-4 md:py-2.5 transition-all flex items-center gap-2 md:gap-3 ${
                            card.onClick ? 'cursor-pointer hover:border-navy-500/70 hover:bg-navy-800/50' : ''
                        }`}
                        title={card.onClick ? 'Apasă pentru lista filtrată' : undefined}
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
                        Vedere calendar — termene limită
                    </h3>
                    <CalendarView />
                </div>
            ) : (
                <>
                    {/* MY ASSIGNED TASKS — grouped by status */}
                    {renderTaskSection(
                        'Sarcinile mele',
                        <UserCircle className="w-4 h-4 text-cyan-400" />,
                        myAssignedTasks,
                        'assigned'
                    )}

                    {/* TASKS I CREATED (assigned to others) — grouped by status */}
                    {renderTaskSection(
                        'Create de mine',
                        <Briefcase className="w-4 h-4 text-purple-400" />,
                        myCreatedTasks,
                        'created',
                        true // show assignee name instead of post
                    )}
                </>
            )}
            {showReport && <ReportModal isOpen={showReport} onClose={() => setShowReport(false)} />}
            {showCustomizer && <DashboardCustomizer isOpen={showCustomizer} onClose={() => setShowCustomizer(false)} layout={widgetLayout} onSave={setWidgetLayout} />}
            {selectedTaskId && (
                <TaskDrawer
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                    onUpdate={() => {
                        // Reload tasks after update
                        tasksApi.list().then(res => setAllTasks(res.tasks || res)).catch(() => {});
                    }}
                />
            )}
        </div>
    );
}
