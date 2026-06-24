import React, { useState } from 'react';
import { STATUSES, TaskStatus } from '../../../types';
import { useTranslation } from '../../../i18n/I18nContext';
import { DashboardViewProps, OPEN_STATUS_ORDER, getUrgency, TaskLine } from './viewHelpers';

type TabKey = 'toate' | TaskStatus;

/**
 * Tabs view (PRP 005): status tabs with count badges. Only one short list shows
 * at a time, so the user sees every bucket's size without scrolling and reaches
 * any task in one tap — no long stacked page.
 */
export default function TabsView({ tasks, onOpenTask, onStatusChanged, isFullTemplate }: DashboardViewProps) {
    const { t } = useTranslation();
    const [tab, setTab] = useState<TabKey>('toate');

    const countFor = (k: TabKey) => (k === 'toate' ? tasks.length : tasks.filter(tk => tk.status === k).length);
    const urgentCount = tasks.filter(tk => { const u = getUrgency(tk); return u === 'overdue' || u === 'today'; }).length;
    const visible = tab === 'toate' ? tasks : tasks.filter(tk => tk.status === tab);

    const tabDefs: { key: TabKey; label: string; color: string | null }[] = [
        { key: 'toate', label: t('dashboard.tab_all'), color: null },
        ...OPEN_STATUS_ORDER.map(s => ({ key: s as TabKey, label: t(`task_status.${s}`), color: STATUSES[s]?.color || null })),
    ];

    return (
        <div className="bg-navy-900/50 border border-navy-700/50 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-navy-700/50">
                <h3 className="text-sm font-semibold">{t('dashboard.my_tasks')}</h3>
                {urgentCount > 0 && (
                    <span className="text-[11px] font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-2.5 py-0.5">
                        {urgentCount} {t('dashboard.urgent_label')}
                    </span>
                )}
            </div>

            <div className="flex gap-1 p-2 overflow-x-auto border-b border-navy-700/50">
                {tabDefs.map(td => {
                    const active = tab === td.key;
                    return (
                        <button
                            key={td.key}
                            onClick={() => setTab(td.key)}
                            className={`flex items-center gap-2 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                active ? 'bg-navy-700/60 text-white' : 'text-navy-400 hover:text-white hover:bg-navy-800/40'
                            }`}
                        >
                            {td.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: td.color }} />}
                            <span style={!active && td.color ? { color: td.color } : undefined}>{td.label}</span>
                            <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${active ? 'bg-white/15 text-white' : 'bg-navy-800/60 text-navy-300'}`}>
                                {countFor(td.key)}
                            </span>
                        </button>
                    );
                })}
            </div>

            {visible.length === 0 ? (
                <div className="text-center py-10 text-navy-500 text-sm">{t('tasks.no_tasks')}</div>
            ) : (
                <div>
                    {visible.map(task => (
                        <TaskLine key={task.id} task={task} isFullTemplate={isFullTemplate} onOpenTask={onOpenTask} onStatusChanged={onStatusChanged} />
                    ))}
                </div>
            )}
        </div>
    );
}
