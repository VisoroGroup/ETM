import { useState } from 'react';
import { alertsApi } from '../../../services/api';
import type { TaskDetail, TaskAlert } from '../../../types';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { timeAgo } from '../../../utils/helpers';
import { AlertTriangle, Plus, Trash2, ShieldCheck } from 'lucide-react';

interface Props {
    task: TaskDetail;
    taskId: string;
    onReload: () => void;
}

export default function AlertsTab({ task, taskId, onReload }: Props) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [newAlertText, setNewAlertText] = useState('');

    const activeAlerts = task.alerts?.filter((a: TaskAlert) => !a.is_resolved) ?? [];
    const resolvedAlerts = task.alerts?.filter((a: TaskAlert) => a.is_resolved) ?? [];

    async function addAlert() {
        if (!newAlertText.trim()) return;
        try {
            await alertsApi.create(taskId, newAlertText.trim());
            setNewAlertText('');
            showToast('Alertă adăugată!');
            onReload();
        } catch {
            showToast('Eroare la adăugarea alertei', 'error');
        }
    }

    async function resolveAlert(alertId: string) {
        try {
            await alertsApi.resolve(taskId, alertId);
            showToast('Alertă marcată ca rezolvată');
            onReload();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    async function deleteAlert(alertId: string) {
        try {
            await alertsApi.delete(taskId, alertId);
            showToast('Alertă ștearsă');
            onReload();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    return (
        <div className="space-y-4">
            {/* Warning banner */}
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed">
                    Adaugă lucruri <strong>critice</strong> de care trebuie să ții cont. Dacă acestea nu sunt rezolvate, pot apărea probleme grave.
                </p>
            </div>

            {/* Add new alert */}
            <div className="flex gap-2">
                <textarea
                    value={newAlertText}
                    onChange={e => setNewAlertText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addAlert(); } }}
                    rows={2}
                    placeholder="Descrie ce trebuie urmărit cu atenție..."
                    className="flex-1 px-3 py-2 bg-navy-800/50 border border-red-500/30 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-red-400/60 resize-none"
                />
                <button
                    onClick={addAlert}
                    disabled={!newAlertText.trim()}
                    className="px-3 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg transition-colors self-end disabled:opacity-30"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* Active alerts */}
            {activeAlerts.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400/70">⚠ Active ({activeAlerts.length})</p>
                    {activeAlerts.map((alert: TaskAlert) => (
                        <div key={alert.id} className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl group">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                <p className="flex-1 text-sm text-red-100 leading-relaxed">{alert.content}</p>
                            </div>
                            <div className="flex items-center justify-between mt-2 pl-6">
                                <span className="text-[10px] text-navy-500">{alert.creator_name} · {timeAgo(alert.created_at)}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button
                                        onClick={() => resolveAlert(alert.id)}
                                        title="Marchează rezolvat"
                                        className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg text-[11px] transition-colors"
                                    >
                                        <ShieldCheck className="w-3 h-3" /> Rezolvat
                                    </button>
                                    {alert.created_by === user?.id || user?.role === 'admin' ? (
                                        <button
                                            onClick={() => deleteAlert(alert.id)}
                                            className="p-1 text-navy-500 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Resolved alerts */}
            {resolvedAlerts.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-500">✓ Rezolvate ({resolvedAlerts.length})</p>
                    {resolvedAlerts.map((alert: TaskAlert) => (
                        <div key={alert.id} className="p-3 bg-navy-800/20 border border-navy-700/30 rounded-xl group opacity-60">
                            <div className="flex items-start gap-2">
                                <ShieldCheck className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                <p className="flex-1 text-sm text-navy-400 line-through leading-relaxed">{alert.content}</p>
                            </div>
                            <div className="flex items-center justify-between mt-1 pl-6">
                                <span className="text-[10px] text-navy-600">
                                    Rezolvat de {alert.resolved_by_name} · {alert.resolved_at ? timeAgo(alert.resolved_at) : ''}
                                </span>
                                {(alert.created_by === user?.id || user?.role === 'admin') && (
                                    <button
                                        onClick={() => deleteAlert(alert.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-navy-600 hover:text-red-400 transition-all"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeAlerts.length === 0 && resolvedAlerts.length === 0 && (
                <div className="text-center py-8">
                    <AlertTriangle className="w-10 h-10 text-navy-700 mx-auto mb-2" />
                    <p className="text-navy-500 text-sm">Nicio alertă înregistrată</p>
                    <p className="text-navy-600 text-xs">Adaugă lucruri critice de urmărit.</p>
                </div>
            )}
        </div>
    );
}
