import React, { useEffect, useRef, useState, type ComponentType } from 'react';
import { List, LayoutList, KanbanSquare, Rows3, Target, CalendarDays, ChevronDown } from 'lucide-react';
import { useTranslation } from '../../i18n/I18nContext';

export type DashboardViewMode = 'list' | 'tabs' | 'kanban' | 'compact' | 'focus' | 'calendar';

/** The selectable dashboard view modes (PRP 005), in display order. */
export const DASHBOARD_VIEW_MODES: DashboardViewMode[] = ['list', 'tabs', 'kanban', 'compact', 'focus', 'calendar'];

const MODES: { key: DashboardViewMode; icon: ComponentType<{ className?: string }>; labelKey: string }[] = [
    { key: 'list', icon: List, labelKey: 'dashboard.view_list' },
    { key: 'tabs', icon: LayoutList, labelKey: 'dashboard.view_tabs' },
    { key: 'kanban', icon: KanbanSquare, labelKey: 'dashboard.view_kanban' },
    { key: 'compact', icon: Rows3, labelKey: 'dashboard.view_compact' },
    { key: 'focus', icon: Target, labelKey: 'dashboard.view_focus' },
    { key: 'calendar', icon: CalendarDays, labelKey: 'dashboard.view_calendar' },
];

/**
 * Compact dropdown that lets each user pick how their dashboard task list is
 * laid out. Mirrors the InlineStatusPill click-to-open / outside-click-close
 * pattern. The selection is persisted by the parent (per-user, in user_preferences).
 */
export default function ViewModePicker({ value, onChange }: { value: DashboardViewMode; onChange: (m: DashboardViewMode) => void }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        function onDoc(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const current = MODES.find(m => m.key === value) || MODES[0];
    const CurrentIcon = current.icon;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-xs font-medium text-navy-200 hover:text-white hover:border-navy-600 transition-all"
                aria-label={t('dashboard.view_mode_label')}
                title={t('dashboard.view_mode_label')}
            >
                <CurrentIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t(current.labelKey)}</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {open && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] py-1 bg-navy-900 border border-navy-700 rounded-lg shadow-2xl">
                    {MODES.map(m => {
                        const Icon = m.icon;
                        const active = m.key === value;
                        return (
                            <button
                                key={m.key}
                                onClick={() => { onChange(m.key); setOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${
                                    active ? 'bg-navy-800/60 text-white' : 'text-navy-300 hover:bg-navy-800 hover:text-white'
                                }`}
                            >
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                <span>{t(m.labelKey)}</span>
                                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
