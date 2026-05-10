import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from '../i18n/I18nContext';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

function DefaultFallback({ error, onReload }: { error?: Error; onReload: () => void }) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-8">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold mb-2">{t('error_boundary.title')}</h2>
            <p className="text-sm text-navy-400 mb-4 max-w-sm">
                {error?.message || t('error_boundary.fallback_message')}
            </p>
            <button
                onClick={onReload}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm transition-colors"
            >
                <RefreshCw className="w-4 h-4" /> {t('error_boundary.reload')}
            </button>
        </div>
    );
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary]', error, info);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <DefaultFallback
                    error={this.state.error}
                    onReload={() => { this.setState({ hasError: false }); window.location.reload(); }}
                />
            );
        }
        return this.props.children;
    }
}
