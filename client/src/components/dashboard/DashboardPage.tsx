import React, { useEffect, useState } from 'react';
import { dashboardApi, tasksApi, alertsApi } from '../../services/api';
import { DashboardStats, DashboardCharts, Task, STATUSES, DEPARTMENTS } from '../../types';
import { getDueDateStatus, formatDate, getDaysOverdue, getDaysUntil } from '../../utils/helpers';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
    LineChart, Line, ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
    TrendingUp, AlertTriangle, Ban, CheckCircle2, Activity,
    Clock, ChevronRight, Loader2, CalendarDays, List, User, Bell, Link2, FileDown, Settings
} from 'lucide-react';
import { timeAgo } from '../../utils/helpers';
import CalendarView from './CalendarView';
import ReportModal from './ReportModal';
import DashboardCustomizer from './DashboardCustomizer';
import type { WidgetConfig } from '../../types';

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [charts, setCharts] = useState<DashboardCharts | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCalendar, setShowCalendar] = useState(false);
    const [myTasksOnly, setMyTasksOnly] = useState(false);
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
    const [myStats, setMyStats] = useState<any>(null);
    const [bottlenecks, setBottlenecks] = useState<any[]>([]);
    const [showReport, setShowReport] = useState(false);
    const [widgetLayout, setWidgetLayout] = useState<WidgetConfig[]>([]);
    const [showCustomizer, setShowCustomizer] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        let cancelled = false;

        async function loadDashboard() {
            try {
                const [s, c, tasks, alerts, ms, bn, prefs] = await Promise.all([
                    dashboardApi.stats(),
                    dashboardApi.charts(),
                    tasksApi.list(),
                    dashboardApi.activeAlerts().catch(() => []),
                    dashboardApi.myStats().catch(() => null),
                    dashboardApi.bottlenecks().catch(() => []),
                    dashboardApi.getPreferences().catch(() => []),
                ]);
                if (cancelled) return;
                setStats(s);
                setCharts(c);
                setAllTasks(tasks.tasks || tasks);
                setActiveAlerts(alerts);
                setMyStats(ms);
                setBottlenecks(bn);
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

    const statusChartData = charts?.status_distribution.map(d => ({
        name: STATUSES[d.status]?.label || d.status,
        value: parseInt(d.count, 10),
        color: STATUSES[d.status]?.color || '#999'
    })) || [];

    const deptChartData = charts?.department_distribution.map(d => ({
        name: DEPARTMENTS[d.department_label]?.label || d.department_label,
        value: parseInt(d.count, 10),
        color: DEPARTMENTS[d.department_label]?.color || '#999'
    })) || [];

    const trendData = charts?.completion_trend || [];

    // Filter tasks for "sarcinile mele"
    const filteredTasks = myTasksOnly
        ? allTasks.filter(t => t.created_by === user?.id)
        : allTasks;

    // Urgente tasks (overdue + due soon) from filtered list
    const urgentFilteredTasks = charts?.urgent_tasks
        ? myTasksOnly
            ? charts.urgent_tasks.filter(t => t.created_by === user?.id)
            : charts.urgent_tasks
        : [];

    const statCards = [
        {
            label: 'Task-uri active', value: stats?.active || 0,
            icon: Activity, color: 'from-blue-500 to-blue-600', textColor: 'text-blue-400',
            onClick: () => navigate('/tasks')
        },
        {
            label: 'Depășite', value: stats?.overdue || 0,
            icon: AlertTriangle, color: 'from-red-500 to-red-600', textColor: 'text-red-400',
            onClick: () => navigate('/tasks', { state: { filter: 'overdue' } })
        },
        {
            label: 'Blocate', value: stats?.blocked || 0,
            icon: Ban, color: 'from-orange-500 to-orange-600', textColor: 'text-orange-400',
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
        if (widgetLayout.length === 0) return true; // no prefs = show all
        const w = widgetLayout.find(w => w.widget_id === widgetId);
        return w ? w.visible : true;
    };

    return (
        <div className="p-4 md:p-6 space-y-6 animate-fade-in">
            {/* Header + Controls */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Dashboard</h1>
                    <p className="text-navy-400 text-sm mt-1">Bine ai venit! Iată o privire de ansamblu.</p>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                    {/* Sarcinile mele filter */}
                    <button
                        onClick={() => setMyTasksOnly(v => !v)}
                        className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all border ${
                            myTasksOnly
                                ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                                : 'bg-navy-800/50 border-navy-700/50 text-navy-300 hover:text-white hover:border-navy-600'
                        }`}
                    >
                        <User className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Sarcinile</span> mele
                    </button>

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
                        title="Personalizare panou"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* "În Atenție" — Active alerts panel */}
            {isVisible('active_alerts') && activeAlerts.length > 0 && (
                <div className="relative rounded-xl border-2 border-red-500/60 bg-gradient-to-r from-red-500/10 via-orange-500/5 to-red-500/10 p-4 md:p-5 shadow-lg shadow-red-500/5 animate-slide-up overflow-hidden">
                    {/* Pulsating glow */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500/20 via-orange-500/10 to-red-500/20 blur-sm animate-pulse pointer-events-none" />
                    <div className="relative">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold flex items-center gap-2 text-red-400">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                                </span>
                                <Bell className="w-4 h-4" />
                                În Atenție — {activeAlerts.length} {activeAlerts.length === 1 ? 'alertă activă' : 'alerte active'}
                            </h3>
                        </div>
                        <div className="space-y-2">
                            {activeAlerts.map((alert) => (
                                <div
                                    key={alert.id}
                                    className="flex items-center gap-3 px-4 py-3 rounded-lg bg-navy-900/60 border border-red-500/20 transition-all hover:bg-navy-800/80 hover:border-red-500/40 group"
                                >
                                    <div
                                        onClick={() => navigate('/tasks', { state: { openTaskId: alert.task_id } })}
                                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:translate-x-1 transition-transform"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0 shadow-md">
                                            <AlertTriangle className="w-4 h-4 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate group-hover:text-white transition-colors">
                                                {alert.task_title}
                                            </p>
                                            <p className="text-xs text-navy-300 mt-0.5 line-clamp-1">{alert.content}</p>
                                            <span className="text-[10px] text-navy-500 mt-1 inline-block">de {alert.creator_name} · {timeAgo(alert.created_at)}</span>
                                        </div>
                                    </div>
                                    {/* Resolve button */}
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                                await alertsApi.resolve(alert.task_id, alert.id);
                                                setActiveAlerts(prev => prev.filter(a => a.id !== alert.id));
                                            } catch {}
                                        }}
                                        title="Marchează rezolvat"
                                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Rezolvat
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Stat Cards */}
            {isVisible('global_stats') && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {statCards.map((card, i) => (
                    <div
                        key={i}
                        onClick={card.onClick}
                        className={`bg-navy-900/50 border border-navy-700/50 rounded-xl p-3 md:p-5 transition-all animate-slide-up ${
                            card.onClick ? 'cursor-pointer hover:border-navy-500/70 hover:bg-navy-800/50 hover:scale-[1.01]' : ''
                        }`}
                        style={{ animationDelay: `${i * 100}ms` }}
                        title={card.onClick ? 'Apasă pentru lista filtrată' : undefined}
                    >
                        <div className="flex items-center justify-between mb-2 md:mb-3">
                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                                <card.icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                            </div>
                            {card.onClick && <ChevronRight className="w-4 h-4 text-navy-500 hidden md:block" />}
                        </div>
                        <p className="text-2xl md:text-3xl font-bold">{card.value}</p>
                        <p className="text-navy-400 text-[11px] md:text-sm mt-0.5 md:mt-1 leading-tight">{card.label}</p>
                    </div>
                ))}
            </div>
            )}

            {/* My personal stats */}
            {isVisible('my_stats') && myStats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <div className="bg-navy-900/50 border border-cyan-500/30 rounded-xl p-3 md:p-4">
                        <div className="flex items-center gap-1.5 mb-1">
                            <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-cyan-400" />
                            <span className="text-[10px] md:text-xs font-medium text-cyan-400">Asignate mie</span>
                        </div>
                        <p className="text-xl md:text-2xl font-bold">{myStats.my_active}</p>
                    </div>
                    <div className="bg-navy-900/50 border border-red-500/30 rounded-xl p-3 md:p-4">
                        <div className="flex items-center gap-1.5 mb-1">
                            <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-400" />
                            <span className="text-[10px] md:text-xs font-medium text-red-400">Depășite (ale mele)</span>
                        </div>
                        <p className="text-xl md:text-2xl font-bold">{myStats.my_overdue}</p>
                    </div>
                    <div className="bg-navy-900/50 border border-yellow-500/30 rounded-xl p-3 md:p-4">
                        <div className="flex items-center gap-1.5 mb-1">
                            <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-yellow-400" />
                            <span className="text-[10px] md:text-xs font-medium text-yellow-400">Subtask-uri rămase</span>
                        </div>
                        <p className="text-xl md:text-2xl font-bold">{myStats.my_pending_subtasks}</p>
                    </div>
                    <div className="bg-navy-900/50 border border-green-500/30 rounded-xl p-3 md:p-4">
                        <div className="flex items-center gap-1.5 mb-1">
                            <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-400" />
                            <span className="text-[10px] md:text-xs font-medium text-green-400">Finalizate (ale mele)</span>
                        </div>
                        <p className="text-xl md:text-2xl font-bold">{myStats.my_completed_this_month}</p>
                    </div>
                </div>
            )}

            {/* Calendar mode */}
            {showCalendar && isVisible('calendar') ? (
                <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-5">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-blue-400" />
                        Vedere calendar — termene limită
                        {myTasksOnly && <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">Personale</span>}
                    </h3>
                    <CalendarView />
                </div>
            ) : (
                <>
                    {/* Charts Row */}
                    {(isVisible('status_chart') || isVisible('dept_chart') || isVisible('trend_chart')) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        {/* Status Distribution - Donut */}
                        {isVisible('status_chart') && (
                        <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-4 md:p-5">
                            <h3 className="text-xs md:text-sm font-semibold mb-3 md:mb-4">Distribuție pe statusuri</h3>
                            {statusChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie
                                            data={statusChartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={80}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {statusChartData.map((d, i) => (
                                                <Cell key={i} fill={d.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ background: '#1E3A5F', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-[200px] flex items-center justify-center text-navy-500 text-sm">Nicio dată</div>
                            )}
                            <div className="flex flex-wrap gap-3 mt-2">
                                {statusChartData.map((d, i) => (
                                    <div key={i} className="flex items-center gap-1.5 text-xs">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                                        <span className="text-navy-300">{d.name}: {d.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        )}

                        {/* Department Distribution - Bar */}
                        {isVisible('dept_chart') && (
                        <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-5">
                            <h3 className="text-sm font-semibold mb-4">Task-uri pe departament</h3>
                            {deptChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={deptChartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334e68" />
                                        <XAxis dataKey="name" tick={{ fill: '#829ab1', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                                        <YAxis tick={{ fill: '#829ab1', fontSize: 11 }} />
                                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: '#1E3A5F', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px' }} />
                                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                            {deptChartData.map((d, i) => (
                                                <Cell key={i} fill={d.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-[200px] flex items-center justify-center text-navy-500 text-sm">Nicio dată</div>
                            )}
                        </div>
                        )}

                        {/* Completion Trend - Line */}
                        {isVisible('trend_chart') && (
                        <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-5">
                            <h3 className="text-sm font-semibold mb-4">Trend finalizare (4 săptămâni)</h3>
                            {trendData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={trendData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334e68" />
                                        <XAxis dataKey="label" tick={{ fill: '#829ab1', fontSize: 11 }} />
                                        <YAxis tick={{ fill: '#829ab1', fontSize: 11 }} allowDecimals={false} />
                                        <Tooltip contentStyle={{ background: '#1E3A5F', border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px' }} />
                                        <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-[200px] flex items-center justify-center text-navy-500 text-sm">Nicio dată</div>
                            )}
                        </div>
                        )}
                    </div>
                    )}

                    {/* Urgent Tasks */}
                    {isVisible('urgent_tasks') && (
                    <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Clock className="w-4 h-4 text-orange-400" />
                                Task-uri urgente
                                {myTasksOnly && <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">Personale</span>}
                            </h3>
                            <button
                                onClick={() => navigate('/tasks')}
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                            >
                                Vezi toate <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>

                        {urgentFilteredTasks.length > 0 ? (
                            <div className="space-y-2">
                                {urgentFilteredTasks.map((task) => {
                                    const dueStat = getDueDateStatus(task.due_date);
                                    return (
                                        <div
                                            key={task.id}
                                            onClick={() => navigate('/tasks', { state: { openTaskId: task.id } })}
                                            className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all hover:bg-navy-800/50 ${
                                                dueStat === 'overdue' ? 'border-l-2 border-red-500 bg-red-500/5' :
                                                dueStat === 'today' ? 'border-l-2 border-yellow-500 bg-yellow-500/5' :
                                                'border-l-2 border-navy-600'
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{task.title}</p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-xs px-2 py-0.5 rounded-full border" style={{ background: STATUSES[task.status]?.bg, color: STATUSES[task.status]?.color, borderColor: STATUSES[task.status]?.border }}>
                                                        {STATUSES[task.status]?.label}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className={`text-xs font-medium ${
                                                    dueStat === 'overdue' ? 'text-red-400' :
                                                    dueStat === 'today' ? 'text-yellow-400' :
                                                    'text-navy-400'
                                                }`}>
                                                    {dueStat === 'overdue'
                                                        ? `Depășit cu ${getDaysOverdue(task.due_date)} zile`
                                                        : dueStat === 'today'
                                                            ? 'Scadent azi'
                                                            : `În ${getDaysUntil(task.due_date)} zile`
                                                    }
                                                </p>
                                                <p className="text-[10px] text-navy-500 mt-0.5">{formatDate(task.due_date)}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <CheckCircle2 className="w-10 h-10 text-green-400/50 mx-auto mb-2" />
                                <p className="text-navy-500 text-sm">
                                    {myTasksOnly ? 'Niciun task urgent personal!' : 'Niciun task urgent!'}
                                </p>
                            </div>
                        )}
                    </div>
                    )}

                    {/* Bottleneck Tasks */}
                    {isVisible('bottlenecks') && bottlenecks.length > 0 && (
                        <div className="bg-navy-900/50 border border-orange-500/30 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <Link2 className="w-4 h-4 text-orange-400" />
                                    Blocaje critice
                                </h3>
                            </div>
                            <div className="space-y-2">
                                {bottlenecks.map((task: any) => (
                                    <div
                                        key={task.id}
                                        onClick={() => navigate('/tasks', { state: { openTaskId: task.id } })}
                                        className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all hover:bg-navy-800/50 border-l-2 border-orange-500 bg-orange-500/5"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{task.title}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                {task.assignee_name && (
                                                    <span className="text-[10px] text-navy-400">{task.assignee_name}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-orange-400">
                                            <Link2 className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold">{task.blocks_count}</span>
                                            <span className="text-[10px] text-navy-400">blocat{parseInt(task.blocks_count, 10) !== 1 ? 'e' : ''}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
            {showReport && <ReportModal isOpen={showReport} onClose={() => setShowReport(false)} />}
            {showCustomizer && <DashboardCustomizer isOpen={showCustomizer} onClose={() => setShowCustomizer(false)} layout={widgetLayout} onSave={setWidgetLayout} />}
        </div>
    );
}
