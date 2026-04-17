import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
    LayoutDashboard, ListTodo, LogOut, Moon, Sun,
    ChevronLeft, ChevronRight, Bell, Shield, Mail, LayoutTemplate, Banknote, Activity, CalendarClock, CheckCircle2,
    PieChart, ChevronDown, FileText, Download, MoreHorizontal, X
} from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';
import ProfileModal from '../profile/ProfileModal';
import UserAvatar from '../ui/UserAvatar';
import { safeLocalStorage } from '../../utils/storage';
import CompanyGoalBanner from './CompanyGoalBanner';

export default function Layout() {
    const { user, logout } = useAuth();
    const [collapsed, setCollapsed] = useState(() => safeLocalStorage.get('sidebar-collapsed') === 'true');
    const [darkMode, setDarkMode] = useState(() => {
        const saved = safeLocalStorage.get('dark-mode');
        return saved === null ? true : saved === 'true'; // default: dark
    });
    const [showProfile, setShowProfile] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    // Persist dark mode
    useEffect(() => {
        safeLocalStorage.set('dark-mode', String(darkMode));
        document.documentElement.classList.toggle('dark', darkMode);
    }, [darkMode]);

    // Persist sidebar collapsed
    useEffect(() => {
        safeLocalStorage.set('sidebar-collapsed', String(collapsed));
    }, [collapsed]);

    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
    const isSuperAdmin = user?.role === 'superadmin';
    const isManagerOrAbove = isAdmin || user?.role === 'manager';

    const location = useLocation();
    const isFinanciarRoute = (p: string) =>
        p.startsWith('/financiar') || p.startsWith('/budget') || p.startsWith('/client-invoices') || p.startsWith('/bank-import');

    const [financiarOpen, setFinanciarOpen] = useState(() => isFinanciarRoute(window.location.pathname));

    // Sync sidebar section with current route
    useEffect(() => {
        setFinanciarOpen(isFinanciarRoute(location.pathname));
    }, [location.pathname]);

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/tasks', icon: ListTodo, label: 'Sarcini' },
        { to: '/activitate', icon: Activity, label: 'Activitate' },
        // Templates hidden until the instantiate flow respects assigned_post_id (M6)
        // { to: '/templates', icon: LayoutTemplate, label: 'Șabloane' },
        ...(isSuperAdmin ? [{ to: '/day-view', icon: CalendarClock, label: 'Vedere zilnică' }] : []),
        ...(isAdmin ? [{ to: '/admin', icon: Shield, label: 'Administrare' }] : []),
        ...(isManagerOrAbove ? [{ to: '/emails', icon: Mail, label: 'Jurnal emailuri' }] : []),
        { to: '/terminate', icon: CheckCircle2, label: 'Terminate' },
    ];

    const financiarSubItems = [
        ...(isSuperAdmin ? [{ to: '/budget', icon: PieChart, label: 'Planificare buget' }] : []),
        ...(isAdmin ? [{ to: '/financiar', icon: Banknote, label: 'Plăți' }] : []),
        ...(isSuperAdmin ? [{ to: '/client-invoices', icon: FileText, label: 'Facturi clienți' }] : []),
        ...(isSuperAdmin ? [{ to: '/bank-import', icon: Download, label: 'Import bancar' }] : []),
    ];


    return (
        <div className={`h-screen flex overflow-hidden ${darkMode ? 'bg-navy-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
            {/* Sidebar — hidden on mobile, visible md+ */}
            <aside className={`${collapsed ? 'w-16' : 'w-64'} ${darkMode ? 'bg-navy-900 border-navy-800' : 'bg-white border-gray-200'} border-r hidden md:flex flex-col transition-all duration-300 fixed h-full z-40`}>
                {/* Logo */}
                <div className={`h-16 flex items-center ${collapsed ? 'justify-center px-2' : 'px-5'} border-b ${darkMode ? 'border-navy-800' : 'border-gray-200'}`}>
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                        <img src="/visoro-logo.png" alt="Visoro" className="w-full h-full object-cover" />
                    </div>
                    {!collapsed && (
                        <div className="ml-3 overflow-hidden flex-1">
                            <h1 className="text-base font-bold truncate tracking-tight">Sarcinator Visoro</h1>
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
                <div className={`p-3 border-t ${darkMode ? 'border-navy-800' : 'border-gray-200'} space-y-1`}>

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
                                <button
                                    onClick={() => setShowLogoutConfirm(true)}
                                    className={`${darkMode ? 'text-navy-400 hover:text-red-400' : 'text-gray-400 hover:text-red-500'} transition-colors`}
                                    title="Deconectare"
                                    aria-label="Deconectare"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </aside>

            {/* Main content */}
            <main className={`flex-1 min-w-0 ml-0 ${collapsed ? 'md:ml-16' : 'md:ml-64'} transition-all duration-300 pb-16 md:pb-0 overflow-y-auto overflow-x-hidden`}>
                <CompanyGoalBanner darkMode={darkMode} />
                <Outlet />
            </main>


            {/* Bottom Navigation — mobile only (with safe-area for notched devices) */}
            <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 border-t flex items-center justify-around px-2 py-1 safe-area-bottom ${
                darkMode ? 'bg-navy-900/95 border-navy-700/60 backdrop-blur-md' : 'bg-white/95 border-gray-200 backdrop-blur-md'
            }`}>
                {/* Show first 3 nav items + "Mai mult" + Profile */}
                {navItems.slice(0, 3).map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl text-[10px] font-medium transition-all min-w-[44px] ${
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
                {/* More menu trigger — opens a sheet with all remaining nav items */}
                {navItems.length > 3 && (
                    <button
                        onClick={() => setShowMobileMenu(true)}
                        className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl text-[10px] font-medium transition-all min-w-[44px] ${
                            darkMode ? 'text-navy-400 active:text-blue-400' : 'text-gray-500 active:text-blue-600'
                        }`}
                        aria-label="Deschide meniul complet"
                    >
                        <MoreHorizontal className="w-5 h-5" />
                        <span>Mai mult</span>
                    </button>
                )}
                {/* User avatar on mobile bottom nav */}
                {user && (
                    <button
                        onClick={() => setShowProfile(true)}
                        className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl text-[10px] font-medium transition-all min-w-[44px] ${
                            darkMode ? 'text-navy-400' : 'text-gray-500'
                        }`}
                        aria-label="Profilul meu"
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

            {/* Mobile "Mai mult" menu sheet */}
            {showMobileMenu && (
                <div
                    className="md:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowMobileMenu(false)}
                >
                    <div
                        className={`absolute bottom-0 left-0 right-0 rounded-t-2xl animate-slide-up ${
                            darkMode ? 'bg-navy-900 border-t border-navy-700' : 'bg-white border-t border-gray-200'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={`flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'border-navy-700' : 'border-gray-100'}`}>
                            <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Meniu</h3>
                            <button onClick={() => setShowMobileMenu(false)} aria-label="Închide meniul" className={darkMode ? 'text-navy-400' : 'text-gray-500'}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-3 grid grid-cols-3 gap-2 pb-safe">
                            {navItems.slice(3).map(({ to, icon: Icon, label }) => (
                                <NavLink
                                    key={to}
                                    to={to}
                                    onClick={() => setShowMobileMenu(false)}
                                    className={({ isActive }) =>
                                        `flex flex-col items-center gap-1.5 px-3 py-4 rounded-xl text-[11px] font-medium transition-all ${
                                            isActive
                                                ? darkMode ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'
                                                : darkMode ? 'bg-navy-800/50 text-navy-300 active:bg-navy-700' : 'bg-gray-50 text-gray-700 active:bg-gray-100'
                                        }`
                                    }
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="text-center">{label}</span>
                                </NavLink>
                            ))}
                            {/* Financiar submenu items for mobile */}
                            {financiarSubItems.length > 0 && financiarSubItems.map(({ to, icon: Icon, label }) => (
                                <NavLink
                                    key={to}
                                    to={to}
                                    onClick={() => setShowMobileMenu(false)}
                                    className={({ isActive }) =>
                                        `flex flex-col items-center gap-1.5 px-3 py-4 rounded-xl text-[11px] font-medium transition-all ${
                                            isActive
                                                ? darkMode ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'
                                                : darkMode ? 'bg-navy-800/50 text-navy-300 active:bg-navy-700' : 'bg-gray-50 text-gray-700 active:bg-gray-100'
                                        }`
                                    }
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="text-center">{label}</span>
                                </NavLink>
                            ))}
                        </div>
                        <div className={`px-3 pb-4 pt-2 grid grid-cols-2 gap-2 border-t ${darkMode ? 'border-navy-700/50' : 'border-gray-100'}`}>
                            <button
                                onClick={() => { setDarkMode(!darkMode); }}
                                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-medium transition-all ${
                                    darkMode ? 'bg-navy-800/50 text-navy-300 active:bg-navy-700' : 'bg-gray-50 text-gray-700 active:bg-gray-100'
                                }`}
                            >
                                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                                {darkMode ? 'Mod luminos' : 'Mod întunecat'}
                            </button>
                            <button
                                onClick={() => { setShowMobileMenu(false); setShowLogoutConfirm(true); }}
                                className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-medium bg-red-500/15 text-red-400 active:bg-red-500/25 transition-all"
                            >
                                <LogOut className="w-4 h-4" />
                                Deconectare
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Modal */}
            {showProfile && <ProfileModal onClose={() => setShowProfile(false)} darkMode={darkMode} />}

            {/* Logout confirm */}
            {showLogoutConfirm && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowLogoutConfirm(false)}
                >
                    <div
                        className={`w-full max-w-sm rounded-2xl shadow-2xl animate-slide-up ${
                            darkMode ? 'bg-navy-900 border border-navy-700/50' : 'bg-white border border-gray-200'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                                    <LogOut className="w-5 h-5 text-red-400" />
                                </div>
                                <div>
                                    <h3 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                        Deconectare
                                    </h3>
                                    <p className={`text-xs ${darkMode ? 'text-navy-400' : 'text-gray-500'}`}>
                                        Sigur vrei să te deconectezi din cont?
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        darkMode
                                            ? 'bg-navy-800/50 text-navy-300 hover:bg-navy-700/50'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    Anulează
                                </button>
                                <button
                                    onClick={() => { setShowLogoutConfirm(false); logout(); }}
                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                                    autoFocus
                                >
                                    Deconectare
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
