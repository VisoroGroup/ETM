import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/I18nContext';
import { authApi } from '../../services/api';
import { stashReturnTo } from '../../utils/returnTo';
import { Shield, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

type Mode = 'choice' | 'magic-link';

export default function LoginPage() {
    const { login, loading } = useAuth();
    const { t } = useTranslation();
    const [animateIn, setAnimateIn] = useState(false);
    const [mode, setMode] = useState<Mode>('choice');
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setAnimateIn(true);
        // The login wall just interrupted a navigation (e.g. an email task
        // link with an expired session). Remember the destination so the
        // post-login redirect can land there instead of the dashboard.
        stashReturnTo();
    }, []);

    const handleSendLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const trimmed = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setError(t('login.magic_link_invalid_email'));
            return;
        }
        setSubmitting(true);
        try {
            await authApi.requestMagicLink(trimmed);
            setSent(true);
        } catch {
            setError(t('login.magic_link_error'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 flex items-center justify-center p-4">
            {/* Background effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
            </div>

            <div className={`relative z-10 w-full max-w-md transition-all duration-700 ${animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                {/* Logo card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="w-24 h-24 mx-auto mb-4 drop-shadow-2xl">
                            <img
                                src="/visoro-logo.png"
                                alt="Visoro Group"
                                className="w-full h-full object-contain rounded-full"
                            />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-1">Sarcinator Visoro</h1>
                        <p className="text-navy-300 text-sm">Visoro Global SRL</p>
                        <p className="text-navy-400 text-xs mt-4 leading-relaxed">
                            {t('login.tagline')}
                        </p>
                    </div>

                    {mode === 'choice' && (
                        <div className="space-y-3">
                            <button
                                onClick={login}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Shield className="w-5 h-5" />
                                {loading ? t('login.connecting') : t('login.with_microsoft_365')}
                            </button>

                            <div className="relative my-2">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-white/10" />
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    <span className="bg-navy-900/50 px-3 text-navy-400 uppercase tracking-wider">
                                        {t('login.magic_link_or')}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => { setMode('magic-link'); setError(null); setSent(false); }}
                                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-medium transition-all"
                            >
                                <Mail className="w-5 h-5" />
                                {t('login.magic_link_external')}
                            </button>

                            <p className="text-center text-navy-400 text-xs pt-2">
                                {t('login.secure_auth_note')}
                            </p>
                        </div>
                    )}

                    {mode === 'magic-link' && !sent && (
                        <form onSubmit={handleSendLink} className="space-y-4">
                            <div>
                                <label htmlFor="magic-email" className="block text-xs text-navy-300 mb-2">
                                    {t('login.magic_link_email_label')}
                                </label>
                                <input
                                    id="magic-email"
                                    type="email"
                                    autoComplete="email"
                                    autoFocus
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={t('login.magic_link_email_placeholder')}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-all"
                                    disabled={submitting}
                                />
                                {error && (
                                    <p className="mt-2 text-xs text-red-400">{error}</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || !email.trim()}
                                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl font-medium transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Mail className="w-5 h-5" />
                                {submitting ? t('login.magic_link_sending') : t('login.magic_link_send')}
                            </button>

                            <button
                                type="button"
                                onClick={() => setMode('choice')}
                                className="w-full flex items-center justify-center gap-2 text-navy-400 hover:text-white text-xs transition-colors"
                            >
                                <ArrowLeft className="w-3 h-3" />
                                {t('login.magic_link_back')}
                            </button>
                        </form>
                    )}

                    {mode === 'magic-link' && sent && (
                        <div className="space-y-4 text-center">
                            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-green-400" />
                            </div>
                            <p className="text-navy-200 text-sm leading-relaxed">
                                {t('login.magic_link_sent')}
                            </p>
                            <button
                                type="button"
                                onClick={() => { setMode('choice'); setSent(false); setEmail(''); }}
                                className="w-full flex items-center justify-center gap-2 text-navy-400 hover:text-white text-xs transition-colors"
                            >
                                <ArrowLeft className="w-3 h-3" />
                                {t('login.magic_link_back')}
                            </button>
                        </div>
                    )}
                </div>

                <p className="text-center text-navy-500 text-xs mt-6">
                    {t('login.copyright', { year: new Date().getFullYear() })}
                </p>
            </div>
        </div>
    );
}
