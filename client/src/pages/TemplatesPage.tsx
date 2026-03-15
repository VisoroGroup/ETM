import React, { useState, useEffect } from 'react';
import { templatesApi, authApi } from '../services/api';
import { DEPARTMENTS, Department } from '../types';
import { Plus, Trash2, LayoutTemplate, X, Loader2, BookCopy } from 'lucide-react';
import { useToast } from '../hooks/useToast';

interface Template {
    id: string;
    title: string;
    description?: string;
    department_label: string;
    assigned_to?: string | null;
    subtasks: { title: string }[];
    creator_name?: string;
    assignee_name?: string;
    created_at: string;
}

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const { showToast } = useToast();

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dept, setDept] = useState<Department>('departament_1');
    const [assignedTo, setAssignedTo] = useState('');
    const [subtasks, setSubtasks] = useState<string[]>(['']);
    const [saving, setSaving] = useState(false);

    async function load() {
        setLoading(true);
        try {
            const data = await templatesApi.list();
            setTemplates(data);
        } catch { } finally { setLoading(false); }
    }

    useEffect(() => {
        load();
        authApi.users().then(setUsers).catch(() => {});
    }, []);

    async function handleCreate() {
        if (!title.trim()) return showToast('Titlul este obligatoriu', 'error');
        setSaving(true);
        try {
            await templatesApi.create({
                title: title.trim(),
                description: description || undefined,
                department_label: dept,
                assigned_to: assignedTo || null,
                subtasks: subtasks.filter(s => s.trim()).map(s => ({ title: s.trim() })),
            });
            showToast('Sablon creat!');
            resetForm();
            load();
        } catch (e: any) {
            showToast(e.response?.data?.error || 'Eroare', 'error');
        } finally { setSaving(false); }
    }

    async function handleDelete(id: string) {
        if (!confirm('Ștergi acest sablon?')) return;
        try {
            await templatesApi.delete(id);
            showToast('Sablon șters');
            load();
        } catch { showToast('Eroare', 'error'); }
    }

    function resetForm() {
        setTitle(''); setDescription(''); setDept('departament_1');
        setAssignedTo(''); setSubtasks(['']); setShowForm(false);
    }

    function addSubtask() { setSubtasks(p => [...p, '']); }
    function updateSubtask(i: number, v: string) { setSubtasks(p => p.map((s, idx) => idx === i ? v : s)); }
    function removeSubtask(i: number) { setSubtasks(p => p.filter((_, idx) => idx !== i)); }

    return (
        <div className="p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <LayoutTemplate className="w-6 h-6 text-blue-400" /> Șabloane
                    </h1>
                    <p className="text-navy-400 text-sm mt-1">Creează sarcini rapid din șabloane predefinite</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-lg text-sm font-medium shadow-lg transition-all"
                >
                    <Plus className="w-4 h-4" /> Șablon nou
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>
            ) : templates.length === 0 ? (
                <div className="text-center py-20">
                    <BookCopy className="w-16 h-16 text-navy-700 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-navy-400 mb-1">Niciun șablon</h3>
                    <p className="text-sm text-navy-500 mb-4">Creează primul șablon pentru a accelera crearea task-urilor.</p>
                    <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm">
                        <Plus className="w-4 h-4 inline mr-1" /> Șablon nou
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map(tpl => (
                        <div key={tpl.id} className="bg-navy-900/50 border border-navy-700/50 rounded-xl p-4 hover:border-navy-600/70 transition-all group">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                                        style={{ background: DEPARTMENTS[tpl.department_label as Department]?.color || '#3b82f6' }}
                                    >
                                        {DEPARTMENTS[tpl.department_label as Department]?.label || tpl.department_label}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleDelete(tpl.id)}
                                    className="opacity-0 group-hover:opacity-100 text-navy-500 hover:text-red-400 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <h3 className="font-semibold text-sm mb-1">{tpl.title}</h3>
                            {tpl.description && <p className="text-xs text-navy-400 line-clamp-2 mb-3">{tpl.description}</p>}

                            {tpl.subtasks?.length > 0 && (
                                <div className="space-y-1 mb-3">
                                    {tpl.subtasks.slice(0, 3).map((s, i) => (
                                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-navy-400">
                                            <div className="w-1.5 h-1.5 rounded-full bg-navy-600" />
                                            {s.title}
                                        </div>
                                    ))}
                                    {tpl.subtasks.length > 3 && (
                                        <div className="text-[11px] text-navy-500">+{tpl.subtasks.length - 3} subtask-uri</div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t border-navy-800">
                                <span className="text-[11px] text-navy-500">
                                    {tpl.creator_name && `Creat de ${tpl.creator_name}`}
                                </span>
                                {tpl.assignee_name && (
                                    <span className="text-[11px] text-purple-400 flex items-center gap-1">
                                        <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-[8px] text-white font-bold">
                                            {tpl.assignee_name.charAt(0)}
                                        </div>
                                        {tpl.assignee_name}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create template modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="w-full max-w-lg bg-navy-900 border border-navy-700/50 rounded-2xl shadow-2xl animate-slide-up max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-5 border-b border-navy-700/50 flex-shrink-0">
                            <h2 className="text-base font-bold flex items-center gap-2">
                                <LayoutTemplate className="w-4 h-4 text-blue-400" /> Șablon nou
                            </h2>
                            <button onClick={resetForm} className="text-navy-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="text-xs font-medium text-navy-300 block mb-1.5">Titlu *</label>
                                <input
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Ex: Audit financiar lunar"
                                    autoFocus
                                    className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-navy-300 block mb-1.5">Descriere</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={2}
                                    placeholder="Opțional..."
                                    className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50 resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-navy-300 block mb-1.5">Departament</label>
                                    <select
                                        value={dept}
                                        onChange={e => setDept(e.target.value as Department)}
                                        className="w-full px-3 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                                    >
                                        {Object.entries(DEPARTMENTS).map(([k, v]) => (
                                            <option key={k} value={k}>{v.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-navy-300 block mb-1.5">Responsabil implicit</label>
                                    <select
                                        value={assignedTo}
                                        onChange={e => setAssignedTo(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                                    >
                                        <option value="">— Neasignat —</option>
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Subtasks */}
                            <div>
                                <label className="text-xs font-medium text-navy-300 block mb-2">Subtask-uri predefinite</label>
                                <div className="space-y-2">
                                    {subtasks.map((s, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <input
                                                value={s}
                                                onChange={e => updateSubtask(i, e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                                                placeholder={`Subtask ${i + 1}`}
                                                className="flex-1 px-3 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50"
                                            />
                                            {subtasks.length > 1 && (
                                                <button onClick={() => removeSubtask(i)} className="text-navy-500 hover:text-red-400 transition-colors">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button onClick={addSubtask} className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                                        <Plus className="w-3.5 h-3.5" /> Adaugă subtask
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 p-5 border-t border-navy-700/50 flex-shrink-0">
                            <button onClick={resetForm} className="px-4 py-2 bg-navy-800/50 text-navy-300 rounded-lg text-sm hover:bg-navy-700/50 transition-colors">
                                Anulează
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!title.trim() || saving}
                                className="px-5 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-medium disabled:opacity-40 transition-all"
                            >
                                {saving ? 'Se salvează...' : 'Creează șablon'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
