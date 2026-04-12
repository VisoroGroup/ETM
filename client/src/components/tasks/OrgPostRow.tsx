import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Settings, FileText } from 'lucide-react';
import { OrgPost, Task, STATUSES } from '../../types';
import { getDueDateStatus, formatDate } from '../../utils/helpers';
import UserAvatar from '../ui/UserAvatar';

interface Props {
    post: OrgPost;
    tasks: Task[];
    onTaskClick: (taskId: string) => void;
    darkMode: boolean;
    isSuperAdmin?: boolean;
    onEditPost?: (post: OrgPost) => void;
}

export default function OrgPostRow({
    post, tasks, onTaskClick, darkMode, isSuperAdmin, onEditPost
}: Props) {
    const [expanded, setExpanded] = useState(false);

    const taskCount = tasks.length;
    const policyCount = post.policy_count || 0;

    return (
        <div>
            {/* Post header row */}
            <button
                onClick={() => taskCount > 0 ? setExpanded(!expanded) : null}
                className={`w-full flex items-center gap-2.5 px-6 py-2 text-xs transition-all ${
                    taskCount > 0 ? 'cursor-pointer' : 'cursor-default'
                } ${
                    darkMode
                        ? 'hover:bg-navy-800/20 text-navy-200'
                        : 'hover:bg-gray-50 text-gray-700'
                }`}
            >
                {/* Expand icon */}
                <div className="w-4 flex-shrink-0">
                    {taskCount > 0 && (
                        expanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-navy-500" />
                            : <ChevronRight className="w-3.5 h-3.5 text-navy-500" />
                    )}
                </div>

                {/* Post name */}
                <span className="font-medium flex-1 text-left truncate">{post.name}</span>

                {/* Separator — description keywords */}
                {post.description && (
                    <span className={`hidden md:inline text-[10px] max-w-[200px] truncate ${
                        darkMode ? 'text-navy-500' : 'text-gray-400'
                    }`}>
                        {post.description}
                    </span>
                )}

                {/* User */}
                <div className="flex items-center gap-1.5 min-w-[120px]">
                    {post.user_name ? (
                        <>
                            <UserAvatar
                                name={post.user_name}
                                avatarUrl={post.user_avatar || null}
                                size="xs"
                            />
                            <span className={`text-xs truncate ${darkMode ? 'text-navy-300' : 'text-gray-600'}`}>
                                {post.user_name}
                            </span>
                        </>
                    ) : (
                        <span className={`text-xs italic ${darkMode ? 'text-navy-600' : 'text-gray-300'}`}>Vacant</span>
                    )}
                </div>

                {/* Task count badge */}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full min-w-[40px] text-center ${
                    taskCount > 0
                        ? darkMode ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'
                        : darkMode ? 'bg-navy-800 text-navy-600' : 'bg-gray-100 text-gray-400'
                }`}>
                    {taskCount} task
                </span>

                {/* Policy count */}
                {policyCount > 0 && (
                    <span className={`text-[10px] flex items-center gap-0.5 ${darkMode ? 'text-navy-500' : 'text-gray-400'}`}>
                        <FileText className="w-3 h-3" />
                        {policyCount}
                    </span>
                )}

                {/* Settings gear (superadmin) */}
                {isSuperAdmin && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onEditPost?.(post); }}
                        className={`p-1 rounded transition-colors ${
                            darkMode ? 'text-navy-600 hover:text-navy-300 hover:bg-navy-700' : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <Settings className="w-3.5 h-3.5" />
                    </button>
                )}
            </button>

            {/* Expanded task list */}
            {expanded && tasks.length > 0 && (
                <div className={`ml-10 mr-4 mb-1 rounded-lg overflow-hidden border ${
                    darkMode ? 'border-navy-700/30 bg-navy-800/20' : 'border-gray-100 bg-gray-50/50'
                }`}>
                    {tasks.map((task) => {
                        const dueDateStatus = getDueDateStatus(task.due_date);
                        const statusConfig = STATUSES[task.status];

                        return (
                            <button
                                key={task.id}
                                onClick={() => onTaskClick(task.id)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-all border-b last:border-b-0 ${
                                    darkMode
                                        ? 'border-navy-700/20 hover:bg-navy-700/30 text-navy-200'
                                        : 'border-gray-100 hover:bg-white text-gray-700'
                                }`}
                            >
                                {/* Status dot */}
                                <div
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: statusConfig?.color }}
                                    title={statusConfig?.label}
                                />

                                {/* Task title */}
                                <span className="flex-1 truncate">{task.title}</span>

                                {/* Due date */}
                                <span className={`text-[10px] flex-shrink-0 ${
                                    dueDateStatus === 'overdue'
                                        ? 'text-red-400 font-medium'
                                        : dueDateStatus === 'today'
                                            ? 'text-amber-400'
                                            : darkMode ? 'text-navy-500' : 'text-gray-400'
                                }`}>
                                    {formatDate(task.due_date)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
