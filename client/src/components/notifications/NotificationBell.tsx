import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
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

export default function NotificationBell({ collapsed, darkMode }: Props) {
    const [count, setCount] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

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
        return () => clearInterval(interval);
    }, []);

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

    return (
        <div ref={ref} className="relative">
            <button
                onClick={handleOpen}
                className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all ${darkMode ? 'text-navy-300 hover:bg-navy-700/60' : 'text-gray-500 hover:bg-gray-100'}`}
            >
                <Bell className="w-4 h-4" />
                {count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center animate-pulse">
                        {count > 9 ? '9+' : count}
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
                    <div className="max-h-72 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <p className={`text-center py-8 text-sm ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}>
                                Nu ai notificări
                            </p>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n.id}
                                    onClick={() => !n.is_read && markRead(n.id)}
                                    className={`px-4 py-3 border-b last:border-0 cursor-pointer transition-colors ${
                                        n.is_read
                                            ? darkMode ? 'border-navy-700' : 'border-gray-50'
                                            : darkMode ? 'bg-blue-500/10 border-navy-700' : 'bg-blue-50 border-gray-100'
                                    }`}
                                >
                                    <p className="text-xs font-medium">{n.message}</p>
                                    {n.task_title && (
                                        <p className={`text-[10px] mt-0.5 ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}>
                                            Sarcina: {n.task_title}
                                        </p>
                                    )}
                                    <p className={`text-[10px] mt-1 ${darkMode ? 'text-navy-500' : 'text-gray-300'}`}>
                                        {new Date(n.created_at).toLocaleString('ro-RO')}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
