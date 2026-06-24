import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { STATUSES } from '../../../types';
import { useTranslation } from '../../../i18n/I18nContext';
import { DashboardViewProps, OPEN_STATUS_ORDER, getUrgency, TaskLine } from './viewHelpers';

const URGENCY_RANK: Record<string, number> = { overdue: 0, today: 1, soon: 2, normal: 3 };

/**
 * Compact view (PRP 005): one dense list (urgent first) under a sticky summary
 * bar that always shows the total, per-status counts and the urgent count — so
 * even a user who never scrolls knows how many tasks exist and how many are hot.
 * A floating "N more below" pill appears when rows fall under the viewport fold.
 */
export default function CompactView({ tasks, onOpenTask, onStatusChanged, isFullTemplate }: DashboardViewProps) {
    const { t } = useTranslation();
    const listRef = useRef<HTMLDivElement>(null);
    const [belowCount, setBelowCount] = useState(0);

    const urgentCount = tasks.filter(tk => { const u = getUrgency(tk); return u === 'overdue' || u === 'today'; }).length;
    const statusCounts = OPEN_STATUS_ORDER.map(s => ({ s, label: t(`task_status.${s}`), color: STATUSES[s]?.color || '#999', n: tasks.filter(tk => tk.status === s).length }));

    const sorted = [...tasks].sort((a, b) =>
        (URGENCY_RANK[getUrgency(a)] - URGENCY_RANK[getUrgency(b)]) ||
        (new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    );

    // Count rows currently below the viewport fold so we can tell the user there's more.
    useEffect(() => {
        function measure() {
            const el = listRef.current;
            if (!el) { setBelowCount(0); return; }
            const rows = el.querySelectorAll('[data-task-row]');
            const fold = window.innerHeight - 8;
            let below = 0;
            rows.forEach(r => { if (r.getBoundingClientRect().top > fold) below++; });
            setBelowCount(below);
        }
        measure();
        window.addEventListener('scroll', measure, { passive: true });
        window.addEventListener('resize', measure);
        return () => { window.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
    }, [tasks]);

    return (
        <div className="relative">
            <div className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-navy-900 border border-navy-700/50 rounded-xl px-4 py-2.5 shadow-lg shadow-navy-950/40">
                <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold leading-none">{tasks.length}</span>
                    <span className="text-[11px] text-navy-400 font-semibold">{t('dashboard.open_label')}</span>
                </div>
                <div className="w-px self-stretch bg-navy-700/60" />
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                    {statusCounts.map(sc => (
                        <span key={sc.s} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold bg-white/5 border border-navy-700/50 rounded-full px-2.5 py-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.color }} />
                            <span className="text-navy-200">{sc.label}</span>
                            <span className="font-extrabold">{sc.n}</span>
                        </span>
                    ))}
                    {urgentCount > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-red-400 bg-red-500/10 border border-red-500/40 rounded-full px-2.5 py-1 ml-auto">
                            {t('dashboard.urgent_label')} <span className="font-extrabold">{urgentCount}</span>
                        </span>
                    )}
                </div>
                <div className="w-full text-[11px] text-navy-400 flex items-center gap-1.5">
                    <ChevronDown className="w-3 h-3" /> {t('dashboard.summary_hint')}
                </div>
            </div>

            <div ref={listRef} className="mt-3 bg-navy-900/50 border border-navy-700/50 rounded-xl overflow-hidden">
                {sorted.length === 0 ? (
                    <div className="text-center py-10 text-navy-500 text-sm">{t('tasks.no_tasks')}</div>
                ) : (
                    sorted.map(task => (
                        <TaskLine key={task.id} task={task} isFullTemplate={isFullTemplate} onOpenTask={onOpenTask} onStatusChanged={onStatusChanged} dense />
                    ))
                )}
            </div>

            {belowCount > 0 && (
                <button
                    onClick={() => window.scrollBy({ top: Math.round(window.innerHeight * 0.8), behavior: 'smooth' })}
                    className="fixed left-1/2 -translate-x-1/2 bottom-6 z-40 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500 text-white text-xs font-semibold shadow-xl shadow-navy-950/50 hover:bg-blue-400 transition-colors"
                >
                    {belowCount} {t('dashboard.tasks_below')} <ChevronDown className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}
