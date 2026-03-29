import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
    LayoutDashboard, ListTodo, LogOut, Moon, Sun,
    ChevronLeft, ChevronRight, Bell, Shield, Mail, LayoutTemplate, Banknote, Activity, CalendarClock, CheckCircle2,
    PieChart, ChevronDown
} from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';
import ProfileModal from '../profile/ProfileModal';
import UserAvatar from '../ui/UserAvatar';

export default function Layout() {
    const { user, logout } = useAuth();
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('dark-mode');
        return saved === null ? true : saved === 'true'; // default: dark
    });
    const [showProfile, setShowProfile] = useState(false);

    // Persist dark mode
    useEffect(() => {
        localStorage.setItem('dark-mode', String(darkMode));
        document.documentElement.classList.toggle('dark', darkMode);
    }, [darkMode]);

    // Persist sidebar collapsed
    useEffect(() => {
        localStorage.setItem('sidebar-collapsed', String(collapsed));
    }, [collapsed]);

    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
    const isSuperAdmin = user?.role === 'superadmin';
    const isManagerOrAbove = isAdmin || user?.role === 'manager';

    const [financiarOpen, setFinanciarOpen] = useState(() => {
        const path = window.location.pathname;
        return path.startsWith('/financiar') || path.startsWith('/budget');
    });

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/tasks', icon: ListTodo, label: 'Sarcini' },
        { to: '/activitate', icon: Activity, label: 'Activitate' },
        { to: '/templates', icon: LayoutTemplate, label: 'Șabloane' },
        ...(isSuperAdmin ? [{ to: '/day-view', icon: CalendarClock, label: 'Napi nézet' }] : []),
        ...(isAdmin ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
        ...(isManagerOrAbove ? [{ to: '/emails', icon: Mail, label: 'Email Logs' }] : []),
        { to: '/terminate', icon: CheckCircle2, label: 'Terminate' },
    ];

    const financiarSubItems = [
        ...(isSuperAdmin ? [{ to: '/budget', icon: PieChart, label: 'Budget Tervezés' }] : []),
        ...(isAdmin ? [{ to: '/financiar', icon: Banknote, label: 'Plăți' }] : []),
    ];


    return (
        <div className={`min-h-screen flex ${darkMode ? 'bg-navy-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
            {/* Sidebar — hidden on mobile, visible md+ */}
            <aside className={`${collapsed ? 'w-16' : 'w-64'} ${darkMode ? 'bg-navy-900/80 border-navy-700/50' : 'bg-white border-gray-200'} border-r hidden md:flex flex-col transition-all duration-300 fixed h-full z-40`}>
                {/* Logo */}
                <div className={`h-16 flex items-center ${collapsed ? 'justify-center px-2' : 'px-5'} border-b ${darkMode ? 'border-navy-700/50' : 'border-gray-200'}`}>
                    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 shadow-lg">
                        <img src="/visoro-logo.png" alt="Visoro" className="w-full h-full object-cover" />
                    </div>
                    {!collapsed && (
                        <div className="ml-3 overflow-hidden flex-1">
                            <h1 className="text-sm font-bold truncate">Visoro Task Manager</h1>
                            <p className={`text-[10px] ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}>Visoro Global SRL</p>
                        </div>
                    )}
                    {/* Notification bell in sidebar header */}
                    <div className={collapsed ? 'mt-2' : 'ml-auto'}>
                        <NotificationBell collapsed={collapsed} darkMode={darkMode} />
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 px-2 space-y-1">
                    {navItems.map(({ to, icon: Icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${collapsed ? 'justify-center' : ''
                                } ${isActive
                                    ? darkMode
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'bg-blue-50 text-blue-600'
                                    : darkMode
                                        ? 'text-navy-300 hover:bg-navy-800 hover:text-white'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`
                            }
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            {!collapsed && <span>{label}</span>}
                        </NavLink>
                    ))}

                    {/* Financiar expandable submenu */}
                    {financiarSubItems.length > 0 && (
                        <>
                            <button
                                onClick={() => setFinanciarOpen(!financiarOpen)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${collapsed ? 'justify-center' : ''} ${
                                    financiarOpen
                                        ? darkMode ? 'text-blue-400 bg-blue-500/10' : 'text-blue-600 bg-blue-50/50'
                                        : darkMode ? 'text-navy-300 hover:bg-navy-800 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                            >
                                <Banknote className="w-5 h-5 flex-shrink-0" />
                                {!collapsed && (
                                    <>
                                        <span className="flex-1 text-left">Financiar</span>
                                        <ChevronDown className={`w-4 h-4 transition-transform ${financiarOpen ? 'rotate-180' : ''}`} />
                                    </>
                                )}
                            </button>
                            {financiarOpen && !collapsed && (
                                <div className="ml-4 space-y-0.5 border-l-2 border-navy-700/30 pl-2">
                                    {financiarSubItems.map(({ to, icon: Icon, label }) => (
                                        <NavLink
                                            key={to}
                                            to={to}
                                            className={({ isActive }) =>
                                                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                                    isActive
                                                        ? darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'
                                                        : darkMode ? 'text-navy-400 hover:bg-navy-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                                                }`
                                            }
                                        >
                                            <Icon className="w-4 h-4 flex-shrink-0" />
                                            <span>{label}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </nav>

                {/* Bottom section */}
                <div className={`p-3 border-t ${darkMode ? 'border-navy-700/50' : 'border-gray-200'} space-y-1`}>

                    {/* Dark mode toggle */}
                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${collapsed ? 'justify-center' : ''} ${darkMode ? 'text-navy-300 hover:bg-navy-800' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        {!collapsed && <span>{darkMode ? 'Mod luminos' : 'Mod întunecat'}</span>}
                    </button>

                    {/* Collapse toggle */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${collapsed ? 'justify-center' : ''} ${darkMode ? 'text-navy-300 hover:bg-navy-800' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                        {!collapsed && <span>Restrânge</span>}
                    </button>

                    {/* User info */}
                    {user && (
                        <div className={`mt-2 flex items-center gap-2.5 px-3 py-2.5 rounded-lg ${darkMode ? 'bg-navy-800/50' : 'bg-gray-50'}`}>
                            <button
                                onClick={() => setShowProfile(true)}
                                className="hover:opacity-80 transition-opacity"
                                title="Editează profil"
                            >
                                <UserAvatar
                                    name={user.display_name}
                                    avatarUrl={user.avatar_url}
                                    size="sm"
                                />
                            </button>
                            {!collapsed && (
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-xs font-medium truncate">{user.display_name}</p>
                                    <p className={`text-[10px] truncate ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}>{user.email}</p>
                                </div>
                            )}
                            {!collapsed && (
                                <button onClick={logout} className={`${darkMode ? 'text-navy-400 hover:text-red-400' : 'text-gray-400 hover:text-red-500'} transition-colors`}>
                                    <LogOut className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </aside>

            {/* Main content */}
            <main className={`flex-1 ml-0 ${collapsed ? 'md:ml-16' : 'md:ml-64'} transition-all duration-300 pb-16 md:pb-0 min-h-screen`} style={{ overflowX: 'clip' }}>
                <Outlet />
            </main>


            {/* Bottom Navigation — mobile only (with safe-area for notched devices) */}
            <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 border-t flex items-center justify-around px-2 py-1 safe-area-bottom ${
                darkMode ? 'bg-navy-900/95 border-navy-700/60 backdrop-blur-md' : 'bg-white/95 border-gray-200 backdrop-blur-md'
            }`}>
                {navItems.slice(0, 4).map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-medium transition-all ${
                                isActive
                                    ? darkMode ? 'text-blue-400' : 'text-blue-600'
                                    : darkMode ? 'text-navy-400' : 'text-gray-500'
                            }`
                        }
                    >
                        <Icon className="w-5 h-5" />
                        <span>{label}</span>
                    </NavLink>
                ))}
                {/* User avatar on mobile bottom nav */}
                {user && (
                    <button
                        onClick={() => setShowProfile(true)}
                        className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[10px] font-medium transition-all ${
                            darkMode ? 'text-navy-400' : 'text-gray-500'
                        }`}
                    >
                        <UserAvatar
                            name={user.display_name}
                            avatarUrl={user.avatar_url}
                            size="xs"
                        />
                        <span>Profil</span>
                    </button>
                )}
            </nav>

            {/* Profile Modal */}
            {showProfile && <ProfileModal onClose={() => setShowProfile(false)} darkMode={darkMode} />}
        </div>
    );
}
