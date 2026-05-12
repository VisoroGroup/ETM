import { useState, useMemo } from 'react';
import { X, FileDown, Loader2 } from 'lucide-react';
import { safeLocalStorage } from '../../utils/storage';
import { useTranslation, TFunction } from '../../i18n/I18nContext';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getLast12Months(t: TFunction): { value: string; label: string }[] {
    const months: { value: string; label: string }[] = [];
    const names = [
        t('report.month_1'), t('report.month_2'), t('report.month_3'), t('report.month_4'),
        t('report.month_5'), t('report.month_6'), t('report.month_7'), t('report.month_8'),
        t('report.month_9'), t('report.month_10'), t('report.month_11'), t('report.month_12'),
    ];
    const now = new Date();
    for (let i = 1; i <= 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.push({ value: val, label: `${names[d.getMonth()]} ${d.getFullYear()}` });
    }
    return months;
}

export default function ReportModal({ isOpen, onClose }: Props) {
    const { t } = useTranslation();
    // Audit-3 H21/H24: Esc closes, focus restored on close.
    useModalDismiss(isOpen, onClose);
    const months = useMemo(() => getLast12Months(t), [t]);
    const [month, setMonth] = useState(months[0].value);
    const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
    const [sections, setSections] = useState({
        tasks: true, departments: true, users: true,
    });
    const [generating, setGenerating] = useState(false);

    if (!isOpen) return null;

    function toggleSection(key: keyof typeof sections) {
        setSections(prev => ({ ...prev, [key]: !prev[key] }));
    }

    async function generate() {
        setGenerating(true);
        const sectionList = Object.entries(sections).filter(([, v]) => v).map(([k]) => k).join(',');
        const token = safeLocalStorage.get('token');
        const url = `${API_BASE}/reports/monthly?month=${month}&format=${format}&sections=${sectionList}`;

        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) {
                let errorMsg = `${t('report.error_prefix')} ${response.status}`;
                try {
                    const errBody = await response.json();
                    errorMsg = errBody.error || errBody.message || errorMsg;
                } catch { /* response wasn't JSON */ }
                throw new Error(errorMsg);
            }
            const blob = await response.blob();
            const ext = format === 'excel' ? 'xlsx' : 'pdf';
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `raport_${month}.${ext}`;
            link.click();
            URL.revokeObjectURL(link.href);
            onClose();
        } catch (e: any) {
            alert(`${t('report.generate_error')}: ${e?.message || t('report.unknown_error')}`);
        } finally {
            setGenerating(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-md bg-navy-900 border border-navy-700/50 rounded-2xl shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
                    <div className="flex items-center gap-2">
                        <FileDown className="w-5 h-5 text-blue-400" />
                        <h2 className="text-base font-bold">{t('report.title')}</h2>
                    </div>
                    <button onClick={onClose} className="text-navy-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Month selector */}
                    <div>
                        <label className="text-xs font-medium text-navy-400 mb-1.5 block">{t('report.month')}</label>
                        <select
                            value={month}
                            onChange={e => setMonth(e.target.value)}
                            className="w-full px-3 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                        >
                            {months.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Format selector */}
                    <div>
                        <label className="text-xs font-medium text-navy-400 mb-1.5 block">{t('report.format')}</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFormat('pdf')}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                                    format === 'pdf'
                                        ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                        : 'bg-navy-800/50 border-navy-700/50 text-navy-300 hover:border-navy-600'
                                }`}
                            >
                                📄 PDF
                            </button>
                            <button
                                onClick={() => setFormat('excel')}
                                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                                    format === 'excel'
                                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                                        : 'bg-navy-800/50 border-navy-700/50 text-navy-300 hover:border-navy-600'
                                }`}
                            >
                                📊 Excel
                            </button>
                        </div>
                    </div>

                    {/* Sections */}
                    <div>
                        <label className="text-xs font-medium text-navy-400 mb-1.5 block">{t('report.sections')}</label>
                        <div className="space-y-2">
                            {[
                                { key: 'tasks' as const, label: t('report.section_tasks') },
                                { key: 'departments' as const, label: t('report.section_departments') },
                                { key: 'users' as const, label: t('report.section_users') },
                            ].map(s => (
                                <label key={s.key} className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={sections[s.key]}
                                        onChange={() => toggleSection(s.key)}
                                        className="w-4 h-4 rounded border-navy-600 bg-navy-800 text-blue-500 focus:ring-blue-500/30"
                                    />
                                    <span className="text-sm text-navy-300 group-hover:text-white transition-colors">{s.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Generate button */}
                    <button
                        onClick={generate}
                        disabled={generating || !Object.values(sections).some(Boolean)}
                        className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-lg font-medium text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                        {generating ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> {t('report.generating')}</>
                        ) : (
                            <><FileDown className="w-4 h-4" /> {t('report.generate')}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
