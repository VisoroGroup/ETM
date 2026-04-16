import React, { useState, useEffect } from 'react';
import { Target, Pencil, Check, X } from 'lucide-react';
import { settingsApi } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

interface Props {
    darkMode?: boolean;
}

export default function CompanyGoalBanner({ darkMode = true }: Props) {
    const { user } = useAuth();
    const [goal, setGoal] = useState('');
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [loading, setLoading] = useState(true);

    const isSuperAdmin = user?.role === 'superadmin';

    useEffect(() => {
        settingsApi.getCompanyGoal()
            .then(data => setGoal(data.goal || ''))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        try {
            const data = await settingsApi.updateCompanyGoal(editValue);
            setGoal(data.goal);
            setEditing(false);
        } catch (err) {
            console.error('Failed to save company goal:', err);
        }
    };

    if (loading || !goal) return null;

    return (
        <div className={`relative px-4 md:px-6 py-2 text-center text-xs md:text-sm leading-snug border-b ${
            darkMode
                ? 'bg-navy-900 border-navy-600/50 text-white/90'
                : 'bg-blue-50 border-blue-100 text-gray-700'
        }`}>
            {editing ? (
                <div className="flex items-center gap-2 max-w-6xl mx-auto">
                    <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className={`flex-1 text-xs rounded-md px-3 py-1.5 resize-none ${
                            darkMode ? 'bg-navy-800 border-navy-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                        } border focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        rows={2}
                        autoFocus
                    />
                    <button onClick={handleSave} className="p-1.5 rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30">
                        <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditing(false)} className="p-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <div className="flex items-center justify-center gap-2 max-w-full mx-auto px-2">
                    <Target className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                    <span className="italic line-clamp-2 md:line-clamp-1">{goal}</span>
                    {isSuperAdmin && (
                        <button
                            onClick={() => { setEditValue(goal); setEditing(true); }}
                            className={`ml-1 p-1 rounded opacity-40 hover:opacity-100 transition-opacity flex-shrink-0 ${
                                darkMode ? 'hover:bg-navy-700' : 'hover:bg-blue-100'
                            }`}
                            title="Editare obiectivul companiei"
                            aria-label="Editare obiectivul companiei"
                        >
                            <Pencil className="w-3 h-3" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
