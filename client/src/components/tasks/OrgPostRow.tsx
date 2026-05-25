import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Settings, FileText } from 'lucide-react';
import { OrgPost, Task } from '../../types';
import UserAvatar from '../ui/UserAvatar';
import OrgTaskRowsList from './OrgTaskRowsList';
import { useTranslation } from '../../i18n/I18nContext';

interface Props {
    post: OrgPost;
    tasks: Task[];
    onTaskClick: (taskId: string) => void;
    onTaskStatusChange?: () => void;
    darkMode: boolean;
    isSuperAdmin?: boolean;
    onEditPost?: (post: OrgPost) => void;
    onPolicyClick?: (scope: string, id: string) => void;
}

export default function OrgPostRow({
    post, tasks, onTaskClick, onTaskStatusChange, darkMode, isSuperAdmin, onEditPost, onPolicyClick
}: Props) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    const taskCount = tasks.length;
    const policyCount = post.policy_count || 0;

    return (
        <div>
            {/* Post header row */}
            <button
                onClick={() => taskCount > 0 ? setExpanded(!expanded) : null}
                className={`w-full flex items-center gap-2.5 px-6 py-2.5 text-xs transition-all border-b ${
                    taskCount > 0 ? 'cursor-pointer' : 'cursor-default'
                } ${
                    darkMode
                        ? 'hover:bg-navy-800/30 border-navy-700/10'
                        : 'hover:bg-gray-50 border-gray-100'
                }`}
            >
                {/* Expand icon */}
                <div className="w-4 flex-shrink-0">
                    {taskCount > 0 && (
                        expanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-navy-400" />
                            : <ChevronRight className="w-3.5 h-3.5 text-navy-500" />
                    )}
                </div>

                {/* Post name — prominent, white text */}
                <span className={`font-semibold text-left truncate min-w-[140px] max-w-[200px] ${
                    darkMode ? 'text-white' : 'text-gray-800'
                }`}>{post.name}</span>

                {/* Separator dot */}
                {post.description && (
                    <span className={`hidden md:inline ${darkMode ? 'text-navy-500' : 'text-gray-300'}`}>·</span>
                )}

                {/* Post description — visible but secondary */}
                {post.description && (
                    <span className={`hidden md:inline text-[10px] flex-1 text-left leading-tight ${
                        darkMode ? 'text-navy-400' : 'text-gray-500'
                    }`}>
                        {post.description}
                    </span>
                )}
                {!post.description && <span className="flex-1" />}

                {/* User */}
                <div className="flex items-center gap-1.5 min-w-[120px]">
                    {post.user_name ? (
                        <>
                            <UserAvatar
                                name={post.user_name}
                                avatarUrl={post.user_avatar || null}
                                size="xs"
                            />
                            <span className={`text-xs truncate ${darkMode ? 'text-navy-200' : 'text-gray-700'}`}>
                                {post.user_name}
                            </span>
                        </>
                    ) : (
                        <span className={`text-xs italic ${darkMode ? 'text-navy-500' : 'text-gray-400'}`}>{t('org.unoccupied')}</span>
                    )}
                </div>

                {/* Task count badge — hidden when 0 to reduce visual noise */}
                {taskCount > 0 && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full min-w-[48px] text-center font-medium ${
                        darkMode ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-200'
                    }`}>
                        {taskCount} {taskCount === 1 ? t('tasks.task_count_one') : t('tasks.task_count_many')}
                    </span>
                )}

                {/* Policy count — always visible, clickable */}
                <button
                    onClick={(e) => { e.stopPropagation(); onPolicyClick?.('POST', post.id); }}
                    className={`text-[10px] flex items-center gap-0.5 hover:text-blue-400 transition-colors ${
                        policyCount > 0
                            ? darkMode ? 'text-blue-400' : 'text-blue-500'
                            : darkMode ? 'text-navy-600 hover:text-navy-400' : 'text-gray-300 hover:text-gray-500'
                    }`}
                    title={policyCount === 1 ? t('org.policy_count_one', { count: policyCount }) : t('org.policy_count_many', { count: policyCount })}
                >
                    <FileText className="w-3 h-3" />
                    {policyCount > 0 ? policyCount : ''}
                </button>

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
