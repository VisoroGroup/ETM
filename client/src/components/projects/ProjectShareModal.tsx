import { useEffect, useState } from 'react';
import { pugProjectsApi, PugShareToken } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { useTranslation } from '../../i18n/I18nContext';
import { X, Link2, Copy, Trash2, Eye } from 'lucide-react';

interface Props {
    projectId: string;
    onClose: () => void;
}

// Modal for managing public share tokens on a project. David clicks "Share",
// generates a link, copies it, sends it to the mayor's office.
export default function ProjectShareModal({ projectId, onClose }: Props) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [tokens, setTokens] = useState<PugShareToken[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    async function reload() {
        try {
            const data = await pugProjectsApi.listShareTokens(projectId);
            setTokens(data);
        } catch {
            showToast(t('tasks.try_again'), 'error');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { reload(); }, [projectId]);

    async function onCreate() {
        setCreating(true);
        try {
            const created = await pugProjectsApi.createShareToken(projectId);
            setTokens(prev => [created, ...prev]);
            // Auto-copy the new link to clipboard for the David workflow.
            const url = `${window.location.origin}/shared/${created.token}`;
            try {
                await navigator.clipboard.writeText(url);
                showToast(t('projects.share_link_copied'), 'success');
            } catch {
                // Some browsers block clipboard without https — silently skip.
            }
        } catch {
            showToast(t('tasks.try_again'), 'error');
        } finally {
            setCreating(false);
        }
    }

    async function onRevoke(tokenId: string) {
        try {
            await pugProjectsApi.revokeShareToken(projectId, tokenId);
            setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, revoked_at: new Date().toISOString() } : t));
        } catch {
            showToast(t('tasks.try_again'), 'error');
        }
    }

    async function copyLink(token: string) {
        const url = `${window.location.origin}/shared/${token}`;
        try {
            await navigator.clipboard.writeText(url);
            showToast(t('projects.share_link_copied'), 'success');
        } catch {
            showToast(t('tasks.try_again'), 'error');
        }
    }

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-xl bg-navy-900 border border-navy-700/50 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-blue-400" />
                        {t('projects.share_modal_title')}
                    </h2>
                    <button onClick={onClose} className="text-navy-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    <p className="text-xs text-navy-400">{t('projects.share_modal_help')}</p>

                    <button
                        onClick={onCreate}
                        disabled={creating}
                        className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                    >
                        {creating ? t('common.loading') : t('projects.share_create_link')}
                    </button>

                    {loading ? (
                        <p className="text-xs text-navy-500 text-center">{t('common.loading')}</p>
                    ) : tokens.length === 0 ? (
                        <p className="text-xs text-navy-500 text-center py-4">{t('projects.share_no_tokens')}</p>
                    ) : (
                        <div className="space-y-2">
                            {tokens.map(tk => {
                                const url = `${window.location.origin}/shared/${tk.token}`;
                                const revoked = !!tk.revoked_at;
                                return (
                                    <div key={tk.id} className={`p-3 rounded-lg border ${revoked ? 'border-navy-800 bg-navy-900/30 opacity-60' : 'border-navy-700 bg-navy-800/40'}`}>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 text-xs text-navy-200 truncate font-mono">{url}</code>
                                            {!revoked && (
                                                <>
                                                    <button
                                                        onClick={() => copyLink(tk.token)}
                                                        className="p-1.5 text-navy-400 hover:text-white"
                                                        title={t('projects.share_copy')}
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => onRevoke(tk.id)}
                                                        className="p-1.5 text-navy-400 hover:text-red-400"
                                                        title={t('projects.share_revoke')}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-navy-500">
                                            <span className="flex items-center gap-1">
                                                <Eye className="w-3 h-3" />
                                                {tk.view_count} {t('projects.share_views')}
                                            </span>
                                            {revoked && <span className="text-red-400">{t('projects.share_revoked')}</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
