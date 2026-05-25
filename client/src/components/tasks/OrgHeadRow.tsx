import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Crown } from 'lucide-react';
import { Task } from '../../types';
import UserAvatar from '../ui/UserAvatar';
import OrgTaskRowsList from './OrgTaskRowsList';
import { useTranslation } from '../../i18n/I18nContext';

// Renders the row representing a department head or section head and the
// tasks assigned directly to them (assigned_department_id / assigned_section_id).
// Mirrors the visual structure of OrgPostRow so the seven-department layout
// stays consistent across post-scope and head-scope tasks.

interface Props {
    headUserName?: string | null;
    headUserAvatar?: string | null;
    tasks: Task[];
    onTaskClick: (taskId: string) => void;
    onTaskStatusChange?: () => void;
    darkMode: boolean;
    scope: 'department' | 'section';
}

export default function OrgHeadRow({
    headUserName, headUserAvatar, tasks, onTaskClick, onTaskStatusChange, darkMode, scope
}: Props) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(true);
    const taskCount = tasks.length;
    if (taskCount === 0) return null;

    const roleLabel = scope === 'department' ? t('org.dept_head') : t('org.section_head');

    return (
        <div>
            <button
                onClick={() => setExpanded(!expanded)}
                className={`w-full flex items-center gap-2.5 px-6 py-2.5 text-xs transition-all border-b cursor-pointer ${
                    darkMode
                        ? 'hover:bg-navy-800/30 border-navy-700/10'
                        : 'hover:bg-gray-50 border-gray-100'
                }`}
            >
                <div className="w-4 flex-shrink-0">
                    {expanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-navy-400" />
                        : <ChevronRight className="w-3.5 h-3.5 text-navy-500" />
                    }
                </div>

                {/* Role label — italic to distinguish from a post name */}
                <span className={`font-semibold text-left truncate min-w-[140px] max-w-[200px] italic flex items-center gap-1 ${
                    darkMode ? 'text-amber-300' : 'text-amber-600'
                }`}>
                    <Crown className="w-3 h-3 flex-shrink-0" />
                    {roleLabel}
                </span>

                <span className="flex-1" />

                {/* Head user */}
                <div className="flex items-center gap-1.5 min-w-[120px]">
                    {headUserName ? (
                        <>
                            <UserAvatar
                                name={headUserName}
                                avatarUrl={headUserAvatar || null}
                                size="xs"
                            />
                            <span className={`text-xs truncate ${darkMode ? 'text-navy-200' : 'text-gray-700'}`}>
                                {headUserName}
                            </span>
                        </>
                    ) : (
                        <span className={`text-xs italic ${darkMode ? 'text-navy-500' : 'text-gray-400'}`}>{t('org.unoccupied')}</span>
                    )}
                </div>

                {/* Task count badge */}
                <span className={`text-[10px] px-2 py-0.5 rounded-full min-w-[48px] text-center font-medium ${
                    darkMode ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-200'
                }`}>
                    {taskCount} {taskCount === 1 ? t('tasks.task_count_one') : t('tasks.task_count_many')}
                </span>
            </button>

            {expanded && (
                <OrgTaskRowsList
                    tasks={tasks}
                    onTaskClick={onTaskClick}
                    onTaskStatusChange={onTaskStatusChange}
                    darkMode={darkMode}
                />
            )}
        </div>
    );
}
