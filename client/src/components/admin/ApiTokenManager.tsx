import React, { useState, useEffect } from 'react';
import { Key, Plus, Copy, Trash2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { apiTokensApi } from '../../services/api';
import { useTranslation } from '../../i18n/I18nContext';

interface ApiToken {
    id: string;
    name: string;
    is_active: boolean;
    created_at: string;
    last_used_at: string | null;
    expires_at: string | null;
    created_by_name: string;
}

export default function ApiTokenManager() {
    const { t, language } = useTranslation();
    const [tokens, setTokens] = useState<ApiToken[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTokenName, setNewTokenName] = useState('');
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');

    const load = async () => {
        try {
            const data = await apiTokensApi.list();
            setTokens(data);
        } catch {
            setError(t('api_tokens.error_loading'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const generateToken = async () => {
        if (!newTokenName.trim()) return;
        setGenerating(true);
        setError('');
        try {
            const result = await apiTokensApi.generate(newTokenName.trim());
            setGeneratedToken(result.token);
            setNewTokenName('');
            setCopied(false);
            setShowToken(false);
            load();
        } catch {
            setError(t('api_tokens.error_generating'));
        } finally {
            setGenerating(false);
        }
    };

    const revokeToken = async (id: string, name: string) => {
        if (!confirm(t('api_tokens.confirm_revoke', { name }))) return;
        try {
            await apiTokensApi.revoke(id);
            load();
            setError('');
        } catch {
            setError(t('api_tokens.error_revoking'));
        }
    };

    const copyToClipboard = async () => {
        if (!generatedToken) return;
        try {
            await navigator.clipboard.writeText(generatedToken);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = generatedToken;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        const locale = language === 'hu' ? 'hu-HU' : 'ro-RO';
        return new Date(dateStr).toLocaleDateString(locale, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const activeTokens = tokens.filter(t => t.is_active);
    const revokedTokens = tokens.filter(t => !t.is_active);

    return (
        <div className="bg-navy-800/30 border border-navy-700/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-navy-700/50 flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold">{t('api_tokens.title')}</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium ml-1">
                    {t(activeTokens.length === 1 ? 'api_tokens.active_count_one' : 'api_tokens.active_count_many', { count: activeTokens.length })}
                </span>
            </div>

            {error && (
                <div className="mx-4 mt-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                    {error}
                </div>
            )}

            {/* Generate new token */}
            <div className="p-4 border-b border-navy-700/30">
                <p className="text-xs text-navy-400 mb-2">
                    {t('api_tokens.generate_hint')}
                </p>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newTokenName}
                        onChange={e => setNewTokenName(e.target.value)}
                        placeholder={t('api_tokens.name_placeholder')}
                        className="flex-1 bg-navy-700/50 border border-navy-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-navy-500 outline-none focus:border-amber-500/50 transition-colors"
                        onKeyDown={e => e.key === 'Enter' && generateToken()}
                    />
                    <button
                        onClick={generateToken}
                        disabled={generating || !newTokenName.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        {generating ? t('api_tokens.generating') : t('api_tokens.generate')}
                    </button>
                </div>

                {/* Show generated token */}
                {generatedToken && (
                    <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-xs text-green-400 font-medium">
                                {t('api_tokens.generated_success')}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-navy-900/50 rounded px-2.5 py-1.5 text-xs font-mono text-green-300 break-all select-all">
                                {showToken ? generatedToken : '•'.repeat(32) + generatedToken.slice(-8)}
                            </code>
                            <button
                                onClick={() => setShowToken(!showToken)}
                                className="p-1.5 rounded text-navy-400 hover:text-white transition-colors"
                                title={showToken ? t('api_tokens.hide') : t('api_tokens.show')}
                            >
                                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={copyToClipboard}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-colors"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                {copied ? t('api_tokens.copied') : t('api_tokens.copy')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Tokens list */}
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : activeTokens.length === 0 && revokedTokens.length === 0 ? (
                <div className="py-8 text-center text-navy-400 text-sm">
                    {t('api_tokens.empty_state')}
                </div>
            ) : (
                <div className="divide-y divide-navy-700/30">
                    {activeTokens.map(token => (
                        <div key={token.id} className="px-4 py-3 flex items-center justify-between hover:bg-navy-700/20 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <div>
                                    <p className="text-sm font-medium text-white">{token.name}</p>
                                    <p className="text-[10px] text-navy-400">
                                        {t('api_tokens.created_label', { date: formatDate(token.created_at) })}
                                        {token.last_used_at && ` · ${t('api_tokens.last_used_label', { date: formatDate(token.last_used_at) })}`}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => revokeToken(token.id, token.name)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                                title={t('api_tokens.revoke_tooltip')}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                {t('api_tokens.revoke')}
                            </button>
                        </div>
                    ))}
                    {revokedTokens.length > 0 && (
                        <div className="px-4 py-2">
                            <p className="text-[10px] text-navy-500 uppercase tracking-wider mb-1">{t('api_tokens.revoked_section')}</p>
                            {revokedTokens.map(token => (
                                <div key={token.id} className="py-1.5 flex items-center gap-3 opacity-50">
                                    <div className="w-2 h-2 rounded-full bg-navy-600" />
                                    <p className="text-xs text-navy-500 line-through">{token.name}</p>
                                    <p className="text-[10px] text-navy-600">{formatDate(token.created_at)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
