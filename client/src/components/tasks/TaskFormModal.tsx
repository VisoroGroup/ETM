import React, { useState, useEffect } from 'react';
import { tasksApi, authApi } from '../../services/api';
import { Department, DEPARTMENTS, RecurringFrequency, FREQUENCIES, User } from '../../types';
import { X, Calendar, Tag, FileText, RefreshCw, UserCircle } from 'lucide-react';

interface Props {
    onClose: () => void;
    onCreated: () => void;
}

export default function TaskFormModal({ onClose, onCreated }: Props) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [department, setDepartment] = useState<Department>('departament_1');
    const [assignedTo, setAssignedTo] = useState<string>('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<RecurringFrequency>('weekly');
    const [workdaysOnly, setWorkdaysOnly] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        authApi.users().then(setUsers).catch(() => {});
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim() || !dueDate) {
            setError('Titlul și data limită sunt obligatorii.');
            return;
        }

        try {
            setSaving(true);
            const task = await tasksApi.create({
                title: title.trim(),
                description: description.trim() || null,
                due_date: dueDate,
                department_label: department,
                assigned_to: assignedTo || null,
            } as any);

            // Set recurring if needed
            if (isRecurring && task.id) {
                const { recurringApi } = await import('../../services/api');
                await recurringApi.set(task.id, frequency, workdaysOnly);
            }

            onCreated();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Eroare la crearea task-ului.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-lg bg-navy-900 border border-navy-700/50 rounded-2xl shadow-2xl animate-slide-up max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
                    <h2 className="text-lg font-bold">Task nou</h2>
                    <button onClick={onClose} className="text-navy-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
                    {error && (
                        <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</div>
                    )}

                    <div>
                        <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                            <FileText className="w-3.5 h-3.5 inline mr-1" /> Titlu *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            maxLength={500}
                            placeholder="Ex: Pregătirea raportului trimestrial"
                            className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-navy-400 mb-1.5 block">Descriere</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Detalii suplimentare..."
                            className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50 resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                                <Calendar className="w-3.5 h-3.5 inline mr-1" /> Data limită *
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                                <Tag className="w-3.5 h-3.5 inline mr-1" /> Departament *
                            </label>
                            <select
                                value={department}
                                onChange={e => setDepartment(e.target.value as Department)}
                                className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                            >
                                {(Object.keys(DEPARTMENTS) as Department[]).map(d => (
                                    <option key={d} value={d}>{DEPARTMENTS[d].label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Assignee */}
                    <div>
                        <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                            <UserCircle className="w-3.5 h-3.5 inline mr-1" /> Responsabil
                        </label>
                        <select
                            value={assignedTo}
                            onChange={e => setAssignedTo(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                        >
                            <option value="">— Neasignat —</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
                            ))}
                        </select>
                    </div>

                    {/* Recurring */}
                    <div className="bg-navy-800/30 rounded-lg p-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isRecurring}
                                onChange={e => setIsRecurring(e.target.checked)}
                                className="w-4 h-4 rounded border-navy-600 bg-navy-800 text-blue-500 focus:ring-blue-500"
                            />
                            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-sm">Task recurent</span>
                        </label>
                        {isRecurring && (
                            <div className="mt-3 ml-6">
                                <select
                                    value={frequency}
                                    onChange={e => setFrequency(e.target.value as RecurringFrequency)}
                                    className="w-full px-3 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                                >
                                    {(Object.keys(FREQUENCIES) as RecurringFrequency[]).map(f => (
                                        <option key={f} value={f}>{FREQUENCIES[f]}</option>
                                    ))}
                                </select>
                                {frequency === 'daily' && (
                                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={workdaysOnly}
                                            onChange={e => setWorkdaysOnly(e.target.checked)}
                                            className="w-4 h-4 rounded border-navy-600 bg-navy-800 text-blue-500 focus:ring-blue-500"
                                        />
                                        <span className="text-xs text-navy-300">Doar în zile lucrătoare (Luni-Vineri)</span>
                                    </label>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 bg-navy-800/50 text-navy-300 rounded-lg text-sm hover:bg-navy-700/50 transition-colors"
                        >
                            Anulează
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-sm font-medium shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 transition-all"
                        >
                            {saving ? 'Se creează...' : 'Creează task'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
