import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Task, STATUSES } from '../../../types';
import { formatDate, getEffectiveDueDate } from '../../../utils/helpers';
import { useTranslation } from '../../../i18n/I18nContext';
import InlineStatusPill from '../../tasks/InlineStatusPill';
import { DashboardViewProps, OPEN_STATUS_ORDER, getUrgency, locBits } from './viewHelpers';

/**
 * Kanban view (PRP 005): one column per open status, laid out horizontally so
 * every status is visible at once — nothing hides below a long vertical fold.
 * Tall columns scroll internally; the header count shows how many are inside.
 * No "Terminat" column (the dashboard only loads open tasks) and no drag-drop
 * (status is changed via the inline pill, like everywhere else).
 */
export default function KanbanView({ tasks, onOpenTask, onStatusChanged, isFullTemplate }: DashboardViewProps) {
    const { t } = useTranslation();
    const columns = OPEN_STATUS_ORDER.map(s => ({
        s,
        label: t(`task_status.${s}`),
        color: STATUSES[s]?.color || '#999',
        items: tasks.filter(tk => tk.status === s).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    }));

    const Card = ({ task, color }: { task: Task; color: string }) => {
        const urg = getUrgency(task);
        const isOverdue = urg === 'overdue';
        const isSoon = urg === 'soon' || urg === 'today';
        const bits = locBits(task, isFullTemplate);
        return (
            <div
                onClick={() => onOpenTask(task.id)}
                className="bg-navy-900 border border-navy-700/50 rounded-lg p-2.5 cursor-pointer hover:border-navy-500 hover:bg-navy-800/60 transition-colors"
                style={{ borderLeft: `3px solid ${color}` }}
            >
                <div className="flex items-start gap-1.5">
                    {task.is_recurring && <RefreshCw className="w-3 h-3 text-cyan-400 flex-shrink-0 mt-0.5" />}
                    <span className="text-[12.5px] font-medium text-white leading-snug">{task.title}</span>
                </div>
                {bits.length > 0 && <div className="text-[10px] text-navy-500 truncate mt-1.5">{bits.join(' · ')}</div>}
                <div className="flex items-center justify-between gap-2 mt-2">
                    <span className={`text-[10.5px] font-semibold whitespace-nowrap ${isOverdue ? 'text-red-400' : isSoon ? 'text-amber-400' : 'text-navy-400'}`}>
                        {formatDate(getEffectiveDueDate(task)!)}
                    </span>
                    <InlineStatusPill taskId={task.id} currentStatus={task.status} onChanged={(s) => onStatusChanged(task.id, s)} compact />
                </div>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
            {columns.map(col => (
                <div key={col.s} className="bg-navy-900/50 border border-navy-700/50 rounded-xl overflow-hidden flex flex-col" style={{ borderTop: `3px solid ${col.color}` }}>
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-navy-700/50">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                        <span className="text-xs font-bold truncate" style={{ color: col.color }}>{col.label}</span>
                        <span className="ml-auto text-[11px] font-bold text-navy-200 bg-navy-800/60 rounded-full px-2 py-0.5 flex-shrink-0">{col.items.length}</span>
                    </div>
                    <div className="p-2 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                        {col.items.length === 0 ? (
                            <div className="text-center py-6 text-navy-500 text-[11px] italic">{t('tasks.no_tasks')}</div>
                        ) : (
                            col.items.map(task => <Card key={task.id} task={task} color={col.color} />)
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
