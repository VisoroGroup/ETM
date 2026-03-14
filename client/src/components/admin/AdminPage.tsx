import React, { useState, useEffect } from 'react';
import { Shield, Users, Edit2, Trash2, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { adminApi } from '../../services/api';
import { User, DEPARTMENTS } from '../../types';

const ROLES = ['admin', 'manager', 'user'] as const;
const DEPT_KEYS = Object.keys(DEPARTMENTS) as (keyof typeof DEPARTMENTS)[];

export default function AdminPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<{ role?: string; department?: string }>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const [usersData, statsData] = await Promise.all([adminApi.users(), adminApi.stats()]);
            setUsers(usersData);
            setStats(statsData);
        } catch (err: any) {
            setError('Nu ai acces la panoul admin.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const startEdit = (u: User) => {
        setEditingId(u.id);
        setEditData({ role: u.role, department: u.department });
    };

    const saveEdit = async (id: string) => {
        setSaving(true);
        try {
            const updated = await adminApi.updateUser(id, editData);
            setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u));
            setEditingId(null);
        } catch {
            setError('Eroare la salvare.');
        } finally {
            setSaving(false);
        }
    };

    const deleteUser = async (u: User) => {
        if (!confirm(`Ștergi utilizatorul ${u.display_name}? Aceasta va șterge și toate sarcinile create de el.`)) return;
        try {
            await adminApi.deleteUser(u.id);
            setUsers(prev => prev.filter(x => x.id !== u.id));
        } catch {
            setError('Eroare la ștergere.');
        }
    };

    if (currentUser?.role !== 'admin') {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Shield className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <p className="text-lg font-semibold text-red-400">Acces restricționat</p>
                    <p className="text-sm text-gray-400 mt-1">Această pagina este doar pentru administratori.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Shield className="w-6 h-6 text-blue-400" />
                    <h1 className="text-xl font-bold">Admin Panel</h1>
                </div>
                <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-sm transition-colors">
                    <RefreshCw className="w-4 h-4" />
                    Reîncarcă
                </button>
            </div>

            {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-5 gap-3 mb-6">
                    {[
                        { label: 'Utilizatori', value: stats.total_users, color: 'text-blue-400' },
                        { label: 'Sarcini total', value: stats.total_tasks, color: 'text-white' },
                        { label: 'Terminate', value: stats.completed_tasks, color: 'text-green-400' },
                        { label: 'Blocate', value: stats.blocked_tasks, color: 'text-red-400' },
                        { label: 'Restante', value: stats.overdue_tasks, color: 'text-amber-400' },
                    ].map(s => (
                        <div key={s.label} className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4">
                            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-navy-400 mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Users table */}
            <div className="bg-navy-800/30 border border-navy-700/50 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-navy-700/50 flex items-center gap-2">
                    <Users className="w-4 h-4 text-navy-300" />
                    <h2 className="text-sm font-semibold">Utilizatori ({users.length})</h2>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-navy-700/50">
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">Utilizator</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">Rol</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">Departament</th>
                                <th className="text-right px-4 py-2.5 text-xs text-navy-400 font-medium">Acțiuni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} className="border-b border-navy-700/30 hover:bg-navy-700/20 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                {u.display_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium text-xs">{u.display_name}</p>
                                                <p className="text-navy-400 text-[10px]">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {editingId === u.id ? (
                                            <select
                                                value={editData.role}
                                                onChange={e => setEditData(d => ({ ...d, role: e.target.value }))}
                                                className="bg-navy-700 border border-navy-600 rounded px-2 py-1 text-xs text-white outline-none"
                                            >
                                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        ) : (
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                u.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                                                u.role === 'manager' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-gray-500/20 text-gray-400'
                                            }`}>{u.role}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {editingId === u.id ? (
                                            <select
                                                value={editData.department}
                                                onChange={e => setEditData(d => ({ ...d, department: e.target.value }))}
                                                className="bg-navy-700 border border-navy-600 rounded px-2 py-1 text-xs text-white outline-none"
                                            >
                                                {DEPT_KEYS.map(d => <option key={d} value={d}>{DEPARTMENTS[d].label}</option>)}
                                            </select>
                                        ) : (
                                            <span className="text-xs text-navy-300">{DEPARTMENTS[u.department]?.label || u.department}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {editingId === u.id ? (
                                                <>
                                                    <button
                                                        onClick={() => saveEdit(u.id)}
                                                        disabled={saving}
                                                        className="p-1.5 rounded text-green-400 hover:bg-green-500/10 transition-colors"
                                                        title="Salvează"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="text-xs text-navy-400 hover:text-white px-2">
                                                        Anulează
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => startEdit(u)}
                                                        className="p-1.5 rounded text-navy-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                        title="Editează"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    {u.id !== currentUser?.id && (
                                                        <button
                                                            onClick={() => deleteUser(u)}
                                                            className="p-1.5 rounded text-navy-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                            title="Șterge"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
