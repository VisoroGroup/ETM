import React, { useState, useRef, useEffect } from 'react';
import { STATUSES, TaskStatus } from '../../types';
import { tasksApi } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { ChevronDown, X } from 'lucide-react';

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
    const wrapRef = useRef<HTMLDivElement>(null);
    const { showToast } = useToast();

    useEffect(() => setStatus(currentStatus), [currentStatus]);

    useEffect(() => {
        if (!open) return;
        function onDocClick(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
                setPendingBlocat(false);
                setReason('');
            }
        }
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
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
            showToast(`Status: ${STATUSES[newStatus].label}`);
            onChanged?.(newStatus);
        } catch {
            showToast('Nu a funcționat — încearcă din nou', 'error');
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
                onClick={() => setOpen(o => !o)}
                disabled={saving}
                aria-label={`Schimbă statusul (actual: ${STATUSES[status]?.label})`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all hover:brightness-125 cursor-pointer"
                style={{
                    backgroundColor: `${STATUSES[status]?.color}20`,
                    color: STATUSES[status]?.color
                }}
            >
                {STATUSES[status]?.label}
                {!compact && <ChevronDown className="w-2.5 h-2.5 opacity-70" />}
            </button>

            {open && !pendingBlocat && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] py-1 bg-navy-900 border border-navy-700 rounded-lg shadow-2xl">
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
                            <span style={{ color: STATUSES[s].color }}>{STATUSES[s].label}</span>
                            {s === status && <span className="ml-auto text-[9px] text-navy-400">actual</span>}
                        </button>
                    ))}
                </div>
            )}

            {open && pendingBlocat && (
                <div className="absolute right-0 top-full mt-1 z-50 w-64 p-3 bg-navy-900 border border-navy-700 rounded-lg shadow-2xl">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-orange-400">Motiv blocare *</span>
                        <button
                            type="button"
                            onClick={() => { setPendingBlocat(false); setReason(''); }}
                            aria-label="Anulează"
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
                        placeholder="De ce este blocat? (obligatoriu)"
                        className="w-full px-2 py-1.5 bg-navy-800/50 border border-navy-700 rounded text-xs text-white placeholder:text-navy-500 focus:outline-none focus:border-orange-500/50 resize-none"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                        <button
                            type="button"
                            onClick={() => { setPendingBlocat(false); setReason(''); }}
                            className="px-2 py-1 text-[10px] text-navy-400 hover:text-white"
                        >
                            Anulează
                        </button>
                        <button
                            type="button"
                            onClick={() => apply('blocat', reason.trim())}
                            disabled={!reason.trim() || saving}
                            className="px-3 py-1 text-[10px] font-medium rounded bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Se salvează…' : 'Blochează'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
