import React, { useState, useEffect, useRef } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../../services/api';
import { useTranslation } from '../../i18n/I18nContext';
import { useCompany } from '../../hooks/useCompany';

interface Props {
    collapsed: boolean;
    darkMode: boolean;
}

interface Notification {
    id: string;
    company_id: number;
    type: string;
    /** Legacy pre-rendered Romanian text. Kept as fallback for rows that
     *  predate the structured `payload` migration (084). */
    message: string;
    /** Structured ingredients for client-side localization. When present,
     *  the bell looks up `notif.msg_<type>` and interpolates the payload. */
    payload?: Record<string, string | number> | null;
    is_read: boolean;
    task_id: string | null;
    task_title: string | null;
    created_by_name: string | null;
    created_at: string;
}

interface GroupedNotification {
    task_id: string | null;
    task_title: string | null;
    company_id: number;
    notifications: Notification[];
    hasUnread: boolean;
    latestAt: string;
}

export default function NotificationBell({ collapsed, darkMode }: Props) {
    const { t } = useTranslation();
    const { companies, activeCompany, setActiveCompany } = useCompany();

    // Switch the active company before opening a task whose notification
    // belongs to a different company. Without this, the task fetch on the
    // tasks page would 404 (it filters by active company). Safe to call
    // even when the IDs match — the hook noops if the value is unchanged.
    const ensureActiveCompany = (companyId: number) => {
        if (activeCompany?.id !== companyId) setActiveCompany(companyId);
    };
    const [count, setCount] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [onlyUnread, setOnlyUnread] = useState(false);
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
        // Pause the 15s poll while the tab is hidden — running it in the
        // background just drains the battery and burns server CPU without
        // anyone seeing the badge.
        let interval: ReturnType<typeof setInterval> | null = null;
        const start = () => {
            if (interval == null) interval = setInterval(fetchCount, 15000);
        };
        const stop = () => {
            if (interval != null) {
                clearInterval(interval);
                interval = null;
            }
        };
        if (!document.hidden) start();

        const visibilityHandler = () => {
            if (document.hidden) {
                stop();
            } else {
                fetchCount(); // catch up immediately
                start();
            }
        };
        document.addEventListener('visibilitychange', visibilityHandler);

        // Refresh immediately when another component marks notifications read
        const handler = () => {
            fetchCount();
            if (open) fetchNotifications();
        };
        window.addEventListener('etm:notifications-updated', handler);
        return () => {
            stop();
            document.removeEventListener('visibilitychange', visibilityHandler);
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
                    company_id: n.company_id,
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

    // "Doar necitite" filter: when on, hide groups that are fully read.
    const displayed = onlyUnread ? grouped.filter(g => g.hasUnread) : grouped;

    // Look up a notification's company by its company_id.
    const companyForId = (companyId: number) => companies.find(c => c.id === companyId);

    // Company indicator: a borderless colored dot + name (cleaner than a boxed
    // pill). The dot always carries the company colour; the name is coloured on
    // unread rows and muted on read rows, so read/unread stays the dominant cue.
    const companyChip = (companyId: number, unread: boolean) => {
        const c = companyForId(companyId);
        if (!c) return null;
        return (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                <span style={unread ? { color: c.color } : undefined} className={unread ? '' : (darkMode ? 'text-navy-500' : 'text-gray-400')}>
                    {c.sidebar_name}
                </span>
            </span>
        );
    };

    const toggleGroup = (taskId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    };

    // Render a notification's message text. Prefer the structured payload
    // (looked up by `notif.msg_<type>`) so the text follows the viewer's
    // locale; fall back to the pre-rendered Romanian `message` for legacy
    // rows that predate migration 084.
    const renderMessage = (n: Notification): string => {
        if (n.payload && typeof n.payload === 'object') {
            const key = `notif.msg_${n.type}`;
            const translated = t(key, n.payload as Record<string, string | number>);
            // `t()` returns the raw key if missing in both target language and
            // the RO fallback, so detect that and fall back to message.
            if (translated && translated !== key) return translated;
        }
        return n.message;
    };

    const timeAgoShort = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return t('notif.now');
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        const days = Math.floor(hrs / 24);
        return `${days}${t('notif.days_short')}`;
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={handleOpen}
                className={`relative flex items-center justify-center w-10 h-10 md:w-9 md:h-9 rounded-lg transition-all ${darkMode ? 'text-navy-300 hover:bg-navy-700/60' : 'text-gray-500 hover:bg-gray-100'}`}
                aria-label={count > 0 ? t('notif.aria_with_unread', { count }) : t('notif.title')}
                title={count > 0 ? (count === 1 ? t('notif.title_count_one', { count }) : t('notif.title_count_many', { count })) : t('notif.title')}
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
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            {t('notif.title')}
                            {count > 0 && (
                                <span className="text-[10px] font-bold bg-blue-500 text-white rounded-full px-1.5 py-0.5">
                                    {count} {t('notif.new_short')}
                                </span>
                            )}
                        </h3>
                        <div className="flex items-center gap-2.5">
                            <button
                                onClick={() => setOnlyUnread(v => !v)}
                                className={`text-[11px] rounded-full px-2 py-0.5 border transition-colors ${
                                    onlyUnread
                                        ? 'text-blue-300 bg-blue-500/15 border-blue-500/40'
                                        : darkMode ? 'text-navy-400 border-navy-600 hover:text-navy-200' : 'text-gray-400 border-gray-200 hover:text-gray-600'
                                }`}
                            >
                                {t('notif.only_unread')}
                            </button>
                            {count > 0 && (
                                <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                                    {t('notif.mark_all_read')}
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {displayed.length === 0 ? (
                            <p className={`text-center py-8 text-sm ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}>
                                {t('notif.empty')}
                            </p>
                        ) : (
                            displayed.map((group, idx) => {
                                const key = group.task_id || group.notifications[0].id;
                                // Section divider: "Necitite" before the first unread group, "Citite"
                                // at the unread→read boundary — the two are physically separated.
                                const sectionHeader =
                                    idx === 0 && group.hasUnread ? (
                                        <div key="hdr-unread" className={`px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-blue-300' : 'text-blue-500'}`}>
                                            {t('notif.section_unread')}
                                        </div>
                                    ) : (!group.hasUnread && (idx === 0 || displayed[idx - 1].hasUnread)) ? (
                                        <div key="hdr-read" className={`px-4 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-wider border-t ${darkMode ? 'text-navy-500 border-navy-700/60' : 'text-gray-400 border-gray-100'}`}>
                                            {t('notif.section_read')}
                                        </div>
                                    ) : null;
                                const isSingle = group.notifications.length === 1;
                                const isExpanded = expandedGroups.has(key);

                                // Single notification (no task or only 1) — show directly
                                if (isSingle || !group.task_id) {
                                    const n = group.notifications[0];
                                    return (
                                        <React.Fragment key={n.id}>
                                        {sectionHeader}
                                        <div
                                            onClick={() => {
                                                if (!n.is_read) markRead(n.id);
                                                if (n.task_id) {
                                                    ensureActiveCompany(n.company_id);
                                                    setOpen(false);
                                                    navigate('/tasks', { state: { openTaskId: n.task_id } });
                                                }
                                            }}
                                            className={`flex gap-2.5 px-4 py-2.5 border-b last:border-0 cursor-pointer transition-colors ${
                                                n.is_read
                                                    ? darkMode ? 'border-navy-700/60 hover:bg-navy-800/40' : 'border-gray-100 hover:bg-gray-50'
                                                    : `border-l-[3px] border-l-blue-400 bg-blue-500/[0.1] ${darkMode ? 'border-navy-700/60 hover:bg-blue-500/[0.14]' : 'border-gray-100 hover:bg-blue-50'}`
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div>{companyChip(n.company_id, !n.is_read)}</div>
                                                <p className={`text-xs ${n.is_read ? (darkMode ? 'font-normal text-navy-400' : 'font-normal text-gray-400') : 'font-semibold text-white'}`}>{renderMessage(n)}</p>
                                                {n.task_title && (
                                                    <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}>{n.task_title}</p>
                                                )}
                                                <p className={`text-[10px] mt-1 ${darkMode ? 'text-navy-500' : 'text-gray-300'}`}>
                                                    {timeAgoShort(n.created_at)}
                                                    {n.created_by_name && ` · ${n.created_by_name}`}
                                                </p>
                                            </div>
                                            {!n.is_read && (
                                                <span className="w-2 h-2 mt-1 rounded-full bg-blue-500 flex-shrink-0" style={{ boxShadow: '0 0 0 3px rgba(59,130,246,.18)' }} />
                                            )}
                                        </div>
                                        </React.Fragment>
                                    );
                                }

                                // Grouped notifications for same task
                                const unreadCount = group.notifications.filter(n => !n.is_read).length;
                                return (
                                    <React.Fragment key={key}>
                                    {sectionHeader}
                                    <div
                                        className={`border-b last:border-0 ${
                                            group.hasUnread
                                                ? `border-l-[3px] border-l-blue-400 bg-blue-500/[0.1] ${darkMode ? 'border-navy-700/60' : 'border-gray-100'}`
                                                : darkMode ? 'border-navy-700/60' : 'border-gray-100'
                                        }`}
                                    >
                                        {/* Group header */}
                                        <div
                                            className="px-4 py-2.5 cursor-pointer flex items-start gap-2 hover:bg-navy-700/30 transition-colors"
                                            onClick={() => toggleGroup(key)}
                                        >
                                            <ChevronRight className={`w-3 h-3 text-navy-400 flex-shrink-0 mt-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                            <div className="flex-1 min-w-0">
                                                <div>{companyChip(group.company_id, group.hasUnread)}</div>
                                                <p className={`text-xs truncate ${group.hasUnread ? 'font-semibold text-white' : (darkMode ? 'font-normal text-navy-400' : 'font-normal text-gray-400')}`}>
                                                    {group.task_title}
                                                </p>
                                                <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}>
                                                    {group.notifications.length === 1 ? t('notif.count_one', { count: group.notifications.length }) : t('notif.count_many', { count: group.notifications.length })}
                                                    {unreadCount > 0 && ` · ${unreadCount === 1 ? t('notif.unread_one', { count: unreadCount }) : t('notif.unread_many', { count: unreadCount })}`}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                <span className={`text-[10px] ${darkMode ? 'text-navy-500' : 'text-gray-300'}`}>{timeAgoShort(group.latestAt)}</span>
                                                {group.hasUnread && <span className="w-2 h-2 rounded-full bg-blue-500" style={{ boxShadow: '0 0 0 3px rgba(59,130,246,.18)' }} />}
                                            </div>
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
                                                            {t('notif.mark_read')}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            ensureActiveCompany(group.company_id);
                                                            setOpen(false);
                                                            navigate('/tasks', { state: { openTaskId: group.task_id } });
                                                        }}
                                                        className="text-[10px] text-blue-400 hover:text-blue-300 ml-auto"
                                                    >
                                                        {t('notif.open_task')}
                                                    </button>
                                                </div>
                                                {group.notifications.map(n => (
                                                    <div
                                                        key={n.id}
                                                        onClick={() => {
                                                            if (!n.is_read) markRead(n.id);
                                                            if (n.task_id) {
                                                                ensureActiveCompany(n.company_id);
                                                                setOpen(false);
                                                                navigate('/tasks', { state: { openTaskId: n.task_id } });
                                                            }
                                                        }}
                                                        className={`px-4 py-2 cursor-pointer transition-colors border-t ${
                                                            n.is_read
                                                                ? darkMode ? 'border-navy-700/50 hover:bg-navy-700/30' : 'border-gray-100 hover:bg-gray-50'
                                                                : `border-l-2 border-l-blue-400 bg-blue-500/[0.12] ${darkMode ? 'border-t-navy-700/50 hover:bg-blue-500/[0.16]' : 'border-t-gray-100 hover:bg-blue-50'}`
                                                        }`}
                                                    >
                                                        <p className={`text-[11px] ${n.is_read ? 'font-normal text-navy-300' : 'font-medium'}`}>{renderMessage(n)}</p>
                                                        <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-navy-500' : 'text-gray-300'}`}>
                                                            {timeAgoShort(n.created_at)}
                                                            {n.created_by_name && ` · ${n.created_by_name}`}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    </React.Fragment>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
