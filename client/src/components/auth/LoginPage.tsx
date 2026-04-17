import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Shield } from 'lucide-react';

export default function LoginPage() {
    const { login, loading } = useAuth();
    const [animateIn, setAnimateIn] = useState(false);

    useEffect(() => {
        setAnimateIn(true);
    }, []);

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
                            Organizează sarcinile, monitorizează progresul și colaborează cu echipa ta — totul într-un singur loc.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={login}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Shield className="w-5 h-5" />
                            {loading ? 'Se conectează...' : 'Conectare cu Microsoft 365'}
                        </button>

                        <p className="text-center text-navy-400 text-xs">
                            Autentificare securizată prin Microsoft Entra ID
                        </p>
                    </div>
                </div>

                <p className="text-center text-navy-500 text-xs mt-6">
                    © {new Date().getFullYear()} Visoro Global SRL. Toate drepturile rezervate.
                </p>
            </div>
        </div>
    );
}
