import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { STATUSES, TaskStatus } from '../../types';
import { tasksApi } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { ChevronDown, X } from 'lucide-react';
import { useTranslation } from '../../i18n/I18nContext';

interface Props {
    taskId: string;
    currentStatus: TaskStatus;
    onChanged?: (newStatus: TaskStatus) => void;
    /** If true, the pill looks exactly like a static status pill (no chevron) — used inside rows */
    compact?: boolean;
}

/**
 * Inline status changer for task rows.
 * Click → dropdown with the four statuses.
 * Selecting "blocat" opens a small prompt for the reason (required by the API).
 */
export default function InlineStatusPill({ taskId, currentStatus, onChanged, compact }: Props) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pendingBlocat, setPendingBlocat] = useState(false);
    const [reason, setReason] = useState('');
    const [status, setStatus] = useState<TaskStatus>(currentStatus);
    // The dropdown is rendered in a portal (document.body) with fixed positioning,
    // because the task-row containers clip absolute children via overflow-hidden
    // (e.g. the dashboard section cards) — the menu would be cut off on last rows.
    const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const { showToast } = useToast();
    const { t } = useTranslation();

    useEffect(() => setStatus(currentStatus), [currentStatus]);

    function closeMenu() {
        setOpen(false);
        setPendingBlocat(false);
        setReason('');
    }

    function toggleOpen() {
        if (open) {
            closeMenu();
            return;
        }
        const rect = wrapRef.current?.getBoundingClientRect();
        if (!rect) return;
        const right = window.innerWidth - rect.right;
        // Not enough room below the pill → open the menu upward instead.
        const spaceBelow = window.innerHeight - rect.bottom;
        setMenuPos(spaceBelow < 240
            ? { bottom: window.innerHeight - rect.top + 4, right }
            : { top: rect.bottom + 4, right });
        setOpen(true);
    }

    useEffect(() => {
        if (!open) return;
        function onDocClick(e: MouseEvent) {
            const target = e.target as Node;
            if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
            closeMenu();
        }
        // The fixed-position menu would detach from its pill when the page
        // scrolls or resizes — close it instead of tracking the anchor.
        function onScroll(e: Event) {
            if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
            closeMenu();
        }
        document.addEventListener('mousedown', onDocClick);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', closeMenu);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', closeMenu);
        };
    }, [open]);

    const statusKeys: TaskStatus[] = ['de_rezolvat', 'in_realizare', 'blocat', 'terminat'];

    async function apply(newStatus: TaskStatus, reasonArg?: string) {
        if (saving) return;
        if (newStatus === 'blocat' && !reasonArg) {
            setPendingBlocat(true);
            return;
        }
        try {
            setSaving(true);
            await tasksApi.changeStatus(taskId, newStatus, reasonArg);
            setStatus(newStatus);
            setOpen(false);
            setPendingBlocat(false);
            setReason('');
            showToast(`${t('common.status')}: ${t(`task_status.${newStatus}`)}`);
            onChanged?.(newStatus);
        } catch {
            showToast(t('tasks.try_again'), 'error');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            ref={wrapRef}
            className="relative inline-block"
            onClick={(e) => e.stopPropagation()} // prevent row click when interacting with the pill
        >
            <button
                type="button"
                onClick={toggleOpen}
                disabled={saving}
                aria-label={t('tasks.change_status_aria', { current: t(`task_status.${status}`) })}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all hover:brightness-125 cursor-pointer"
                style={{
                    backgroundColor: `${STATUSES[status]?.color}20`,
                    color: STATUSES[status]?.color
                }}
            >
                {t(`task_status.${status}`)}
                {!compact && <ChevronDown className="w-2.5 h-2.5 opacity-70" />}
            </button>

            {open && !pendingBlocat && menuPos && createPortal(
                <div
                    ref={menuRef}
                    style={{ position: 'fixed', ...menuPos }}
                    className="z-50 min-w-[160px] py-1 bg-navy-900 border border-navy-700 rounded-lg shadow-2xl"
                >
                    {statusKeys.map(s => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => apply(s)}
                            disabled={saving}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                                s === status ? 'bg-navy-800/60' : 'hover:bg-navy-800'
                            }`}
                        >
                            <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: STATUSES[s].color }}
                            />
                            <span style={{ color: STATUSES[s].color }}>{t(`task_status.${s}`)}</span>
                            {s === status && <span className="ml-auto text-[9px] text-navy-400">{t('tasks.current')}</span>}
                        </button>
                    ))}
                </div>,
                document.body
            )}

            {open && pendingBlocat && menuPos && createPortal(
                <div
                    ref={menuRef}
                    style={{ position: 'fixed', ...menuPos }}
                    className="z-50 w-64 p-3 bg-navy-900 border border-navy-700 rounded-lg shadow-2xl"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-orange-400">{t('tasks.block_reason')} *</span>
                        <button
                            type="button"
                            onClick={() => { setPendingBlocat(false); setReason(''); }}
                            aria-label={t('common.cancel')}
                            className="text-navy-400 hover:text-white"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        autoFocus
                        rows={3}
                        placeholder={t('tasks.block_reason_placeholder')}
                        className="w-full px-2 py-1.5 bg-navy-800/50 border border-navy-700 rounded text-xs text-white placeholder:text-navy-500 focus:outline-none focus:border-orange-500/50 resize-none"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                        <button
                            type="button"
                            onClick={() => { setPendingBlocat(false); setReason(''); }}
                            className="px-2 py-1 text-[10px] text-navy-400 hover:text-white"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={() => apply('blocat', reason.trim())}
                            disabled={!reason.trim() || saving}
                            className="px-3 py-1 text-[10px] font-medium rounded bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {saving ? t('task_form.saving') : t('tasks.block')}
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
