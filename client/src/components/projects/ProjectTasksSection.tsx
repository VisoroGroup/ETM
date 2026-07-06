import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tasksApi } from '../../services/api';
import type { Task } from '../../types';
import { STATUSES } from '../../types';
import { useTranslation } from '../../i18n/I18nContext';
import { formatDate, getDueDateStatus, getEffectiveDueDate } from '../../utils/helpers';
import { ListTodo, ArrowRight } from 'lucide-react';

interface Props {
    projectId: string;
}

// Lists tasks linked to a PUG project (tasks.pug_project_id = projectId).
// Surfaced at the bottom of ProjectDetailPage so a project becomes the centre
// of work, not a static sheet — David and Neo Plan can see "what's open on
// this project right now" without bouncing to /tasks and filtering.
export default function ProjectTasksSection({ projectId }: Props) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        tasksApi.list({ pug_project_id: projectId })
            .then(res => { if (!cancelled) setTasks(res.tasks); })
            .catch(() => { /* silent — empty list is the natural fallback */ })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [projectId]);

    function openTask(taskId: string) {
        navigate('/tasks', { state: { openTaskId: taskId } });
    }

    return (
        <div className="mt-6 p-4 bg-navy-900/30 border border-navy-700/40 rounded-xl">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-navy-100 flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-navy-400" />
                    {t('projects.tasks_section_title')}
                    <span className="text-xs text-navy-500 font-normal">({tasks.length})</span>
                </h3>
                <button
                    onClick={() => navigate('/tasks', { state: { pugProjectFilter: projectId } })}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                    {t('projects.view_all_tasks')} <ArrowRight className="w-3 h-3" />
                </button>
            </div>

            {loading ? (
                <p className="text-xs text-navy-500 py-2">{t('common.loading')}</p>
            ) : tasks.length === 0 ? (
                <p className="text-xs text-navy-500 py-4 text-center">{t('projects.tasks_empty')}</p>
            ) : (
                <div className="space-y-1">
                    {tasks.slice(0, 10).map(task => {
                        const effDue = getEffectiveDueDate(task);
                        const dueStatus = task.status !== 'terminat' ? getDueDateStatus(effDue) : 'normal';
                        return (
                            <button
                                key={task.id}
                                onClick={() => openTask(task.id)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-navy-800/40 transition-colors text-left"
                            >
                                <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: STATUSES[task.status]?.color }}
                                    title={STATUSES[task.status]?.label}
                                />
                                <span className="flex-1 text-sm text-navy-200 truncate">{task.title}</span>
                                <span className={`text-[11px] flex-shrink-0 ${
                                    dueStatus === 'overdue' ? 'text-red-400' :
                                    (dueStatus === 'today' || dueStatus === 'tomorrow' || dueStatus === 'soon') ? 'text-amber-400' :
                                    'text-navy-500'
                                }`}>
                                    {formatDate(effDue!)}
                                </span>
                                {task.assignee_name && (
                                    <span className="text-[11px] text-navy-500 max-w-[120px] truncate hidden md:inline">
                                        {task.assignee_name}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                    {tasks.length > 10 && (
                        <p className="text-xs text-navy-500 text-center pt-2">
                            {t('projects.tasks_truncated', { count: tasks.length - 10 })}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
