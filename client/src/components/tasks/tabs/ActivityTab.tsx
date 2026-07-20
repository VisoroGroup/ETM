import type { TaskDetail, TaskStatus, Department } from '../../../types';
import { STATUSES, DEPARTMENTS } from '../../../types';
import { timeAgo, formatDate } from '../../../utils/helpers';
import { Activity } from 'lucide-react';
import UserAvatar from '../../ui/UserAvatar';
import { useTranslation, type TFunction } from '../../../i18n/I18nContext';
import { useCompany } from '../../../hooks/useCompany';

interface Props {
    task: TaskDetail;
}

function getActionDescription(entry: any, t: TFunction, isFull: boolean): string {
    const d = entry.details || {};
    switch (entry.action_type) {
        case 'created':
            return t('activity_feed.action_created_full');
        case 'status_changed': {
            const oldLabel = STATUSES[d.old_status as TaskStatus]?.label || d.old_status;
            const newLabel = STATUSES[d.new_status as TaskStatus]?.label || d.new_status;
            if (d.reason) {
                return t('activity_feed.action_status_changed_full_with_reason', {
                    old: oldLabel,
                    new: newLabel,
                    reason: d.reason,
                });
            }
            return t('activity_feed.action_status_changed_full', { old: oldLabel, new: newLabel });
        }
        case 'due_date_changed':
            return t('activity_feed.action_due_date_changed_full', {
                old: formatDate(d.old_date),
                new: formatDate(d.new_date),
                reason: d.reason || '',
            });
        case 'comment_added':
            return t('activity_feed.action_comment_added_full');
        case 'subtask_added':
            return t('activity_feed.action_subtask_added_full', { title: d.subtask_title });
        case 'subtask_completed':
            return d.completed
                ? t('activity_feed.action_subtask_completed_full', { title: d.subtask_title })
                : t('activity_feed.action_subtask_unchecked_full', { title: d.subtask_title });
        case 'subtask_assigned':
            return t('activity_feed.action_subtask_assigned_full', {
                title: d.subtask_title,
                name: d.assigned_to_name || t('activity_feed.no_one'),
            });
        case 'attachment_added':
            return t('activity_feed.action_attachment_added_full', { name: d.file_name });
        case 'label_changed':
            // Department label — only meaningful on the 'full' template; hide for others.
            if (!isFull) return '';
            return t('activity_feed.action_label_changed_full', {
                old: DEPARTMENTS[d.old_label as Department]?.label || d.old_label,
                new: DEPARTMENTS[d.new_label as Department]?.label || d.new_label,
            });
        case 'recurring_created':
            return t('activity_feed.action_recurring_created_full', { frequency: d.frequency });
        case 'alert_added':
            return t('activity_feed.action_alert_added_full');
        case 'alert_resolved':
            return t('activity_feed.action_alert_resolved_full');
        case 'title_changed':
            return t('activity_feed.action_title_changed_full', {
                old: d.old_value,
                new: d.new_value,
            });
        case 'description_changed':
            return t('activity_feed.action_description_changed_full');
        case 'assigned_to_changed':
            if (d.new_name) return t('activity_feed.action_assigned_full', { name: d.new_name });
            return t('activity_feed.action_unassigned_full', { old: d.old_name || '—' });
        case 'department_changed':
            // Department — only meaningful on the 'full' template; hide for others.
            if (!isFull) return '';
            return t('activity_feed.action_department_changed_full', {
                old: DEPARTMENTS[d.old_value as Department]?.label || d.old_value,
                new: DEPARTMENTS[d.new_value as Department]?.label || d.new_value,
            });
        case 'task_deleted':
            return t('activity_feed.action_task_deleted_full');
        case 'task_duplicated':
            return t('activity_feed.action_task_duplicated_full');
        case 'checklist_updated':
            if (d.action === 'item_added')
                return t('activity_feed.action_checklist_item_added_full', { title: d.title });
            return t('activity_feed.action_checklist_updated_full');
        case 'dependency_added':
            return t('activity_feed.action_dependency_added_full');
        case 'dependency_removed':
            return t('activity_feed.action_dependency_removed_full');
        case 'dependency_resolved':
            return t('activity_feed.action_dependency_resolved_full');
        default:
            return entry.action_type;
    }
}

export default function ActivityTab({ task }: Props) {
    const { t } = useTranslation();
    const { activeCompany } = useCompany();
    const isFull = activeCompany?.template_type === 'full';
    return (
        <div>
            {task.activity.length > 0 ? (
                <div className="space-y-3">
                    {task.activity.map(entry => {
                        const desc = getActionDescription(entry, t, isFull);
                        // Org-department activity (label / department changes) is hidden
                        // for non-full tenants, which have no departments — skip it.
                        if (!desc) return null;
                        return (
                        <div key={entry.id} className="flex gap-2.5">
                            <div className="flex-shrink-0 mt-0.5">
                                <UserAvatar
                                    name={entry.user_name}
                                    size="xs"
                                />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs">
                                    <span className="font-medium">{entry.user_name}</span>
                                    <span className="text-navy-400"> {desc}</span>
                                </p>
                                <p className="text-[10px] text-navy-500 mt-0.5">{timeAgo(entry.created_at)}</p>
                            </div>
                        </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-8">
                    <Activity className="w-10 h-10 text-navy-700 mx-auto mb-2" />
                    <p className="text-navy-500 text-sm">{t('activity_feed.empty_inline')}</p>
                </div>
            )}
        </div>
    );
}
