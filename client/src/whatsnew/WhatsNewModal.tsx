import { Megaphone, X } from 'lucide-react';
import { useTranslation } from '../i18n/I18nContext';
import { useCompany } from '../hooks/useCompany';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { Release, pickText } from './releases';
import { formatDate } from '../utils/helpers';

interface Props {
    /** Releases to show, newest first (Layout passes at most the 3 newest). */
    releases: Release[];
    /** Fired on OK / X / backdrop / Esc — the caller marks the latest id seen. */
    onClose: () => void;
    darkMode: boolean;
}

/**
 * "Noutăți" popup shown once per user after a deploy that added a release
 * entry (see releases.ts), and re-openable any time from the megaphone icon.
 * Content is per-company-language (RO/HU) from the release entries themselves;
 * only the chrome strings go through i18n.
 */
export default function WhatsNewModal({ releases, onClose, darkMode }: Props) {
    const { t } = useTranslation();
    const { activeCompany } = useCompany();
    const language = activeCompany?.language ?? 'ro';
    useModalDismiss(true, onClose);

    return (
        <div
            className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8 overflow-y-auto animate-fade-in"
            onClick={onClose}
        >
            <div
                className={`w-full max-w-lg my-auto rounded-2xl shadow-2xl animate-slide-up border ${
                    darkMode ? 'bg-navy-900 border-navy-700' : 'bg-white border-gray-200'
                }`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`flex items-center gap-3 px-5 py-4 border-b ${darkMode ? 'border-navy-700/60' : 'border-gray-200'}`}>
                    <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Megaphone className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className={`text-base font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            {t('whatsnew.title')}
                        </h2>
                        <p className={`text-xs ${darkMode ? 'text-navy-400' : 'text-gray-500'}`}>
                            {t('whatsnew.subtitle')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
                            darkMode ? 'text-navy-400 hover:text-white hover:bg-navy-800' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                        aria-label={t('common.close')}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
                    {releases.map(release => (
                        <div key={release.id}>
                            <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}>
                                {formatDate(release.date)}
                            </p>
                            <div className="space-y-4">
                                {release.items.map((item, i) => (
                                    <div key={i} className={`rounded-xl border p-4 ${darkMode ? 'border-navy-700/50 bg-navy-800/30' : 'border-gray-200 bg-gray-50'}`}>
                                        <h3 className={`text-sm font-semibold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                            {pickText(item.title, language)}
                                        </h3>
                                        <p className={`text-xs leading-relaxed ${darkMode ? 'text-navy-300' : 'text-gray-600'}`}>
                                            {pickText(item.description, language)}
                                        </p>
                                        {item.image && (
                                            <img
                                                src={item.image}
                                                alt={pickText(item.title, language)}
                                                loading="lazy"
                                                className={`mt-3 rounded-lg border max-w-full ${darkMode ? 'border-navy-700' : 'border-gray-200'}`}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className={`px-5 py-4 border-t flex justify-end ${darkMode ? 'border-navy-700/60' : 'border-gray-200'}`}>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                        autoFocus
                    >
                        {t('whatsnew.ok')}
                    </button>
                </div>
            </div>
        </div>
    );
}
