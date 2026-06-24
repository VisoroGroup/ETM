import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Task, TaskStatus, STATUSES, DEPARTMENTS } from '../../../types';
import { formatDate, getDueDateStatus } from '../../../utils/helpers';
import InlineStatusPill from '../../tasks/InlineStatusPill';

export type ViewUrgency = 'overdue' | 'today' | 'soon' | 'normal';

/**
 * Shared contract for the selectable dashboard task views (PRP 005). All views
 * render the same `tasks` (the user's "Sarcinile mele") but lay them out
 * differently, and all act through the same callbacks so behaviour stays
 * identical to the original list (open the drawer, change status inline).
 */
export interface DashboardViewProps {
    tasks: Task[];
    onOpenTask: (id: string) => void;
    onStatusChanged: (id: string, status: TaskStatus) => void;
    isFullTemplate: boolean;
}

/** Only open statuses appear on the dashboard (terminat is excluded server-side). */
export const OPEN_STATUS_ORDER: TaskStatus[] = ['de_rezolvat', 'in_realizare', 'blocat'];

/** Collapse the fine-grained date status into the urgency buckets the views use. */
export function getUrgency(task: Task): ViewUrgency {
    if (task.status === 'terminat' || !task.due_date) return 'normal';
    const s = getDueDateStatus(task.due_date);
    if (s === 'overdue') return 'overdue';
    if (s === 'today') return 'today';
    if (s === 'tomorrow' || s === 'soon') return 'soon';
    return 'normal';
}

/** Department · section · post — only meaningful on the 'full' template. */
export function locBits(task: Task, isFullTemplate: boolean): string[] {
    if (!isFullTemplate) return [];
    return [
        task.assigned_department_name || DEPARTMENTS[task.department_label]?.label,
        task.assigned_section_name,
        task.assigned_post_name,
    ].filter(Boolean) as string[];
}

/**
 * Dense single-line task row shared by the Tabs and Compact views. Mirrors the
 * original DashboardPage `renderTaskRow` (status-colored left border, title,
 * muted meta, due date, inline status control) so the new views feel native.
 */
export function TaskLine({ task, isFullTemplate, onOpenTask, onStatusChanged, dense }: {
    task: Task;
    isFullTemplate: boolean;
    onOpenTask: (id: string) => void;
    onStatusChanged: (id: string, status: TaskStatus) => void;
    dense?: boolean;
}) {
    const color = STATUSES[task.status]?.color || '#475569';
    const urg = getUrgency(task);
    const isOverdue = urg === 'overdue';
    const isSoon = urg === 'soon' || urg === 'today';
    const bits = locBits(task, isFullTemplate);
    return (
        <div
            data-task-row
            onClick={() => onOpenTask(task.id)}
            className={`flex items-center gap-3 px-4 ${dense ? 'py-1.5' : 'py-2.5'} border-t border-navy-700/30 cursor-pointer transition-colors hover:bg-navy-800/40 ${
                isOverdue ? 'bg-red-500/5' : isSoon ? 'bg-amber-500/5' : ''
            }`}
            style={{ borderLeft: `3px solid ${color}` }}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    {task.is_recurring && <RefreshCw className="w-3 h-3 text-cyan-400 flex-shrink-0" />}
                    <span className="font-medium text-white text-sm truncate">{task.title}</span>
                </div>
                {bits.length > 0 && <div className="text-[10.5px] text-navy-500 truncate mt-0.5">{bits.join(' · ')}</div>}
            </div>
            <div className={`flex-shrink-0 w-[92px] text-xs text-right whitespace-nowrap ${
                isOverdue ? 'text-red-400 font-semibold' : isSoon ? 'text-amber-400' : 'text-navy-400'
            }`}>
                {formatDate(task.due_date)}
            </div>
            <div className="flex-shrink-0">
                <InlineStatusPill taskId={task.id} currentStatus={task.status} onChanged={(s) => onStatusChanged(task.id, s)} />
            </div>
        </div>
    );
}
