import React, { useState, useEffect, useRef } from 'react';
import { Shield, Users, Edit2, Trash2, CheckCircle, RefreshCw, Camera, Loader2, Plus, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { adminApi } from '../../services/api';
import { User, DEPARTMENTS, Department } from '../../types';
import WebhookManager from './WebhookManager';
import ApiTokenManager from './ApiTokenManager';
import UserAvatar from '../ui/UserAvatar';
import AvatarCropper from '../ui/AvatarCropper';

const ROLES = ['superadmin', 'admin', 'manager', 'user'] as const;
const DEPT_KEYS = Object.keys(DEPARTMENTS) as Department[];

export default function AdminPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<{ role?: string; departments?: string[] }>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [uploadingAvatarId, setUploadingAvatarId] = useState<string | null>(null);
    const [cropState, setCropState] = useState<{ userId: string; imageUrl: string } | null>(null);
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [newUser, setNewUser] = useState({ email: '', display_name: '', role: 'user', departments: [] as string[] });
    const [creating, setCreating] = useState(false);
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const handleAvatarUpload = async (userId: string, file: File) => {
        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
            setError('Doar imagini (jpg, png, gif, webp) sunt permise.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Imaginea nu poate depăși 5MB.');
            return;
        }
        
        const imageUrl = URL.createObjectURL(file);
        setCropState({ userId, imageUrl });
    };

    const handleCropSave = async (croppedFile: File) => {
        if (!cropState) return;
        const { userId } = cropState;
        setCropState(null);

        setUploadingAvatarId(userId);
        setError('');
        try {
            const updated = await adminApi.uploadUserAvatar(userId, croppedFile);
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, avatar_url: updated.avatar_url } : u));
        } catch (err: any) {
            setError(err.response?.data?.error || 'Eroare la încărcarea avatarului.');
        } finally {
            setUploadingAvatarId(null);
        }
    };

    const handleCropCancel = () => {
        if (cropState) {
            URL.revokeObjectURL(cropState.imageUrl);
            setCropState(null);
        }
    };

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
        setEditData({ role: u.role, departments: u.departments || [] });
    };

    const toggleDept = (dept: string) => {
        setEditData(d => {
            const current = d.departments || [];
            const has = current.includes(dept);
            return {
                ...d,
                departments: has ? current.filter(x => x !== dept) : [...current, dept],
            };
        });
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

    const createUser = async () => {
        if (!newUser.email.trim() || !newUser.display_name.trim()) {
            setError('Email și nume sunt obligatorii.');
            return;
        }
        setCreating(true);
        setError('');
        try {
            const created = await adminApi.createUser(newUser);
            setUsers(prev => [...prev, created]);
            setShowCreateUser(false);
            setNewUser({ email: '', display_name: '', role: 'user', departments: [] });
        } catch (err: any) {
            setError(err.response?.data?.error || 'Eroare la crearea utilizatorului.');
        } finally {
            setCreating(false);
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

    if (currentUser?.role !== 'admin' && currentUser?.role !== 'superadmin') {
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
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
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
                <div className="px-4 py-3 border-b border-navy-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-navy-300" />
                        <h2 className="text-sm font-semibold">Utilizatori ({users.length})</h2>
                    </div>
                    <button
                        onClick={() => setShowCreateUser(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Kolléga hozzáadása
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-navy-700/50">
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">Utilizator</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">Rol</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">Departamente</th>
                                <th className="text-right px-4 py-2.5 text-xs text-navy-400 font-medium">Acțiuni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} className="border-b border-navy-700/30 hover:bg-navy-700/20 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="relative group cursor-pointer" onClick={() => fileInputRefs.current[u.id]?.click()}>
                                                <UserAvatar
                                                    name={u.display_name}
                                                    avatarUrl={u.avatar_url}
                                                    size="sm"
                                                />
                                                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {uploadingAvatarId === u.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                                                    ) : (
                                                        <Camera className="w-3.5 h-3.5 text-white" />
                                                    )}
                                                </div>
                                                <input
                                                    ref={el => { fileInputRefs.current[u.id] = el; }}
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleAvatarUpload(u.id, file);
                                                        e.target.value = '';
                                                    }}
                                                />
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
                                            <div className="flex flex-wrap gap-1.5">
                                                {DEPT_KEYS.map(d => {
                                                    const selected = editData.departments?.includes(d);
                                                    return (
                                                        <button
                                                            key={d}
                                                            type="button"
                                                            onClick={() => toggleDept(d)}
                                                            className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                                                                selected
                                                                    ? 'border-blue-500/50 bg-blue-500/20 text-blue-300'
                                                                    : 'border-navy-600 bg-navy-700/30 text-navy-400 hover:border-navy-500'
                                                            }`}
                                                        >
                                                            {DEPARTMENTS[d].label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-navy-300">
                                                {(u.departments || []).map(d => DEPARTMENTS[d]?.label || d).join(', ') || '—'}
                                            </span>
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
                    </div>
                )}
            </div>

            {/* Webhook Manager */}
            <div className="mt-8">
                <WebhookManager />
            </div>

            {/* API Token Manager */}
            <div className="mt-8">
                <ApiTokenManager />
            </div>

            {cropState && (
                <AvatarCropper
                    imageSrc={cropState.imageUrl}
                    onCancel={handleCropCancel}
                    onSave={handleCropSave}
                />
            )}

            {/* Create User Modal */}
            {showCreateUser && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowCreateUser(false)}>
                    <div className="bg-navy-800 border border-navy-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-white">Kolléga hozzáadása</h3>
                            <button onClick={() => setShowCreateUser(false)} className="text-navy-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-navy-400 mb-1.5 block">Név *</label>
                                <input
                                    type="text"
                                    value={newUser.display_name}
                                    onChange={e => setNewUser(prev => ({ ...prev, display_name: e.target.value }))}
                                    placeholder="Vezetéknév Keresztnév"
                                    className="w-full px-3 py-2.5 bg-navy-900/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-navy-400 mb-1.5 block">Email *</label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="nev@visoro-global.ro"
                                    className="w-full px-3 py-2.5 bg-navy-900/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-navy-400 mb-1.5 block">Szerepkör</label>
                                <select
                                    value={newUser.role}
                                    onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                                    className="w-full px-3 py-2.5 bg-navy-900/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                                >
                                    <option value="user">User</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-navy-400 mb-1.5 block">Departamentek</label>
                                <div className="flex flex-wrap gap-2">
                                    {DEPT_KEYS.map(dept => {
                                        const active = newUser.departments.includes(dept);
                                        return (
                                            <button
                                                key={dept}
                                                type="button"
                                                onClick={() => setNewUser(prev => ({
                                                    ...prev,
                                                    departments: active
                                                        ? prev.departments.filter(d => d !== dept)
                                                        : [...prev.departments, dept]
                                                }))}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                                                    active
                                                        ? 'text-white shadow-md'
                                                        : 'bg-navy-800/50 text-navy-400 hover:bg-navy-700/50 border-navy-700/50'
                                                }`}
                                                style={active ? { background: DEPARTMENTS[dept].color, borderColor: DEPARTMENTS[dept].color } : undefined}
                                            >
                                                {DEPARTMENTS[dept].label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateUser(false)}
                                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium bg-navy-700 hover:bg-navy-600 text-navy-300 transition-colors"
                            >
                                Mégsem
                            </button>
                            <button
                                onClick={createUser}
                                disabled={creating}
                                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-400 text-white transition-colors disabled:opacity-50"
                            >
                                {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Hozzáadás'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
