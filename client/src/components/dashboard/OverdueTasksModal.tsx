import { useEffect, useMemo, useState } from 'react';
import { X, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { tasksApi } from '../../services/api';
import { Task, STATUSES } from '../../types';
import { formatDate, getDaysOverdue } from '../../utils/helpers';
import { useTranslation } from '../../i18n/I18nContext';
import UserAvatar from '../ui/UserAvatar';

interface Props {
    /** Open the task drawer for the clicked task (also closes this modal). */
    onSelectTask: (id: string) => void;
    onClose: () => void;
}

/**
 * Drill-down for the Dashboard "Depășite" stat card. Clicking the card used to
 * dump the user into the full task manager (an org-tree view for 'full'-template
 * companies) where they had to hunt for the overdue rows by hand. This modal
 * instead loads exactly the overdue tasks and lists them immediately, grouped by
 * the responsible person — matching what the "Depășite" count means.
 */
export default function OverdueTasksModal({ onSelectTask, onClose }: Props) {
    const { t } = useTranslation();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        // period=overdue is due_date < today AND status != terminat (server-side),
        // access-scoped like every list call — managers get the whole company,
        // regular users only their own, so it matches the card's count.
        tasksApi.list({ period: 'overdue', limit: 1000 })
            .then(res => { if (!cancelled) setTasks(res.tasks || res || []); })
            .catch(() => { if (!cancelled) setTasks([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    // Group by responsible person; oldest-due first inside each group, and the
    // person with the most overdue tasks on top (unassigned always last).
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
            g.tasks.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        }
        arr.sort((a, b) => {
            if (a.name === unassignedLabel) return 1;
            if (b.name === unassignedLabel) return -1;
            return b.tasks.length - a.tasks.length || a.name.localeCompare(b.name);
        });
        return arr;
    }, [tasks, t]);

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
                    <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-white">{t('dashboard.overdue_modal_title')}</h2>
                        <p className="text-xs text-navy-400">
                            {tasks.length} · {t('dashboard.overdue_modal_hint')}
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
                            {t('dashboard.overdue_modal_empty')}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {groups.map(group => (
                                <div key={group.name} className="rounded-xl overflow-hidden border border-navy-700/50 bg-navy-900/30">
                                    <div className="flex items-center gap-3 px-4 py-3 bg-navy-700/45 border-b border-navy-700/60 border-l-[3px] border-l-red-500/60">
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
                                                <span className="text-xs text-red-400 font-medium whitespace-nowrap flex-shrink-0">
                                                    {formatDate(task.due_date)}
                                                    <span className="ml-1 text-[10px]">{t('task_drawer.overdue_days', { days: getDaysOverdue(task.due_date) })}</span>
                                                </span>
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
