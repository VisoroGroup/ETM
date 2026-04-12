import React, { useState, useEffect } from 'react';
import { tasksApi, authApi, departmentsApi } from '../../services/api';
import { Department, DEPARTMENTS, RecurringFrequency, FREQUENCIES, User, OrgDepartment, OrgSection, OrgPost } from '../../types';
import { X, Calendar, Tag, FileText, RefreshCw, UserCircle, Building2, Layers, Briefcase } from 'lucide-react';

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
    const [assignedPostId, setAssignedPostId] = useState<string>('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<RecurringFrequency>('weekly');
    const [workdaysOnly, setWorkdaysOnly] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [users, setUsers] = useState<User[]>([]);

    // Org structure state
    const [orgDepts, setOrgDepts] = useState<OrgDepartment[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<string>('');
    const [selectedSectionId, setSelectedSectionId] = useState<string>('');

    useEffect(() => {
        authApi.users().then(setUsers).catch(() => {});
        departmentsApi.list().then(data => setOrgDepts(data.departments || [])).catch(() => {});
    }, []);

    // When department changes, reset section and post
    const selectedDept = orgDepts.find(d => d.id === selectedDeptId);
    const availableSections = selectedDept?.sections || [];
    const selectedSection = availableSections.find(s => s.id === selectedSectionId);
    const availablePosts = selectedSection?.posts || [];
    const selectedPost = availablePosts.find(p => p.id === assignedPostId);

    // Auto-map org department to old department_label enum for backward compatibility
    const deptNameToEnum: Record<string, Department> = {
        '7 - Administrativ': 'departament_7',
        '1 - HR - Comunicare': 'departament_1',
        '2 - Vânzări': 'departament_2',
        '3 - Financiar': 'departament_3',
        '4 - Producție': 'departament_4',
        '5 - Calitate și calificare': 'departament_5',
        '6 - Extindere': 'departament_6',
    };

    useEffect(() => {
        if (selectedDept) {
            const enumVal = deptNameToEnum[selectedDept.name];
            if (enumVal) setDepartment(enumVal);
        }
    }, [selectedDeptId]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim() || !dueDate) {
            setError('Titlul și termenul limită sunt obligatorii.');
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
                assigned_post_id: assignedPostId || null,
            } as any);

            // Set recurring if needed (non-blocking — task is already created)
            if (isRecurring && task.id) {
                try {
                    const { recurringApi } = await import('../../services/api');
                    await recurringApi.set(task.id, frequency, workdaysOnly);
                } catch (recurErr) {
                    console.error('Recurring setup failed:', recurErr);
                    setError('Sarcina a fost creată, dar recurența nu a putut fi setată. Puteți seta recurența din detalii.');
                    setSaving(false);
                    // Still refresh the list so user sees the new task
                    onCreated();
                    return;
                }
            }

            onCreated();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Eroare la crearea sarcinii.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-lg bg-navy-900 border border-navy-700/50 rounded-2xl shadow-2xl animate-slide-up max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-navy-700/50">
                    <h2 className="text-lg font-bold">Sarcină nouă</h2>
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

                    {/* Date */}
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

                    {/* Org structure: Department → Section → Post */}
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                                <Building2 className="w-3.5 h-3.5 inline mr-1" /> Departament *
                            </label>
                            <select
                                value={selectedDeptId}
                                onChange={e => { setSelectedDeptId(e.target.value); setSelectedSectionId(''); setAssignedPostId(''); }}
                                className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                            >
                                <option value="">— Alege departamentul —</option>
                                {orgDepts.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        {selectedDeptId && availableSections.length > 0 && (
                            <div>
                                <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                                    <Layers className="w-3.5 h-3.5 inline mr-1" /> Secțiune
                                </label>
                                <select
                                    value={selectedSectionId}
                                    onChange={e => { setSelectedSectionId(e.target.value); setAssignedPostId(''); }}
                                    className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                                >
                                    <option value="">— Alege secțiunea —</option>
                                    {availableSections.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {selectedSectionId && availablePosts.length > 0 && (
                            <div>
                                <label className="text-xs font-medium text-navy-400 mb-1.5 block">
                                    <Briefcase className="w-3.5 h-3.5 inline mr-1" /> Post (persoana responsabilă)
                                </label>
                                <select
                                    value={assignedPostId}
                                    onChange={e => setAssignedPostId(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50"
                                >
                                    <option value="">— Alege postul —</option>
                                    {availablePosts.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}{p.user_name ? ` → ${p.user_name}` : ' (neocupat)'}
                                        </option>
                                    ))}
                                </select>
                                {selectedPost?.user_name && (
                                    <p className="text-[10px] text-navy-400 mt-1">
                                        Responsabil automat: <span className="text-blue-400">{selectedPost.user_name}</span>
                                    </p>
                                )}
                            </div>
                        )}
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
                            <span className="text-sm">Sarcină recurentă</span>
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
                            {saving ? 'Se creează...' : 'Creează sarcina'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
