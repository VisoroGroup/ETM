import { useEffect, useMemo, useState } from 'react';
import { X, Activity, AlertTriangle, Ban, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { tasksApi } from '../../services/api';
import { Task, STATUSES } from '../../types';
import { formatDate, getDaysOverdue, getDueDateStatus, getEffectiveDueDate } from '../../utils/helpers';
import { useTranslation } from '../../i18n/I18nContext';
import UserAvatar from '../ui/UserAvatar';

export type StatModalKind = 'active' | 'overdue' | 'blocked' | 'completed_month';

interface Props {
    kind: StatModalKind;
    /** Open the task drawer for the clicked task (also closes this modal). */
    onSelectTask: (id: string) => void;
    onClose: () => void;
}

/**
 * Drill-down for the Dashboard stat cards (Active / Depășite / Blocate /
 * Finalizate luna aceasta). Clicking a card used to dump the user into the full
 * task manager (an org-tree view for 'full'-template companies) where they had
 * to hunt for the matching rows by hand. This modal instead loads exactly the
 * card's tasks and lists them immediately, grouped by the responsible person.
 */
export default function StatTasksModal({ kind, onSelectTask, onClose }: Props) {
    const { t } = useTranslation();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    // Per-kind config. Titles reuse the stat-card labels so the modal always
    // matches the card the user clicked.
    const CONFIG = {
        active: { titleKey: 'dashboard.stat_active', Icon: Activity, iconBg: 'bg-blue-500/20', iconColor: 'text-blue-400', accent: 'border-l-blue-500/60' },
        overdue: { titleKey: 'dashboard.stat_overdue', Icon: AlertTriangle, iconBg: 'bg-red-500/20', iconColor: 'text-red-400', accent: 'border-l-red-500/60' },
        blocked: { titleKey: 'dashboard.stat_blocked', Icon: Ban, iconBg: 'bg-orange-500/20', iconColor: 'text-orange-400', accent: 'border-l-orange-500/60' },
        completed_month: { titleKey: 'dashboard.stat_completed_this_month', Icon: CheckCircle2, iconBg: 'bg-green-500/20', iconColor: 'text-green-400', accent: 'border-l-green-500/60' },
    }[kind];

    useEffect(() => {
        let cancelled = false;
        // Each fetch mirrors the server-side /dashboard/stats definition of the
        // same number, access-scoped like every list call. completed_month has
        // no dedicated list filter (stats uses updated_at >= month start), so we
        // fetch terminat and apply the same month cut client-side.
        const params =
            kind === 'active' ? { status: 'de_rezolvat,in_realizare', limit: 1000 } :
            kind === 'overdue' ? { period: 'overdue', limit: 1000 } :
            kind === 'blocked' ? { status: 'blocat', limit: 1000 } :
            { status: 'terminat', limit: 1000 };
        tasksApi.list(params)
            .then(res => {
                if (cancelled) return;
                let list: Task[] = res.tasks || res || [];
                if (kind === 'completed_month') {
                    const monthStart = new Date();
                    monthStart.setDate(1);
                    monthStart.setHours(0, 0, 0, 0);
                    list = list.filter(task => new Date(task.updated_at) >= monthStart);
                }
                setTasks(list);
            })
            .catch(() => { if (!cancelled) setTasks([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [kind]);

    // Group by responsible person; oldest-due first inside each group, and the
    // person with the most tasks on top (unassigned always last).
    const groups = useMemo(() => {
        const unassignedLabel = t('dashboard.unassigned');
        const map = new Map<string, { name: string; avatar?: string; tasks: Task[] }>();
        for (const task of tasks) {
            const name = task.assignee_name || unassignedLabel;
            let g = map.get(name);
            if (!g) { g = { name, avatar: task.assignee_avatar ?? undefined, tasks: [] }; map.set(name, g); }
            g.tasks.push(task);
        }
        const arr = Array.from(map.values());
        for (const g of arr) {
            g.tasks.sort((a, b) => kind === 'completed_month'
                // Most recently completed first — that's what the card counts.
                ? new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                : new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        }
        arr.sort((a, b) => {
            if (a.name === unassignedLabel) return 1;
            if (b.name === unassignedLabel) return -1;
            return b.tasks.length - a.tasks.length || a.name.localeCompare(b.name);
        });
        return arr;
    }, [tasks, kind, t]);

    // Same due-date semantics as the rest of the app: blocked rows hide the
    // date (paused deadline), recurring tasks show their next occurrence, and
    // only a genuinely overdue date goes red.
    function renderDate(task: Task) {
        if (task.status === 'blocat' || !task.due_date) return null;
        const effDue = getEffectiveDueDate(task);
        const isOverdue = task.status !== 'terminat' && getDueDateStatus(effDue) === 'overdue';
        return (
            <span className={`text-xs whitespace-nowrap flex-shrink-0 ${isOverdue ? 'text-red-400 font-medium' : 'text-navy-400'}`}>
                {formatDate(effDue!)}
                {isOverdue && <span className="ml-1 text-[10px]">{t('task_drawer.overdue_days', { days: getDaysOverdue(effDue) })}</span>}
            </span>
        );
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-navy-900 border border-navy-700 rounded-2xl shadow-2xl w-full max-w-2xl my-auto animate-slide-up"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-navy-700/60">
                    <div className={`w-9 h-9 rounded-lg ${CONFIG.iconBg} flex items-center justify-center flex-shrink-0`}>
                        <CONFIG.Icon className={`w-5 h-5 ${CONFIG.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-white">{t(CONFIG.titleKey)}</h2>
                        <p className="text-xs text-navy-400">
                            {tasks.length} · {t('dashboard.stat_modal_hint')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-navy-400 hover:text-white hover:bg-navy-800 transition-colors flex-shrink-0"
                        aria-label={t('common.close')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-3 max-h-[70vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-navy-400">
                            <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="text-center py-12 text-navy-400 text-sm">
                            {t('dashboard.stat_modal_empty')}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {groups.map(group => (
                                <div key={group.name} className="rounded-xl overflow-hidden border border-navy-700/50 bg-navy-900/30">
                                    <div className={`flex items-center gap-3 px-4 py-3 bg-navy-700/45 border-b border-navy-700/60 border-l-[3px] ${CONFIG.accent}`}>
                                        <UserAvatar name={group.name} avatarUrl={group.avatar} size="sm" />
                                        <span className="text-sm font-semibold text-white tracking-tight flex-1 truncate">{group.name}</span>
                                        <span className="text-xs font-medium text-navy-200 bg-navy-900/50 rounded-full px-2 py-0.5">{group.tasks.length}</span>
                                    </div>
                                    <div>
                                        {group.tasks.map(task => (
                                            <button
                                                key={task.id}
                                                onClick={() => onSelectTask(task.id)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 border-t border-navy-700/30 first:border-t-0 text-left hover:bg-navy-800/40 transition-colors"
                                            >
                                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUSES[task.status]?.color }} />
                                                {task.is_recurring && <RefreshCw className="w-3 h-3 text-cyan-400 flex-shrink-0" />}
                                                <span className="flex-1 text-sm text-white truncate">{task.title}</span>
                                                {renderDate(task)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
