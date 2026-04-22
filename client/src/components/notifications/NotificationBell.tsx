import React, { useState, useEffect, useRef } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../../services/api';

interface Props {
    collapsed: boolean;
    darkMode: boolean;
}

interface Notification {
    id: string;
    type: string;
    message: string;
    is_read: boolean;
    task_id: string | null;
    task_title: string | null;
    created_by_name: string | null;
    created_at: string;
}

interface GroupedNotification {
    task_id: string | null;
    task_title: string | null;
    notifications: Notification[];
    hasUnread: boolean;
    latestAt: string;
}

export default function NotificationBell({ collapsed, darkMode }: Props) {
    const [count, setCount] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const ref = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const fetchCount = async () => {
        try {
            const data = await notificationsApi.unreadCount();
            setCount(data.count);
        } catch {}
    };

    const fetchNotifications = async () => {
        try {
            const data: Notification[] = await notificationsApi.list();
            setNotifications(data);
        } catch {}
    };

    useEffect(() => {
        fetchCount();
        const interval = setInterval(fetchCount, 15000);
        // Refresh immediately when another component marks notifications read
        const handler = () => {
            fetchCount();
            if (open) fetchNotifications();
        };
        window.addEventListener('etm:notifications-updated', handler);
        return () => {
            clearInterval(interval);
            window.removeEventListener('etm:notifications-updated', handler);
        };
    }, [open]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleOpen = async () => {
        if (!open) await fetchNotifications();
        setOpen(!open);
    };

    const markAllRead = async () => {
        try {
            await notificationsApi.markAllRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setCount(0);
        } catch {}
    };

    const markRead = async (id: string) => {
        try {
            await notificationsApi.markRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setCount(prev => Math.max(0, prev - 1));
        } catch {}
    };

    const markGroupRead = async (group: GroupedNotification) => {
        const unreadIds = group.notifications.filter(n => !n.is_read).map(n => n.id);
        for (const id of unreadIds) {
            await markRead(id);
        }
    };

    // Group notifications by task_id
    const grouped: GroupedNotification[] = (() => {
        const map = new Map<string, GroupedNotification>();
        for (const n of notifications) {
            const key = n.task_id || `no-task-${n.id}`;
            if (map.has(key)) {
                const g = map.get(key)!;
                g.notifications.push(n);
                if (!n.is_read) g.hasUnread = true;
                if (n.created_at > g.latestAt) g.latestAt = n.created_at;
            } else {
                map.set(key, {
                    task_id: n.task_id,
                    task_title: n.task_title,
                    notifications: [n],
                    hasUnread: !n.is_read,
                    latestAt: n.created_at,
                });
            }
        }
        // Sort by latest notification time, unread first
        return Array.from(map.values()).sort((a, b) => {
            if (a.hasUnread !== b.hasUnread) return a.hasUnread ? -1 : 1;
            return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
        });
    })();

    const toggleGroup = (taskId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    };

    const timeAgoShort = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'acum';
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        const days = Math.floor(hrs / 24);
        return `${days}z`;
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={handleOpen}
                className={`relative flex items-center justify-center w-10 h-10 md:w-9 md:h-9 rounded-lg transition-all ${darkMode ? 'text-navy-300 hover:bg-navy-700/60' : 'text-gray-500 hover:bg-gray-100'}`}
                aria-label={count > 0 ? `Notificări (${count} necitite)` : 'Notificări'}
                title={count > 0 ? `${count} ${count === 1 ? 'notificare necitită' : 'notificări necitite'}` : 'Notificări'}
            >
                <Bell className="w-4 h-4" />
                {count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center animate-pulse ring-2 ring-navy-900">
                        {count > 99 ? '99+' : count}
                    </span>
                )}
            </button>

            {open && (
                <div className={`absolute left-full top-0 ml-2 w-80 rounded-xl shadow-2xl border z-[100] ${darkMode ? 'bg-navy-800 border-navy-600' : 'bg-white border-gray-200'}`}>
                    <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'border-navy-600' : 'border-gray-100'}`}>
                        <h3 className="text-sm font-semibold">Notificări</h3>
                        {count > 0 && (
                            <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                                Marchează toate citite
                            </button>
                        )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {grouped.length === 0 ? (
                            <p className={`text-center py-8 text-sm ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}>
                                Nu ai notificări
                            </p>
                        ) : (
                            grouped.map(group => {
                                const key = group.task_id || group.notifications[0].id;
                                const isSingle = group.notifications.length === 1;
                                const isExpanded = expandedGroups.has(key);

                                // Single notification (no task or only 1) — show directly
                                if (isSingle || !group.task_id) {
                                    const n = group.notifications[0];
                                    return (
                                        <div
                                            key={n.id}
                                            onClick={() => {
                                                if (!n.is_read) markRead(n.id);
                                                if (n.task_id) {
                                                    setOpen(false);
                                                    navigate('/tasks', { state: { openTaskId: n.task_id } });
                                                }
                                            }}
                                            className={`px-4 py-3 border-b last:border-0 cursor-pointer transition-colors ${
                                                n.is_read
                                                    ? darkMode ? 'border-navy-700 hover:bg-navy-700/40' : 'border-gray-50 hover:bg-gray-50'
                                                    : darkMode ? 'bg-amber-500/20 border-l-3 border-l-amber-400 border-b-amber-500/30 hover:bg-amber-500/25' : 'bg-amber-100 border-l-3 border-l-amber-400 border-b-amber-200 hover:bg-amber-200/50'
                                            }`}
                                        >
                                            <p className={`text-xs ${n.is_read ? 'font-normal' : 'font-semibold'}`}>{n.message}</p>
                                            {n.task_title && (
                                                <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}>
                                                    {n.task_title}
                                                </p>
                                            )}
                                            <p className={`text-[10px] mt-1 ${darkMode ? 'text-navy-500' : 'text-gray-300'}`}>
                                                {timeAgoShort(n.created_at)}
                                                {n.created_by_name && ` · ${n.created_by_name}`}
                                            </p>
                                        </div>
                                    );
                                }

                                // Grouped notifications for same task
                                const unreadCount = group.notifications.filter(n => !n.is_read).length;
                                return (
                                    <div key={key} className={`border-b last:border-0 ${
                                        group.hasUnread
                                            ? darkMode ? 'bg-amber-500/20 border-l-3 border-l-amber-400 border-b-amber-500/30' : 'bg-amber-100 border-l-3 border-l-amber-400 border-b-amber-200'
                                            : darkMode ? 'border-navy-700' : 'border-gray-50'
                                    }`}>
                                        {/* Group header */}
                                        <div
                                            className="px-4 py-3 cursor-pointer flex items-center gap-2 hover:bg-navy-700/30 transition-colors"
                                            onClick={() => toggleGroup(key)}
                                        >
                                            <ChevronRight className={`w-3 h-3 text-navy-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs truncate ${group.hasUnread ? 'font-semibold' : 'font-normal'}`}>
                                                    {group.task_title}
                                                </p>
                                                <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}>
                                                    {group.notifications.length} notificăr{group.notifications.length === 1 ? 'e' : 'i'}
                                                    {unreadCount > 0 && ` · ${unreadCount} necitit${unreadCount === 1 ? 'ă' : 'e'}`}
                                                </p>
                                            </div>
                                            <span className={`text-[10px] flex-shrink-0 ${darkMode ? 'text-navy-500' : 'text-gray-300'}`}>
                                                {timeAgoShort(group.latestAt)}
                                            </span>
                                        </div>

                                        {/* Expanded: show individual notifications */}
                                        {isExpanded && (
                                            <div className={`pl-6 ${darkMode ? 'bg-navy-900/30' : 'bg-gray-50/50'}`}>
                                                {/* Mark group read + open task */}
                                                <div className="flex items-center gap-2 px-4 py-1.5">
                                                    {group.hasUnread && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); markGroupRead(group); }}
                                                            className="text-[10px] text-blue-400 hover:text-blue-300"
                                                        >
                                                            Marchează citite
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpen(false);
                                                            navigate('/tasks', { state: { openTaskId: group.task_id } });
                                                        }}
                                                        className="text-[10px] text-blue-400 hover:text-blue-300 ml-auto"
                                                    >
                                                        Deschide sarcina →
                                                    </button>
                                                </div>
                                                {group.notifications.map(n => (
                                                    <div
                                                        key={n.id}
                                                        onClick={() => {
                                                            if (!n.is_read) markRead(n.id);
                                                            if (n.task_id) {
                                                                setOpen(false);
                                                                navigate('/tasks', { state: { openTaskId: n.task_id } });
                                                            }
                                                        }}
                                                        className={`px-4 py-2 cursor-pointer transition-colors border-t ${
                                                            n.is_read
                                                                ? darkMode ? 'border-navy-700/50 hover:bg-navy-700/30' : 'border-gray-100 hover:bg-gray-50'
                                                                : darkMode ? 'border-amber-500/20 bg-amber-500/15 hover:bg-amber-500/20' : 'border-amber-200 bg-amber-100/80 hover:bg-amber-100'
                                                        }`}
                                                    >
                                                        <p className={`text-[11px] ${n.is_read ? 'font-normal text-navy-300' : 'font-medium'}`}>{n.message}</p>
                                                        <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-navy-500' : 'text-gray-300'}`}>
                                                            {timeAgoShort(n.created_at)}
                                                            {n.created_by_name && ` · ${n.created_by_name}`}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
