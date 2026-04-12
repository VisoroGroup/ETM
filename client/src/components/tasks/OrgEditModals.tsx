import React, { useState, useEffect } from 'react';
import { X, Trash2, Save } from 'lucide-react';
import { OrgDepartment, OrgSection, OrgPost, User } from '../../types';
import { departmentsApi, sectionsApi, postsApi, authApi } from '../../services/api';

// ============================================================
// Shared modal wrapper
// ============================================================
function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-md bg-navy-900 border border-navy-700/50 rounded-2xl shadow-2xl animate-slide-up max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-navy-700/50">
                    <h2 className="text-base font-bold">{title}</h2>
                    <button onClick={onClose} className="text-navy-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1 space-y-4">
                    {children}
                </div>
            </div>
        </div>
    );
}

function InputField({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
    const cls = "w-full px-3 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50";
    return (
        <div>
            <label className="text-xs font-medium text-navy-400 mb-1 block">{label}</label>
            {multiline ? (
                <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2} className={cls + ' resize-none'} />
            ) : (
                <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
            )}
        </div>
    );
}

function ActionButtons({ saving, onSave, onDelete, onClose }: { saving: boolean; onSave: () => void; onDelete?: () => void; onClose: () => void }) {
    return (
        <div className="flex items-center gap-2 pt-2">
            {onDelete && (
                <button onClick={onDelete} className="flex items-center gap-1 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Dezactivează
                </button>
            )}
            <div className="flex-1" />
            <button onClick={onClose} className="px-4 py-2 text-sm text-navy-400 hover:text-white transition-colors">Anulează</button>
            <button onClick={onSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white rounded-lg text-sm transition-colors">
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Se salvează...' : 'Salvează'}
            </button>
        </div>
    );
}

// ============================================================
// DEPARTMENT EDIT MODAL
// ============================================================
export function DepartmentEditModal({ department, onClose, onSaved }: { department: OrgDepartment; onClose: () => void; onSaved: () => void }) {
    const [name, setName] = useState(department.name);
    const [color, setColor] = useState(department.color);
    const [pfv, setPfv] = useState(department.pfv || '');
    const [statisticName, setStatisticName] = useState(department.statistic_name || '');
    const [headUserId, setHeadUserId] = useState(department.head_user_id || '');
    const [users, setUsers] = useState<User[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => { authApi.users().then(setUsers).catch(() => {}); }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await departmentsApi.update(department.id, { name, color, head_user_id: headUserId || null, pfv: pfv || null, statistic_name: statisticName || null } as any);
            onSaved();
            onClose();
        } catch (err) { console.error(err); } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!confirm('Sigur dorești să dezactivezi acest departament?')) return;
        try { await departmentsApi.delete(department.id); onSaved(); onClose(); } catch (err) { console.error(err); }
    };

    return (
        <ModalWrapper title={`Editare: ${department.name}`} onClose={onClose}>
            <InputField label="Nume" value={name} onChange={setName} />
            <div>
                <label className="text-xs font-medium text-navy-400 mb-1 block">Culoare</label>
                <div className="flex items-center gap-2">
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-8 rounded border border-navy-700/50 cursor-pointer" />
                    <span className="text-xs text-navy-400">{color}</span>
                </div>
            </div>
            <div>
                <label className="text-xs font-medium text-navy-400 mb-1 block">Responsabil departament</label>
                <select value={headUserId} onChange={e => setHeadUserId(e.target.value)} className="w-full px-3 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50">
                    <option value="">— Nimeni —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                </select>
            </div>
            <InputField label="PFV" value={pfv} onChange={setPfv} multiline />
            <InputField label="Statistică" value={statisticName} onChange={setStatisticName} />
            <ActionButtons saving={saving} onSave={handleSave} onDelete={handleDelete} onClose={onClose} />
        </ModalWrapper>
    );
}

// ============================================================
// SECTION EDIT MODAL
// ============================================================
export function SectionEditModal({ section, onClose, onSaved }: { section: OrgSection; onClose: () => void; onSaved: () => void }) {
    const [name, setName] = useState(section.name);
    const [pfv, setPfv] = useState(section.pfv || '');
    const [headUserId, setHeadUserId] = useState(section.head_user_id || '');
    const [users, setUsers] = useState<User[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => { authApi.users().then(setUsers).catch(() => {}); }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await sectionsApi.update(section.id, { name, head_user_id: headUserId || null, pfv: pfv || null } as any);
            onSaved();
            onClose();
        } catch (err) { console.error(err); } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!confirm('Sigur dorești să dezactivezi această secțiune?')) return;
        try { await sectionsApi.delete(section.id); onSaved(); onClose(); } catch (err) { console.error(err); }
    };

    return (
        <ModalWrapper title={`Editare secțiune: ${section.name}`} onClose={onClose}>
            <InputField label="Nume" value={name} onChange={setName} />
            <div>
                <label className="text-xs font-medium text-navy-400 mb-1 block">Responsabil secțiune</label>
                <select value={headUserId} onChange={e => setHeadUserId(e.target.value)} className="w-full px-3 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50">
                    <option value="">— Nimeni —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                </select>
            </div>
            <InputField label="PFV" value={pfv} onChange={setPfv} multiline />
            <ActionButtons saving={saving} onSave={handleSave} onDelete={handleDelete} onClose={onClose} />
        </ModalWrapper>
    );
}

// ============================================================
// POST EDIT MODAL
// ============================================================
export function PostEditModal({ post, onClose, onSaved }: { post: OrgPost; onClose: () => void; onSaved: () => void }) {
    const [name, setName] = useState(post.name);
    const [description, setDescription] = useState(post.description || '');
    const [userId, setUserId] = useState(post.user_id || '');
    const [users, setUsers] = useState<User[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => { authApi.users().then(setUsers).catch(() => {}); }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await postsApi.update(post.id, { name, user_id: userId || null, description: description || null } as any);
            onSaved();
            onClose();
        } catch (err) { console.error(err); } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!confirm('Sigur dorești să dezactivezi acest post?')) return;
        try { await postsApi.delete(post.id); onSaved(); onClose(); } catch (err) { console.error(err); }
    };

    return (
        <ModalWrapper title={`Editare post: ${post.name}`} onClose={onClose}>
            <InputField label="Nume post" value={name} onChange={setName} />
            <div>
                <label className="text-xs font-medium text-navy-400 mb-1 block">User asignat</label>
                <select value={userId} onChange={e => setUserId(e.target.value)} className="w-full px-3 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50">
                    <option value="">— Vacant —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                </select>
                {userId !== (post.user_id || '') && userId && post.user_id && (
                    <p className="text-[10px] text-amber-400 mt-1">
                        Atenție: schimbarea userului va actualiza responsabilul pe toate taskurile active ale acestui post!
                    </p>
                )}
            </div>
            <InputField label="Descriere" value={description} onChange={setDescription} multiline placeholder="Ce presupune acest post..." />
            <ActionButtons saving={saving} onSave={handleSave} onDelete={handleDelete} onClose={onClose} />
        </ModalWrapper>
    );
}
