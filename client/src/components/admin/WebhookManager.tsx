import { useState } from 'react';
import { Link2, Plus, Pencil, Trash2, Play, X, Loader2, ChevronDown, ExternalLink, RefreshCw } from 'lucide-react';
import { useWebhooks, useWebhookDeliveries, useCreateWebhook, useUpdateWebhook, useDeleteWebhook, useTestWebhook } from '../../hooks/useWebhooks';
import { useToast } from '../../hooks/useToast';
import type { WebhookSubscription, WebhookDelivery, WebhookEventType } from '../../types';

const EVENT_LABELS: Record<string, string> = {
    'task.created': 'Sarcină creată',
    'task.completed': 'Sarcină finalizată',
    'task.status_changed': 'Status sarcină modificat',
    'task.assigned': 'Sarcină atribuită',
    'task.overdue': 'Sarcină depășită',
    'payment.due_soon': 'Plată scadentă în curând',
    'payment.overdue': 'Plată depășită',
    'payment.paid': 'Plată efectuată',
};

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
    delivered: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Livrat' },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Eșuat' },
    retrying: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Reîncercare' },
    pending: { bg: 'bg-navy-600/40', text: 'text-navy-300', label: 'În așteptare' },
    sending: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Se trimite' },
};

function timeAgo(dateStr: string): string {
    const d = new Date(dateStr);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'acum';
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}z`;
}

// === Main Component ===
export default function WebhookManager() {
    const [tab, setTab] = useState<'subscriptions' | 'deliveries'>('subscriptions');
    const [showForm, setShowForm] = useState(false);
    const [editingSub, setEditingSub] = useState<WebhookSubscription | null>(null);
    const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);
    const [deliveryFilter, setDeliveryFilter] = useState<{ event_type?: string; status?: string }>({});

    const { data: webhooks = [], isLoading } = useWebhooks();
    const { data: deliveries = [], isLoading: loadingDeliveries } = useWebhookDeliveries(deliveryFilter);
    const createMut = useCreateWebhook();
    const updateMut = useUpdateWebhook();
    const deleteMut = useDeleteWebhook();
    const testMut = useTestWebhook();
    const { showToast } = useToast();

    async function handleTest(id: string) {
        try {
            const result = await testMut.mutateAsync(id);
            if (result.success) {
                showToast(`Test reușit! (HTTP ${result.status})`, 'success');
            } else {
                showToast(`Test eșuat: ${result.error || `HTTP ${result.status}`}`, 'error');
            }
        } catch {
            showToast('Eroare la test', 'error');
        }
    }

    async function handleToggle(sub: WebhookSubscription) {
        try {
            await updateMut.mutateAsync({ id: sub.id, data: { is_active: !sub.is_active } });
            showToast(sub.is_active ? 'Webhook dezactivat' : 'Webhook activat', 'success');
        } catch {
            showToast('Eroare', 'error');
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Sigur vrei să ștergi acest webhook?')) return;
        try {
            await deleteMut.mutateAsync(id);
            showToast('Webhook șters', 'success');
        } catch {
            showToast('Eroare', 'error');
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Link2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">Integrări & Webhook-uri</h2>
                        <p className="text-xs text-navy-400">Configurează notificări automate către sisteme externe</p>
                    </div>
                </div>
                {tab === 'subscriptions' && (
                    <button onClick={() => { setEditingSub(null); setShowForm(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-400 rounded-lg text-sm font-medium transition-colors">
                        <Plus className="w-4 h-4" /> Adaugă webhook
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-navy-900/50 rounded-lg p-1 w-fit">
                <button onClick={() => setTab('subscriptions')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'subscriptions' ? 'bg-navy-700 text-white' : 'text-navy-400 hover:text-white'}`}>
                    Webhook-uri ({webhooks.length})
                </button>
                <button onClick={() => setTab('deliveries')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'deliveries' ? 'bg-navy-700 text-white' : 'text-navy-400 hover:text-white'}`}>
                    Jurnal livrări
                </button>
            </div>

            {/* Tab Content */}
            {tab === 'subscriptions' ? (
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-navy-500" /></div>
                    ) : webhooks.length === 0 ? (
                        <div className="text-center py-12 bg-navy-900/30 rounded-xl border border-navy-700/50">
                            <Link2 className="w-10 h-10 text-navy-600 mx-auto mb-3" />
                            <p className="text-navy-400 text-sm">Niciun webhook configurat.</p>
                            <p className="text-navy-500 text-xs mt-1">Adaugă un webhook pentru a primi notificări automate.</p>
                        </div>
                    ) : (
                        webhooks.map((sub: WebhookSubscription) => (
                            <div key={sub.id} className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-4 transition-all hover:border-navy-600/50">
                                <div className="flex items-center gap-3">
                                    {/* Toggle */}
                                    <button onClick={() => handleToggle(sub)}
                                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${sub.is_active ? 'bg-green-500' : 'bg-navy-700'}`}>
                                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${sub.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </button>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium truncate max-w-xs" title={sub.url}>
                                                {sub.url.length > 50 ? sub.url.substring(0, 50) + '...' : sub.url}
                                            </span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
                                                {EVENT_LABELS[sub.event_type] || sub.event_type}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-[11px] text-navy-500">
                                            {sub.description && <span>{sub.description}</span>}
                                            <span>✅ {sub.success_count || 0}</span>
                                            <span>❌ {sub.fail_count || 0}</span>
                                            {sub.last_success && <span>Ultima: {timeAgo(sub.last_success)}</span>}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5">
                                        <button onClick={() => handleTest(sub.id)} disabled={testMut.isPending}
                                            className="p-1.5 rounded-lg text-navy-400 hover:text-green-400 hover:bg-green-500/10 transition-all" title="Test">
                                            {testMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                                        </button>
                                        <button onClick={() => { setEditingSub(sub); setShowForm(true); }}
                                            className="p-1.5 rounded-lg text-navy-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all" title="Editare">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(sub.id)}
                                            className="p-1.5 rounded-lg text-navy-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Șterge">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                /* Deliveries Tab */
                <div className="space-y-3">
                    {/* Filters */}
                    <div className="flex gap-3">
                        <select value={deliveryFilter.event_type || ''} onChange={e => setDeliveryFilter(f => ({ ...f, event_type: e.target.value || undefined }))}
                            className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white">
                            <option value="">Toate evenimentele</option>
                            {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <select value={deliveryFilter.status || ''} onChange={e => setDeliveryFilter(f => ({ ...f, status: e.target.value || undefined }))}
                            className="bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white">
                            <option value="">Toate stările</option>
                            {Object.entries(STATUS_BADGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <div className="flex items-center gap-1.5 text-[11px] text-navy-500 ml-auto">
                            <RefreshCw className="w-3 h-3" /> Auto-refresh 30s
                        </div>
                    </div>

                    {loadingDeliveries ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-navy-500" /></div>
                    ) : deliveries.length === 0 ? (
                        <div className="text-center py-8 text-navy-500 text-sm">Niciun rezultat</div>
                    ) : (
                        <div className="space-y-1.5">
                            {deliveries.map((d: WebhookDelivery) => {
                                const badge = STATUS_BADGES[d.status] || STATUS_BADGES.pending;
                                const isExpanded = expandedDelivery === d.id;
                                return (
                                    <div key={d.id} className="bg-navy-900/50 border border-navy-700/30 rounded-lg overflow-hidden">
                                        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-navy-800/30 transition-all"
                                            onClick={() => setExpandedDelivery(isExpanded ? null : d.id)}>
                                            <ChevronDown className={`w-3.5 h-3.5 text-navy-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            <span className="text-[11px] text-navy-500 w-16 flex-shrink-0">{timeAgo(d.created_at)}</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-medium flex-shrink-0">
                                                {EVENT_LABELS[d.event_type] || d.event_type}
                                            </span>
                                            <span className="text-xs text-navy-400 truncate flex-1 min-w-0">{d.url}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${badge.bg} ${badge.text} font-medium`}>
                                                {badge.label}
                                            </span>
                                            <span className="text-[10px] text-navy-500 w-8 text-right">{d.attempt}/{d.max_attempts}</span>
                                        </div>
                                        {isExpanded && (
                                            <div className="px-4 pb-3 space-y-2 border-t border-navy-700/30 pt-2">
                                                {d.error_message && (
                                                    <div className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2">
                                                        {d.error_message}
                                                    </div>
                                                )}
                                                <div className="text-[11px] text-navy-500">
                                                    <span className="font-medium text-navy-400">Payload:</span>
                                                    <pre className="mt-1 bg-navy-900 rounded-lg p-2 overflow-x-auto max-h-40 text-[10px]">
                                                        {JSON.stringify(d.payload, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Form Modal */}
            {showForm && (
                <WebhookFormModal
                    initial={editingSub}
                    onClose={() => { setShowForm(false); setEditingSub(null); }}
                    onSave={async (data) => {
                        try {
                            if (editingSub) {
                                await updateMut.mutateAsync({ id: editingSub.id, data });
                                showToast('Webhook actualizat', 'success');
                            } else {
                                await createMut.mutateAsync(data);
                                showToast('Webhook creat', 'success');
                            }
                            setShowForm(false);
                            setEditingSub(null);
                        } catch {
                            showToast('Eroare', 'error');
                        }
                    }}
                />
            )}
        </div>
    );
}

// === Form Modal ===
function WebhookFormModal({ initial, onClose, onSave }: {
    initial: WebhookSubscription | null;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
}) {
    const [url, setUrl] = useState(initial?.url || '');
    const [eventType, setEventType] = useState(initial?.event_type || 'task.created');
    const [description, setDescription] = useState(initial?.description || '');
    const [secret, setSecret] = useState('');
    const [saving, setSaving] = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        const data: any = { url, event_type: eventType, description: description || undefined };
        if (secret) data.secret = secret;
        await onSave(data);
        setSaving(false);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-md bg-navy-900 border border-navy-700/50 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
                    <h3 className="text-base font-bold">{initial ? 'Editare webhook' : 'Adaugă webhook'}</h3>
                    <button onClick={onClose} className="text-navy-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={submit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs text-navy-400 mb-1">URL *</label>
                        <input value={url} onChange={e => setUrl(e.target.value)} required type="url" placeholder="https://example.com/webhook"
                            className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-navy-600 focus:outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                        <label className="block text-xs text-navy-400 mb-1">Tip eveniment *</label>
                        <select value={eventType} onChange={e => setEventType(e.target.value as WebhookEventType)}
                            className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50">
                            {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-navy-400 mb-1">Descriere</label>
                        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Opțional"
                            className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-navy-600 focus:outline-none focus:border-blue-500/50" />
                    </div>
                    <div>
                        <label className="block text-xs text-navy-400 mb-1">Secret</label>
                        <input value={secret} onChange={e => setSecret(e.target.value)} type="password" placeholder="Opțional — pentru semnătură HMAC"
                            className="w-full bg-navy-800 border border-navy-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-navy-600 focus:outline-none focus:border-blue-500/50" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-navy-400 hover:text-white transition-colors">Anulare</button>
                        <button type="submit" disabled={saving}
                            className="px-5 py-2 bg-blue-500 hover:bg-blue-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {initial ? 'Salvează' : 'Creează'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
