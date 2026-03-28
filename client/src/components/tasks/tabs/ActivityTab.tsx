import type { TaskDetail, TaskStatus, Department } from '../../../types';
import { STATUSES, DEPARTMENTS } from '../../../types';
import { timeAgo, formatDate } from '../../../utils/helpers';
import { Activity } from 'lucide-react';
import UserAvatar from '../../ui/UserAvatar';

interface Props {
    task: TaskDetail;
}

function getActionDescription(entry: any): string {
    const d = entry.details || {};
    switch (entry.action_type) {
        case 'created': return `a creat task-ul`;
        case 'status_changed':
            return `a schimbat statusul din "${STATUSES[d.old_status as TaskStatus]?.label || d.old_status}" în "${STATUSES[d.new_status as TaskStatus]?.label || d.new_status}"${d.reason ? ` — Motiv: ${d.reason}` : ''}`;
        case 'due_date_changed':
            return `a schimbat data limită din ${formatDate(d.old_date)} în ${formatDate(d.new_date)} — Motiv: ${d.reason}`;
        case 'comment_added': return `a adăugat un comentariu`;
        case 'subtask_added': return `a adăugat subtask-ul "${d.subtask_title}"`;
        case 'subtask_completed': return `a ${d.completed ? 'completat' : 'debifat'} subtask-ul "${d.subtask_title}"`;
        case 'subtask_assigned': return `a asignat subtask-ul "${d.subtask_title}" lui ${d.assigned_to_name || 'nimeni'}`;
        case 'attachment_added': return `a atașat fișierul "${d.file_name}"`;
        case 'label_changed': return `a schimbat departamentul din "${DEPARTMENTS[d.old_label as Department]?.label}" în "${DEPARTMENTS[d.new_label as Department]?.label}"`;
        case 'recurring_created': return `a setat task-ul ca recurent (${d.frequency})`;
        case 'alert_added': return `a adăugat o alertă în "În Atenție"`;
        case 'alert_resolved': return `a rezolvat o alertă din "În Atenție"`;
        case 'title_changed': return `a modificat titlul: „${d.old_value}" → „${d.new_value}"`;
        case 'description_changed': return `a modificat descrierea`;
        case 'assigned_to_changed':
            if (d.new_name) return `a atribuit sarcina lui ${d.new_name}`;
            return `a eliminat atribuirea (era: ${d.old_name || '—'})`;
        case 'department_changed':
            return `a mutat sarcina: ${DEPARTMENTS[d.old_value as Department]?.label || d.old_value} → ${DEPARTMENTS[d.new_value as Department]?.label || d.new_value}`;
        case 'task_deleted': return `a șters sarcina`;
        case 'task_duplicated': return `a duplicat sarcina`;
        case 'checklist_updated':
            if (d.action === 'item_added') return `a adăugat în checklist: „${d.title}"`;
            return `a actualizat checklist-ul`;
        case 'dependency_added': return `a adăugat o dependență`;
        case 'dependency_removed': return `a eliminat o dependență`;
        case 'dependency_resolved': return `a rezolvat o dependență`;
        default: return entry.action_type;
    }
}

export default function ActivityTab({ task }: Props) {
    return (
        <div>
            {task.activity.length > 0 ? (
                <div className="space-y-3">
                    {task.activity.map(entry => (
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
                                    <span className="text-navy-400"> {getActionDescription(entry)}</span>
                                </p>
                                <p className="text-[10px] text-navy-500 mt-0.5">{timeAgo(entry.created_at)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8">
                    <Activity className="w-10 h-10 text-navy-700 mx-auto mb-2" />
                    <p className="text-navy-500 text-sm">Nicio activitate încă</p>
                </div>
            )}
        </div>
    );
}
