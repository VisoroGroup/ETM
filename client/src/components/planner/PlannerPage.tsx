import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { plannerApi } from '../../services/api';
import {
    STATUSES, TaskStatus, PlannedItem,
    PlannerWeekResponse, PlannerMonthResponse,
    PlannerCompanyWeekResponse, PlannerCompanyMonthResponse,
} from '../../types';
import {
    CalendarRange, ChevronLeft, ChevronRight, Loader2, Trash2, Users, UserCircle,
} from 'lucide-react';
import InlineStatusPill from '../tasks/InlineStatusPill';
import UserAvatar from '../ui/UserAvatar';
import TaskDrawer from '../tasks/TaskDrawer';
import { useToast } from '../../hooks/useToast';
import { useCompany } from '../../hooks/useCompany';
import { useTranslation } from '../../i18n/I18nContext';
import { formatDate } from '../../utils/helpers';

type Scope = 'week' | 'month';
type ViewMode = 'mine' | 'company';

// Local-date ISO string (YYYY-MM-DD). We avoid toISOString() because it converts
// to UTC first — east of UTC (Europe/Bucharest) Monday 00:00 local becomes the
// previous day in UTC, shifting the planned period. Same reasoning as WeekViewPage.
function toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Monday of the ISO week containing `date` — must match the existing week view
// convention so the planner and the old view mean the same week.
function mondayOf(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sun, 1 = Mon … 6 = Sat
    const diff = (day + 6) % 7; // days back to Monday
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// YYYY-MM for the month containing `date`.
function monthKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

export default function PlannerPage() {
    const [scope, setScope] = useState<Scope>('week');
    const [viewMode, setViewMode] = useState<ViewMode>('mine');
    // Anchor date drives both the week (its Monday) and the month (its 1st).
    const [anchor, setAnchor] = useState<Date>(() => new Date());
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const { showToast } = useToast();
    const { activeCompany } = useCompany();
    const { t } = useTranslation();
    const dateLocale = activeCompany?.language === 'hu' ? 'hu-HU' : 'ro-RO';

    const weekStart = toIsoDate(mondayOf(anchor));
    const month = monthKey(anchor);

    // Only whitelisted users (server-side) get the company overview switch.
    const { data: canViewData } = useQuery({
        queryKey: ['planner-can-view-company', activeCompany?.id],
        queryFn: () => plannerApi.canViewCompany(),
        enabled: !!activeCompany,
        staleTime: 5 * 60_000,
    });
    const canViewCompany = canViewData?.allowed ?? false;

    // My own plan (week or month). The query key includes the period so
    // navigating refetches; it includes company id so a company switch refetches.
    // Both responses carry `items`; the union lets one component render either.
    const myQuery = useQuery<PlannerWeekResponse | PlannerMonthResponse>({
        queryKey: ['planner-mine', activeCompany?.id, scope, scope === 'week' ? weekStart : month],
        queryFn: () => (scope === 'week'
            ? plannerApi.getWeek(weekStart)
            : plannerApi.getMonth(month)),
        enabled: !!activeCompany && viewMode === 'mine',
        staleTime: 30_000,
    });

    // Company overview (per-user grouped). Only runs when allowed AND selected.
    const companyQuery = useQuery<PlannerCompanyWeekResponse | PlannerCompanyMonthResponse>({
        queryKey: ['planner-company', activeCompany?.id, scope, scope === 'week' ? weekStart : month],
        queryFn: () => (scope === 'week'
            ? plannerApi.getCompanyWeek(weekStart)
            : plannerApi.getCompanyMonth(month)),
        enabled: !!activeCompany && viewMode === 'company' && canViewCompany,
        staleTime: 30_000,
    });

    function shiftPeriod(delta: number) {
        setAnchor(prev => {
            const d = new Date(prev);
            if (scope === 'week') d.setDate(d.getDate() + delta * 7);
            else d.setMonth(d.getMonth() + delta);
            return d;
        });
    }

    function jumpToCurrent() {
        setAnchor(new Date());
    }

    async function removeFromPlan(taskId: string) {
        try {
            if (scope === 'week') await plannerApi.removeFromWeek(taskId, weekStart);
            else await plannerApi.removeFromMonth(taskId, month);
            showToast(t('planner.removed'));
            myQuery.refetch();
        } catch {
            showToast(t('planner.remove_error'), 'error');
        }
    }

    // Period label shown under the title.
    const periodLabel = (() => {
        if (scope === 'week' && myQuery.data && 'start' in myQuery.data) {
            return `${myQuery.data.start} — ${myQuery.data.end}`;
        }
        if (scope === 'week' && companyQuery.data && 'start' in companyQuery.data) {
            return `${companyQuery.data.start} — ${companyQuery.data.end}`;
        }
        if (scope === 'month') {
            const d = new Date(`${month}-01T00:00:00`);
            const label = d.toLocaleDateString(dateLocale, { year: 'numeric', month: 'long' });
            return label.charAt(0).toLocaleUpperCase(dateLocale) + label.slice(1);
        }
        return scope === 'week' ? weekStart : month;
    })();

    // A single planned-task row in the Dashboard style: status-colored left
    // border, title + muted meta, inline status pill. `onRemove` is omitted in
    // the company overview (a manager doesn't curate other people's plans).
    function renderRow(item: PlannedItem, opts?: { showAssignee?: boolean; onRemove?: (id: string) => void }) {
        const statusColor = STATUSES[item.status]?.color || '#475569';
        return (
            <div
                key={`${item.task_id}-${item.period_start}`}
                onClick={() => setSelectedTaskId(item.task_id)}
                className="flex items-center gap-3 md:gap-4 px-4 py-2.5 border-t border-navy-700/30 cursor-pointer transition-colors hover:bg-navy-800/40"
                style={{ borderLeft: `3px solid ${statusColor}` }}
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-white text-sm truncate">{item.title}</span>
                        {item.rolled_over && (
                            <span
                                className="flex-shrink-0 text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-semibold"
                                title={t('planner.rolled_over')}
                            >
                                {t('planner.rolled_over')}
                            </span>
                        )}
                    </div>
                    {opts?.showAssignee && item.assignee_name && (
                        <span className="flex items-center gap-1 text-[10.5px] text-navy-200 font-medium mt-0.5">
                            <UserCircle className="w-3 h-3 text-navy-400" />
                            {item.assignee_name}
                        </span>
                    )}
                </div>
                {/* Due date — informational only; the plan never changes it. */}
                <div className="flex-shrink-0 w-[104px] text-xs whitespace-nowrap text-navy-400">
                    {formatDate(item.due_date)}
                </div>
                <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <InlineStatusPill
                        taskId={item.task_id}
                        currentStatus={item.status as TaskStatus}
                        onChanged={() => {
                            // Refresh whichever view is showing so a status change
                            // here reflects immediately (e.g. terminat won't roll over).
                            if (viewMode === 'mine') myQuery.refetch();
                            else companyQuery.refetch();
                        }}
                    />
                </div>
                {opts?.onRemove && (
                    <button
                        onClick={(e) => { e.stopPropagation(); opts.onRemove!(item.task_id); }}
                        className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-red-600/15 text-red-400 hover:bg-red-600/30 transition-colors"
                        title={t('planner.remove')}
                    >
                        <Trash2 className="w-3 h-3" />
                        <span className="hidden sm:inline">{t('planner.remove')}</span>
                    </button>
                )}
            </div>
        );
    }

    const isLoading = viewMode === 'mine' ? myQuery.isLoading : companyQuery.isLoading;
    const myItems: PlannedItem[] = myQuery.data?.items ?? [];
    const companyUsers = companyQuery.data?.users ?? [];

    return (
        <div className="p-4 md:p-6 animate-fade-in max-w-[1040px] mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <CalendarRange className="w-6 h-6 text-cyan-400" />
                        {t('planner.title')}
                    </h1>
                    <p className="text-navy-400 text-sm mt-1">{periodLabel}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Period navigation */}
                    <button
                        onClick={() => shiftPeriod(-1)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-xs hover:bg-navy-700/50"
                    >
                        <ChevronLeft className="w-3 h-3" /> {t('planner.nav_prev')}
                    </button>
                    <button
                        onClick={jumpToCurrent}
                        className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/40 rounded-lg text-xs font-medium text-blue-300 hover:bg-blue-500/30"
                    >
                        {scope === 'week' ? t('planner.this_week') : t('planner.this_month')}
                    </button>
                    <button
                        onClick={() => shiftPeriod(1)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-xs hover:bg-navy-700/50"
                    >
                        {t('planner.nav_next')} <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Tabs (week / month) + optional company switch */}
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="flex items-center bg-navy-800/50 border border-navy-700/50 rounded-lg p-0.5">
                    <button
                        onClick={() => setScope('week')}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                            scope === 'week' ? 'bg-navy-600 text-white' : 'text-navy-400 hover:text-white'
                        }`}
                    >
                        {t('planner.week')}
                    </button>
                    <button
                        onClick={() => setScope('month')}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                            scope === 'month' ? 'bg-navy-600 text-white' : 'text-navy-400 hover:text-white'
                        }`}
                    >
                        {t('planner.month')}
                    </button>
                </div>

                {canViewCompany && (
                    <div className="flex items-center bg-navy-800/50 border border-navy-700/50 rounded-lg p-0.5">
                        <button
                            onClick={() => setViewMode('mine')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                viewMode === 'mine' ? 'bg-navy-600 text-white' : 'text-navy-400 hover:text-white'
                            }`}
                        >
                            <UserCircle className="w-3.5 h-3.5" /> {t('planner.my_plan')}
                        </button>
                        <button
                            onClick={() => setViewMode('company')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                viewMode === 'company' ? 'bg-navy-600 text-white' : 'text-navy-400 hover:text-white'
                            }`}
                        >
                            <Users className="w-3.5 h-3.5" /> {t('planner.company_view')}
                        </button>
                    </div>
                )}
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-16 text-navy-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('common.loading')}
                </div>
            )}

            {/* My plan */}
            {!isLoading && viewMode === 'mine' && (
                myItems.length === 0 ? (
                    <div className="text-center py-16 text-navy-400 text-sm border border-navy-700/50 rounded-xl bg-navy-900/30">
                        {t('planner.empty')}
                    </div>
                ) : (
                    <div className="border border-navy-700/50 rounded-xl bg-navy-900/30 overflow-hidden">
                        {myItems.map(item => renderRow(item, { onRemove: removeFromPlan }))}
                    </div>
                )
            )}

            {/* Company overview — per-user grouping (WeekViewPage pattern). */}
            {!isLoading && viewMode === 'company' && (
                companyUsers.length === 0 ? (
                    <div className="text-center py-16 text-navy-400 text-sm border border-navy-700/50 rounded-xl bg-navy-900/30">
                        {t('planner.empty')}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {companyUsers.map(u => (
                            <div key={u.user_id} className="rounded-xl border border-navy-700/50 bg-navy-900/30 overflow-hidden">
                                <div className="flex items-center gap-3 px-4 py-3 bg-navy-700/40 border-b border-navy-700/60 border-l-[3px] border-l-blue-500/60">
                                    <UserAvatar name={u.display_name} avatarUrl={null} size="sm" />
                                    <span className="text-sm font-semibold text-white">{u.display_name}</span>
                                    <span className="text-xs font-medium text-navy-200 bg-navy-900/50 rounded-full px-2 py-0.5 ml-1">
                                        {u.items.length}
                                    </span>
                                </div>
                                {u.items.length === 0 ? (
                                    <p className="px-4 py-3 text-xs text-navy-500">{t('planner.empty')}</p>
                                ) : (
                                    <div>{u.items.map(item => renderRow(item))}</div>
                                )}
                            </div>
                        ))}
                    </div>
                )
            )}

            {selectedTaskId && (
                <TaskDrawer
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                    onUpdate={() => {
                        if (viewMode === 'mine') myQuery.refetch();
                        else companyQuery.refetch();
                    }}
                />
            )}
        </div>
    );
}
