import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Settings, FileText } from 'lucide-react';
import { OrgPost, Task, TaskStatus, STATUSES } from '../../types';
import { getDueDateStatus, formatDate } from '../../utils/helpers';
import { tasksApi } from '../../services/api';
import UserAvatar from '../ui/UserAvatar';

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

// Status cycle order for quick change
const STATUS_ORDER: TaskStatus[] = ['de_rezolvat', 'in_realizare', 'terminat', 'blocat'];

function getDateColorClass(dueDateStatus: string, darkMode: boolean): string {
    switch (dueDateStatus) {
        case 'overdue': return 'text-red-400 font-semibold';
        case 'today': return 'text-amber-400 font-medium';
        case 'tomorrow': return 'text-amber-300';
        case 'soon': return 'text-yellow-300/80';
        default: return 'text-emerald-400';
    }
}

export default function OrgPostRow({
    post, tasks, onTaskClick, onTaskStatusChange, darkMode, isSuperAdmin, onEditPost, onPolicyClick
}: Props) {
    const [expanded, setExpanded] = useState(false);
    const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);

    const taskCount = tasks.length;
    const policyCount = post.policy_count || 0;

    const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
        try {
            if (newStatus === 'blocat') {
                // Blocat needs a reason — open the task drawer instead
                onTaskClick(taskId);
                setStatusDropdownId(null);
                return;
            }
            await tasksApi.changeStatus(taskId, newStatus);
            setStatusDropdownId(null);
            onTaskStatusChange?.();
        } catch (err) {
            console.error('Status change failed:', err);
        }
    };

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
                        <span className={`text-xs italic ${darkMode ? 'text-navy-500' : 'text-gray-400'}`}>Neocupat</span>
                    )}
                </div>

                {/* Task count badge */}
                <span className={`text-[10px] px-2 py-0.5 rounded-full min-w-[48px] text-center font-medium ${
                    taskCount > 0
                        ? darkMode ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-600 border border-blue-200'
                        : darkMode ? 'bg-navy-800/50 text-navy-500' : 'bg-gray-100 text-gray-400'
                }`}>
                    {taskCount} {taskCount === 1 ? 'sarcină' : 'sarcini'}
                </span>

                {/* Policy count — always visible, clickable */}
                <button
                    onClick={(e) => { e.stopPropagation(); onPolicyClick?.('POST', post.id); }}
                    className={`text-[10px] flex items-center gap-0.5 hover:text-blue-400 transition-colors ${
                        policyCount > 0
                            ? darkMode ? 'text-blue-400' : 'text-blue-500'
                            : darkMode ? 'text-navy-600 hover:text-navy-400' : 'text-gray-300 hover:text-gray-500'
                    }`}
                    title={`${policyCount} directiv${policyCount === 1 ? 'ă' : 'e'}`}
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
                <div className={`ml-10 mr-4 mb-1 rounded-lg border ${
                    darkMode ? 'border-navy-700/30 bg-navy-800/20' : 'border-gray-100 bg-gray-50/50'
                }`} style={{ overflow: 'visible' }}>
                    {tasks.map((task) => {
                        const dueDateStatus = getDueDateStatus(task.due_date);
                        const statusConfig = STATUSES[task.status];
                        const showDropdown = statusDropdownId === task.id;

                        return (
                            <div
                                key={task.id}
                                className={`flex items-center gap-2 px-3 py-2 text-xs text-left transition-all border-b last:border-b-0 ${
                                    darkMode
                                        ? 'border-navy-700/20 hover:bg-navy-700/30 text-navy-200'
                                        : 'border-gray-100 hover:bg-white text-gray-700'
                                }`}
                            >
                                {/* Status badge — clickable to change */}
                                <div className="relative flex-shrink-0">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setStatusDropdownId(showDropdown ? null : task.id);
                                        }}
                                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all hover:ring-1 hover:ring-white/20"
                                        style={{
                                            backgroundColor: statusConfig?.color + '20',
                                            color: statusConfig?.color,
                                        }}
                                        title="Schimbă statutul"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusConfig?.color }} />
                                        {statusConfig?.label}
                                    </button>

                                    {/* Status dropdown */}
                                    {showDropdown && (
                                        <div className={`absolute top-full left-0 mt-1 rounded-lg shadow-2xl border py-1 min-w-[140px] ${
                                            darkMode ? 'bg-navy-800 border-navy-600' : 'bg-white border-gray-200'
                                        }`} style={{ zIndex: 9999 }}>
                                            {STATUS_ORDER.map(s => {
                                                const sc = STATUSES[s];
                                                const isActive = task.status === s;
                                                return (
                                                    <button
                                                        key={s}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!isActive) handleStatusChange(task.id, s);
                                                            else setStatusDropdownId(null);
                                                        }}
                                                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-all ${
                                                            isActive
                                                                ? darkMode ? 'bg-navy-700/50 text-white' : 'bg-gray-100 text-gray-900'
                                                                : darkMode ? 'text-navy-300 hover:bg-navy-700/30' : 'text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.color }} />
                                                        {sc.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Task title — clickable to open */}
                                <button
                                    onClick={() => onTaskClick(task.id)}
                                    className="flex-1 truncate text-left hover:underline"
                                >
                                    {task.title}
                                </button>

                                {/* Due date — color coded */}
                                <span className={`text-[10px] flex-shrink-0 ${getDateColorClass(dueDateStatus, darkMode)}`}>
                                    {formatDate(task.due_date)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Close dropdown when clicking outside */}
            {statusDropdownId && (
                <div className="fixed inset-0 z-20" onClick={() => setStatusDropdownId(null)} />
            )}
        </div>
    );
}
