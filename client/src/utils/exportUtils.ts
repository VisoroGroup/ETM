import { Task, STATUSES, DEPARTMENTS } from '../types';
import { formatDate } from './helpers';

type Translator = (key: string, vars?: Record<string, string | number>) => string;

export function exportToCSV(
    tasks: Task[],
    filename: string = 'tasks',
    t?: Translator,
    // 'full'-template companies use the org department structure; other tenants
    // (Hungary, Neo Plan, ...) carry only a legacy default department_label, so
    // the Department column is omitted for them to avoid a misleading export.
    includeDepartment: boolean = true,
) {
    // Fall back to the previous Romanian wording if no translator is provided
    // (defensive: every caller should now pass `t`).
    const tr = t ?? ((key: string) => {
        const fallback: Record<string, string> = {
            'export.col_title': 'Titlu',
            'export.col_status': 'Status',
            'export.col_due_date': 'Data limită',
            'export.col_department': 'Departament',
            'export.col_creator': 'Creat de',
            'export.col_subtasks': 'Subtask-uri',
        };
        return fallback[key] ?? key;
    });

    const headers = [
        tr('export.col_title'),
        tr('export.col_status'),
        tr('export.col_due_date'),
        ...(includeDepartment ? [tr('export.col_department')] : []),
        tr('export.col_creator'),
        tr('export.col_subtasks'),
    ];

    const rows = tasks.map(task => [
        `"${(task.title || '').replace(/"/g, '""')}"`,
        STATUSES[task.status]?.label || task.status,
        task.due_date ? formatDate(task.due_date) : '-',
        ...(includeDepartment ? [
            task.department_label && DEPARTMENTS[task.department_label]
                ? DEPARTMENTS[task.department_label].label
                : '-'
        ] : []),
        `"${(task.creator_name || '-').replace(/"/g, '""')}"`,
        `${task.subtask_completed || 0}/${task.subtask_total || 0}`,
    ]);

    // BOM for UTF-8 so Excel opens correctly
    const bom = '\uFEFF';
    const csvContent = bom + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}
