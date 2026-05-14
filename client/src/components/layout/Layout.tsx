import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCompany } from '../../hooks/useCompany';
import { useTranslation, TFunction } from '../../i18n/I18nContext';
import {
    LayoutDashboard, ListTodo, LogOut, Moon, Sun,
    ChevronLeft, ChevronRight, ChevronDown, Shield, Mail, Activity, CalendarClock, CheckCircle2,
    MoreHorizontal, X, Search, CalendarRange, AlertTriangle, Building2, Settings
} from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';
import ProfileModal from '../profile/ProfileModal';
import UserAvatar from '../ui/UserAvatar';
import { safeLocalStorage } from '../../utils/storage';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import CompanyGoalBanner from './CompanyGoalBanner';
import { Company, CompanyTemplateType } from '../../types';

type NavItem = { to: string; icon: any; label: string };

/**
 * Build the menu items for a single company based on its template_type and the
 * caller's role. The "full" template (Visoro Global) gets the rich legacy menu.
 * "simple" (Hungary) and "project" (Neo Plan) get a minimal task-focused set
 * that we'll grow as those companies' modules are built.
 */
function buildMenuForCompany(
    company: Company,
    role: { isAdmin: boolean; isSuperAdmin: boolean; isManagerOrAbove: boolean },
    t: TFunction
): NavItem[] {
    const tpl: CompanyTemplateType = company.template_type;
    if (tpl === 'full') {
        return [
            { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
            { to: '/tasks', icon: ListTodo, label: t('nav.tasks') },
            { to: '/search', icon: Search, label: t('nav.search') },
            { to: '/activitate', icon: Activity, label: t('nav.activity') },
            ...(role.isSuperAdmin ? [{ to: '/day-view', icon: CalendarClock, label: t('nav.day_view') }] : []),
            ...(role.isSuperAdmin ? [{ to: '/week-view', icon: CalendarRange, label: t('nav.week_view') }] : []),
            ...(role.isAdmin ? [{ to: '/admin', icon: Shield, label: t('nav.admin') }] : []),
            ...(role.isAdmin ? [{ to: '/admin/companies', icon: Building2, label: t('nav.companies') }] : []),
            ...(role.isAdmin ? [{ to: '/orfani', icon: AlertTriangle, label: t('nav.orphan_tasks') }] : []),
            ...(role.isManagerOrAbove ? [{ to: '/emails', icon: Mail, label: t('nav.email_log') }] : []),
            { to: '/terminate', icon: CheckCircle2, label: t('nav.completed') },
        ];
    }
    // 'simple' (Hungary) and 'project' (Neo Plan): per Q33+Q53 the user-visible
    // pages are tasks/day-view/week-view/terminate plus activity/notifications/
    // email-log. Day-view/week-view will be auto-rebased to user-grouping for
    // non-'full' companies (no department structure exists). Project type also
    // gets a Proiecte (PUG) entry — placeholder route for now until Phase 6.
    return [
        ...(tpl === 'project' ? [{ to: '/proiecte', icon: LayoutDashboard, label: t('nav.projects') }] : []),
        { to: '/tasks', icon: ListTodo, label: t('nav.tasks') },
        { to: '/activitate', icon: Activity, label: t('nav.activity') },
        ...(role.isSuperAdmin ? [{ to: '/day-view', icon: CalendarClock, label: t('nav.day_view') }] : []),
        ...(role.isSuperAdmin ? [{ to: '/week-view', icon: CalendarRange, label: t('nav.week_view') }] : []),
        ...(role.isManagerOrAbove ? [{ to: '/emails', icon: Mail, label: t('nav.email_log') }] : []),
        ...(tpl === 'project' && role.isAdmin ? [{ to: '/admin/pug', icon: Settings, label: t('nav.pug_config') }] : []),
        { to: '/terminate', icon: CheckCircle2, label: t('nav.completed') },
    ];
}

export default function Layout() {
    const { user, logout } = useAuth();
    const { companies, activeCompany, setActiveCompany } = useCompany();
    const { t, tFor } = useTranslation();
    const [collapsed, setCollapsed] = useState(() => safeLocalStorage.get('sidebar-collapsed') === 'true');
    const [darkMode, setDarkMode] = useState(() => {
        const saved = safeLocalStorage.get('dark-mode');
        return saved === null ? true : saved === 'true'; // default: dark
    });
    const [showProfile, setShowProfile] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    // Audit-3 H21/H24: Esc dismisses the logout confirm dialog.
    useModalDismiss(showLogoutConfirm, () => setShowLogoutConfirm(false));
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    // Per-company expanded state in the sidebar. Persisted so each user keeps
    // their preferred layout across sessions. Stored as a JSON map of
    // companyId -> boolean. Missing entries fall back to: only the active
    // company is expanded — keeps the sidebar short for users in many companies.
    const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>(() => {
        try {
            const raw = safeLocalStorage.get('sidebar-company-expanded');
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    });
    useEffect(() => {
        safeLocalStorage.set('sidebar-company-expanded', JSON.stringify(expandedCompanies));
    }, [expandedCompanies]);
    const toggleCompanyExpanded = (companyId: string, currentlyExpanded: boolean) => {
        setExpandedCompanies((prev) => ({ ...prev, [companyId]: !currentlyExpanded }));
    };
    const isCompanyExpanded = (companyId: string) =>
        expandedCompanies[companyId] ?? (companyId === activeCompany?.id);

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

    // Build company blocks: each gets its own menu in its OWN language (Q43).
    const companyBlocks = companies.map((c) => ({
        company: c,
        items: buildMenuForCompany(c, { isAdmin, isSuperAdmin, isManagerOrAbove }, tFor(c.language)),
    }));

    // Flat list of all nav items across all companies — used by the mobile bottom bar
    // (it shows the first 3 items of the active company).
    const activeBlock = companyBlocks.find((b) => b.company.id === activeCompany?.id) ?? companyBlocks[0];
    const activeItems: NavItem[] = activeBlock?.items ?? [];

    const renderCompanyHeader = (company: Company, expanded: boolean) => {
        // When the sidebar itself is collapsed (icon-only), the header is just
        // a colored dot — no toggle, since per-company sections aren't shown.
        if (collapsed) {
            return (
                <div className="flex items-center gap-2 px-3 py-2 justify-center">
                    <span
                        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: company.color }}
                        aria-hidden
                    />
                </div>
            );
        }
        return (
            <button
                type="button"
                onClick={() => toggleCompanyExpanded(company.id, expanded)}
                aria-expanded={expanded}
                aria-controls={`company-nav-${company.id}`}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${
                    darkMode ? 'hover:bg-navy-800/60' : 'hover:bg-gray-100'
                }`}
            >
                <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: company.color }}
                    aria-hidden
                />
                <span className={`text-[11px] font-semibold uppercase tracking-wider truncate flex-1 ${darkMode ? 'text-navy-400' : 'text-gray-500'}`}>
                    {company.sidebar_name}
                </span>
                <ChevronDown
                    className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${expanded ? '' : '-rotate-90'} ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}
                    aria-hidden
                />
            </button>
        );
    };

    return (
        <div className={`h-screen flex overflow-hidden ${darkMode ? 'bg-navy-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
            {/* Skip-to-main-content link (audit-3 low). Visible only on keyboard focus. */}
            <a href="#main-content" className="skip-link focus:outline-none focus:ring-2 focus:ring-blue-400 rounded">
                {t('common.skip_to_main')}
            </a>
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
                            <p className={`text-[10px] ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}>
                                {activeCompany?.name ?? t('sidebar.no_active_company')}
                            </p>
                        </div>
                    )}
                    <div className={collapsed ? 'mt-2' : 'ml-auto'}>
                        <NotificationBell collapsed={collapsed} darkMode={darkMode} />
                    </div>
                </div>

                {/* Navigation — one block per company the user can access */}
                <nav className="flex-1 py-2 overflow-y-auto">
                    {companyBlocks.length === 0 && (
                        <div className={`px-4 py-3 text-xs ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}>
                            {collapsed ? <Building2 className="w-5 h-5 mx-auto" /> : t('sidebar.no_companies')}
                        </div>
                    )}
                    {companyBlocks.map(({ company, items }, idx) => {
                        // When the whole sidebar is in icon-only mode, ignore the
                        // per-company toggle and always show items — icons take
                        // little space and there's no header label to expand.
                        const expanded = collapsed ? true : isCompanyExpanded(company.id);
                        return (
                            <div
                                key={company.id}
                                className={`${idx > 0 ? `mt-1 pt-2 border-t ${darkMode ? 'border-navy-800/60' : 'border-gray-200/70'}` : ''}`}
                            >
                                {renderCompanyHeader(company, expanded)}
                                {expanded && (
                                    <div id={`company-nav-${company.id}`} className="space-y-1 px-2">
                                        {items.map(({ to, icon: Icon, label }) => (
                                            <NavLink
                                                key={`${company.id}-${to}`}
                                                to={to}
                                                end={to === '/'}
                                                onClick={() => setActiveCompany(company.id)}
                                                className={({ isActive }) => {
                                                    const isReallyActive = isActive && company.id === activeCompany?.id;
                                                    return `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${collapsed ? 'justify-center' : ''} ${
                                                        isReallyActive
                                                            ? darkMode
                                                                ? 'bg-blue-500/20 text-blue-400'
                                                                : 'bg-blue-50 text-blue-600'
                                                            : darkMode
                                                                ? 'text-navy-300 hover:bg-navy-800 hover:text-white'
                                                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                                    }`;
                                                }}
                                            >
                                                <Icon className="w-5 h-5 flex-shrink-0" />
                                                {!collapsed && <span className="truncate">{label}</span>}
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Bottom section */}
                <div className={`p-3 border-t ${darkMode ? 'border-navy-800' : 'border-gray-200'} space-y-1`}>
                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${collapsed ? 'justify-center' : ''} ${darkMode ? 'text-navy-300 hover:bg-navy-800' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        {!collapsed && <span>{darkMode ? t('sidebar.light_mode') : t('sidebar.dark_mode')}</span>}
                    </button>

                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${collapsed ? 'justify-center' : ''} ${darkMode ? 'text-navy-300 hover:bg-navy-800' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                        {!collapsed && <span>{t('sidebar.collapse')}</span>}
                    </button>

                    {user && (
                        <div className={`mt-2 flex items-center gap-2.5 px-3 py-2.5 rounded-lg ${darkMode ? 'bg-navy-800/50' : 'bg-gray-50'}`}>
                            <button
                                onClick={() => setShowProfile(true)}
                                className="hover:opacity-80 transition-opacity"
                                title={t('sidebar.edit_profile')}
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
                                    title={t('sidebar.logout')}
                                    aria-label={t('sidebar.logout')}
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </aside>

            {/* Main content */}
            <main id="main-content" tabIndex={-1} className={`flex-1 min-w-0 ml-0 ${collapsed ? 'md:ml-16' : 'md:ml-64'} transition-all duration-300 pb-16 md:pb-0 overflow-y-auto overflow-x-hidden`}>
                {/* Mobile-only top bar — surfaces the bell + active company name.
                    Hidden on md+ because the sidebar already exposes both. */}
                <header className={`md:hidden sticky top-0 z-30 h-14 flex items-center justify-between px-4 border-b ${
                    darkMode ? 'bg-navy-900/95 border-navy-800 backdrop-blur-md' : 'bg-white/95 border-gray-200 backdrop-blur-md'
                }`}>
                    <div className="flex items-center gap-2 min-w-0">
                        <img src="/visoro-logo.png" alt="Visoro" className="w-7 h-7 rounded-lg flex-shrink-0" />
                        <p className={`text-xs font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            {activeCompany?.name ?? 'Sarcinator'}
                        </p>
                    </div>
                    <NotificationBell collapsed={true} darkMode={darkMode} />
                </header>
                <CompanyGoalBanner darkMode={darkMode} />
                <Outlet />
            </main>

            {/* Bottom Navigation — mobile only (with safe-area for notched devices) */}
            <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 border-t flex items-center justify-around px-2 py-1 safe-area-bottom ${
                darkMode ? 'bg-navy-900/95 border-navy-700/60 backdrop-blur-md' : 'bg-white/95 border-gray-200 backdrop-blur-md'
            }`}>
                {activeItems.slice(0, 3).map(({ to, icon: Icon, label }) => (
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
                {activeItems.length > 3 && (
                    <button
                        onClick={() => setShowMobileMenu(true)}
                        className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl text-[10px] font-medium transition-all min-w-[44px] ${
                            darkMode ? 'text-navy-400 active:text-blue-400' : 'text-gray-500 active:text-blue-600'
                        }`}
                        aria-label={t('common.menu')}
                    >
                        <MoreHorizontal className="w-5 h-5" />
                        <span>{t('common.more')}</span>
                    </button>
                )}
                {user && (
                    <button
                        onClick={() => setShowProfile(true)}
                        className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl text-[10px] font-medium transition-all min-w-[44px] ${
                            darkMode ? 'text-navy-400' : 'text-gray-500'
                        }`}
                        aria-label={t('sidebar.edit_profile')}
                    >
                        <UserAvatar
                            name={user.display_name}
                            avatarUrl={user.avatar_url}
                            size="xs"
                        />
                        <span>{t('nav.profile')}</span>
                    </button>
                )}
            </nav>

            {/* Mobile "Mai mult" menu sheet — shows all blocks by company */}
            {showMobileMenu && (
                <div
                    className="md:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowMobileMenu(false)}
                >
                    <div
                        className={`absolute bottom-0 left-0 right-0 rounded-t-2xl animate-slide-up max-h-[85vh] overflow-y-auto ${
                            darkMode ? 'bg-navy-900 border-t border-navy-700' : 'bg-white border-t border-gray-200'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={`flex items-center justify-between px-4 py-3 border-b sticky top-0 ${darkMode ? 'bg-navy-900 border-navy-700' : 'bg-white border-gray-100'}`}>
                            <h3 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{t('common.menu')}</h3>
                            <button onClick={() => setShowMobileMenu(false)} aria-label={t('common.close')} className={darkMode ? 'text-navy-400' : 'text-gray-500'}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {companyBlocks.map(({ company, items }) => (
                            <div key={company.id} className="px-3 pt-3">
                                <div className="flex items-center gap-2 px-2 pb-2">
                                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: company.color }} />
                                    <span className={`text-[11px] font-semibold uppercase tracking-wider ${darkMode ? 'text-navy-400' : 'text-gray-500'}`}>
                                        {company.sidebar_name}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 pb-2">
                                    {items.map(({ to, icon: Icon, label }) => (
                                        <NavLink
                                            key={`${company.id}-${to}`}
                                            to={to}
                                            onClick={() => { setActiveCompany(company.id); setShowMobileMenu(false); }}
                                            className={({ isActive }) =>
                                                `flex flex-col items-center gap-1.5 px-3 py-4 rounded-xl text-[11px] font-medium transition-all ${
                                                    isActive && company.id === activeCompany?.id
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
                            </div>
                        ))}
                        <div className={`px-3 pb-4 pt-2 mt-2 grid grid-cols-2 gap-2 border-t ${darkMode ? 'border-navy-700/50' : 'border-gray-100'}`}>
                            <button
                                onClick={() => { setDarkMode(!darkMode); }}
                                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-medium transition-all ${
                                    darkMode ? 'bg-navy-800/50 text-navy-300 active:bg-navy-700' : 'bg-gray-50 text-gray-700 active:bg-gray-100'
                                }`}
                            >
                                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                                {darkMode ? t('sidebar.light_mode') : t('sidebar.dark_mode')}
                            </button>
                            <button
                                onClick={() => { setShowMobileMenu(false); setShowLogoutConfirm(true); }}
                                className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-xs font-medium bg-red-500/15 text-red-400 active:bg-red-500/25 transition-all"
                            >
                                <LogOut className="w-4 h-4" />
                                {t('sidebar.logout')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showProfile && <ProfileModal onClose={() => setShowProfile(false)} darkMode={darkMode} />}

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
                                        {t('sidebar.logout_confirm_title')}
                                    </h3>
                                    <p className={`text-xs ${darkMode ? 'text-navy-400' : 'text-gray-500'}`}>
                                        {t('sidebar.logout_confirm_body')}
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
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={() => { setShowLogoutConfirm(false); logout(); }}
                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                                    autoFocus
                                >
                                    {t('sidebar.logout')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
