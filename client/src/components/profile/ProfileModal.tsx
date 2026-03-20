import React, { useState } from 'react';
import { X, User, Save } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';

interface Props {
    onClose: () => void;
    darkMode: boolean;
}

export default function ProfileModal({ onClose, darkMode }: Props) {
    const { user, refreshUser } = useAuth();
    const [displayName, setDisplayName] = useState(user?.display_name || '');
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSave = async () => {
        if (!displayName.trim() || displayName.trim().length < 2) {
            setError('Numele trebuie să aibă cel puțin 2 caractere.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            await api.patch('/api/profile', {
                display_name: displayName.trim(),
                avatar_url: avatarUrl.trim() || null,
            });
            setSuccess(true);
            if (refreshUser) await refreshUser();
            setTimeout(onClose, 1000);
        } catch (err: any) {
            setError(err.message || 'Eroare la salvare.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-2xl shadow-2xl border ${darkMode ? 'bg-navy-800 border-navy-600' : 'bg-white border-gray-200'}`}>
                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-navy-700' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-400" />
                        <h2 className="text-base font-semibold">Profilul meu</h2>
                    </div>
                    <button onClick={onClose} className={`${darkMode ? 'text-navy-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'} transition-colors`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-5 space-y-4">
                    {/* Avatar preview */}
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-xl font-bold flex-shrink-0 overflow-hidden">
                            {avatarUrl
                                ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" onError={() => setAvatarUrl('')} />
                                : displayName.charAt(0).toUpperCase() || user?.display_name.charAt(0).toUpperCase()
                            }
                        </div>
                        <div>
                            <p className="text-sm font-medium">{user?.display_name}</p>
                            <p className={`text-xs ${darkMode ? 'text-navy-400' : 'text-gray-400'}`}>{user?.email}</p>
                            <p className={`text-xs mt-0.5 ${darkMode ? 'text-navy-400' : 'text-gray-400'} capitalize`}>
                                {user?.role} • {(user?.departments || []).join(', ').replace(/_/g, ' ') || '—'}
                            </p>
                        </div>
                    </div>

                    {/* Display name */}
                    <div>
                        <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-navy-300' : 'text-gray-600'}`}>
                            Nume afișat
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            className={`w-full px-3 py-2 rounded-lg text-sm border outline-none transition-all ${
                                darkMode
                                    ? 'bg-navy-900/50 border-navy-600 text-white focus:border-blue-500'
                                    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
                            }`}
                            placeholder="Numele tău"
                        />
                    </div>

                    {/* Avatar URL */}
                    <div>
                        <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-navy-300' : 'text-gray-600'}`}>
                            URL Avatar (opțional)
                        </label>
                        <input
                            type="url"
                            value={avatarUrl}
                            onChange={e => setAvatarUrl(e.target.value)}
                            className={`w-full px-3 py-2 rounded-lg text-sm border outline-none transition-all ${
                                darkMode
                                    ? 'bg-navy-900/50 border-navy-600 text-white focus:border-blue-500'
                                    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'
                            }`}
                            placeholder="https://..."
                        />
                    </div>

                    {error && <p className="text-red-400 text-xs">{error}</p>}
                    {success && <p className="text-green-400 text-xs">✓ Profil actualizat cu succes!</p>}
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 border-t ${darkMode ? 'border-navy-700' : 'border-gray-100'} flex justify-end gap-3`}>
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg text-sm transition-colors ${darkMode ? 'text-navy-300 hover:bg-navy-700' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        Anulează
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Se salvează...' : 'Salvează'}
                    </button>
                </div>
            </div>
        </div>
    );
}
