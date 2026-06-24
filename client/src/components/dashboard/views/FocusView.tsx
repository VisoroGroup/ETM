import React, { useState } from 'react';
import { ChevronDown, AlertTriangle, Ban, Inbox } from 'lucide-react';
import { Task, STATUSES } from '../../../types';
import { formatDate } from '../../../utils/helpers';
import { useTranslation } from '../../../i18n/I18nContext';
import InlineStatusPill from '../../tasks/InlineStatusPill';
import { DashboardViewProps, OPEN_STATUS_ORDER, getUrgency, locBits } from './viewHelpers';

/**
 * Focus view (PRP 005): the things that need attention now (overdue + due today
 * + in progress) sit at the top in a short ranked list, like an email inbox —
 * so the critical work is always above the fold and not scrolling costs nothing.
 * Everything else is one click away under a collapsed "rest" expander.
 */
export default function FocusView({ tasks, onOpenTask, onStatusChanged, isFullTemplate }: DashboardViewProps) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    const score = (tk: Task) => { const u = getUrgency(tk); if (u === 'overdue') return 0; if (u === 'today') return 1; return 2; };
    const isFocus = (tk: Task) => { const u = getUrgency(tk); return u === 'overdue' || u === 'today' || tk.status === 'in_realizare'; };

    const focus = tasks.filter(isFocus).sort((a, b) => score(a) - score(b) || new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const focusIds = new Set(focus.map(tk => tk.id));
    const rest = tasks.filter(tk => !focusIds.has(tk.id));

    const urgentCount = tasks.filter(tk => { const u = getUrgency(tk); return u === 'overdue' || u === 'today'; }).length;
    const blockedCount = tasks.filter(tk => tk.status === 'blocat').length;

    const urgencyTag = (tk: Task) => {
        const u = getUrgency(tk);
        if (u === 'overdue') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-red-400 bg-red-500/15 border border-red-500/40 whitespace-nowrap">{t('dashboard.urgency_overdue')}</span>;
        if (u === 'today') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-red-400 bg-red-500/15 border border-red-500/40 whitespace-nowrap">{t('dashboard.urgency_today')}</span>;
        if (u === 'soon') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-amber-400 bg-amber-500/15 border border-amber-500/40 whitespace-nowrap">{t('dashboard.urgency_soon')}</span>;
        return null;
    };

    const FocusRow = ({ task, rank }: { task: Task; rank: number }) => {
        const color = STATUSES[task.status]?.color || '#475569';
        const meta = [...locBits(task, isFullTemplate), formatDate(task.due_date)].join(' · ');
        return (
            <div onClick={() => onOpenTask(task.id)} className="flex items-center gap-3 px-4 py-3 border-b border-navy-700/40 last:border-b-0 cursor-pointer hover:bg-navy-800/40 transition-colors">
                <span className="w-5 text-center text-xs font-bold text-navy-400 tabular-nums flex-shrink-0">{rank}</span>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm truncate">{task.title}</div>
                    <div className="text-[11px] text-navy-400 truncate">{meta}</div>
                </div>
                {urgencyTag(task)}
                <div className="flex-shrink-0">
                    <InlineStatusPill taskId={task.id} currentStatus={task.status} onChanged={(s) => onStatusChanged(task.id, s)} />
                </div>
            </div>
        );
    };

    const RestRow = ({ task }: { task: Task }) => {
        const color = STATUSES[task.status]?.color || '#475569';
        const bits = locBits(task, isFullTemplate);
        return (
            <div onClick={() => onOpenTask(task.id)} className="flex items-center gap-3 px-4 py-2.5 border-t border-navy-700/30 cursor-pointer hover:bg-navy-800/40 transition-colors" style={{ borderLeft: `3px solid ${color}` }}>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-sm truncate">{task.title}</div>
                    {bits.length > 0 && <div className="text-[10.5px] text-navy-500 truncate mt-0.5">{bits.join(' · ')}</div>}
                </div>
                <div className="flex-shrink-0 w-[92px] text-xs text-right text-navy-400 whitespace-nowrap">{formatDate(task.due_date)}</div>
                <div className="flex-shrink-0">
                    <InlineStatusPill taskId={task.id} currentStatus={task.status} onChanged={(s) => onStatusChanged(task.id, s)} />
                </div>
            </div>
        );
    };

    const restByStatus = OPEN_STATUS_ORDER
        .map(s => ({ s, label: t(`task_status.${s}`), color: STATUSES[s]?.color || '#999', items: rest.filter(tk => tk.status === s) }))
        .filter(g => g.items.length > 0);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 md:gap-3">
                <Stat icon={<Inbox className="w-4 h-4" />} n={tasks.length} label={t('dashboard.open_label')} color="#60A5FA" />
                <Stat icon={<AlertTriangle className="w-4 h-4" />} n={urgentCount} label={t('dashboard.urgent_label')} color="#F87171" />
                <Stat icon={<Ban className="w-4 h-4" />} n={blockedCount} label={t('task_status.blocat')} color="#F87171" />
            </div>

            <div>
                <div className="flex items-baseline gap-2 mb-2 px-1">
                    <h3 className="text-base font-bold">{t('dashboard.focus_title')}</h3>
                    <span className="text-xs text-navy-400">{t('dashboard.focus_subtitle')}</span>
                </div>
                <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl overflow-hidden">
                    {focus.length === 0 ? (
                        <div className="text-center py-8 text-navy-400 text-sm">{t('dashboard.focus_none')}</div>
                    ) : (
                        focus.map((task, i) => <FocusRow key={task.id} task={task} rank={i + 1} />)
                    )}
                </div>
            </div>

            {rest.length > 0 && (
                <div>
                    <button
                        onClick={() => setExpanded(e => !e)}
                        className={`w-full flex items-center gap-2 px-4 py-3 bg-navy-900/50 border border-navy-700/50 ${expanded ? 'rounded-t-xl' : 'rounded-xl'} hover:bg-navy-800/40 transition-colors text-left`}
                    >
                        <span className="text-sm font-semibold">{t('dashboard.focus_rest')}</span>
                        <span className="text-xs text-navy-400 bg-navy-800/60 rounded-full px-2 py-0.5">{rest.length}</span>
                        <ChevronDown className={`w-4 h-4 text-navy-400 ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {expanded && (
                        <div className="border border-t-0 border-navy-700/50 rounded-b-xl overflow-hidden">
                            {restByStatus.map(g => (
                                <div key={g.s}>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-navy-800/30 text-[11px] font-bold uppercase tracking-wide">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                                        <span style={{ color: g.color }}>{g.label}</span>
                                        <span className="text-navy-500">({g.items.length})</span>
                                    </div>
                                    {g.items.map(task => <RestRow key={task.id} task={task} />)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function Stat({ icon, n, label, color }: { icon: React.ReactNode; n: number; label: string; color: string }) {
    return (
        <div className="bg-navy-900/50 border border-navy-700/50 rounded-lg px-3 py-2 flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}22`, color }}>{icon}</span>
            <div className="min-w-0">
                <div className="text-xl font-bold leading-none">{n}</div>
                <div className="text-[10px] text-navy-400 truncate mt-0.5">{label}</div>
            </div>
        </div>
    );
}
