import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { X, FileText, ChevronRight, ArrowLeft, Upload, Building2, Users, UserCircle, Pencil, Trash2, Search, Plus } from 'lucide-react';
import { Policy, PolicyScope } from '../../types';
import { policiesApi, departmentsApi } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

interface Props {
    open: boolean;
    onClose: () => void;
    scope?: PolicyScope;
    departmentId?: string;
    postId?: string;
    title?: string;
    darkMode?: boolean;
}

export default function PolicyDrawer({ open, onClose, scope, departmentId, postId, title, darkMode = true }: Props) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
    const [activeTab, setActiveTab] = useState<PolicyScope>(scope || 'COMPANY');
    const [searchQuery, setSearchQuery] = useState('');
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);

    const isSuperAdmin = user?.role === 'superadmin';

    useEffect(() => {
        if (!open) return;
        loadPolicies();
    }, [open, activeTab, departmentId, postId]);

    const loadPolicies = async () => {
        setLoading(true);
        try {
            const params: any = { scope: activeTab };
            if (activeTab === 'DEPARTMENT' && departmentId) params.department_id = departmentId;
            if (activeTab === 'POST' && postId) params.post_id = postId;
            const data = await policiesApi.list(params);
            setPolicies(data);
        } catch (err) {
            console.error('Failed to load policies:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    const filteredPolicies = searchQuery
        ? policies.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
        : policies;

    const tabs: { key: PolicyScope; label: string; icon: React.ReactNode }[] = [
        { key: 'COMPANY', label: 'Companie', icon: <Building2 className="w-3.5 h-3.5" /> },
        { key: 'DEPARTMENT', label: 'Departament', icon: <Users className="w-3.5 h-3.5" /> },
        { key: 'POST', label: 'Post', icon: <UserCircle className="w-3.5 h-3.5" /> },
    ];

    const handleDelete = async (policyId: string) => {
        if (!confirm('Sigur dorești să ștergi această directivă?')) return;
        try {
            await policiesApi.delete(policyId);
            showToast('Directiva a fost ștearsă.');
            setSelectedPolicy(null);
            loadPolicies();
        } catch (err) {
            showToast('Eroare la ștergere.', 'error');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className={`relative w-full max-w-2xl h-full flex flex-col shadow-2xl animate-slide-in-right ${
                darkMode ? 'bg-navy-900 border-l border-navy-700/50' : 'bg-white border-l border-gray-200'
            }`}>
                {/* Header */}
                <div className={`flex items-center justify-between px-5 py-4 border-b ${
                    darkMode ? 'border-navy-700/50' : 'border-gray-200'
                }`}>
                    {selectedPolicy ? (
                        <button
                            onClick={() => { setSelectedPolicy(null); setShowEditForm(false); }}
                            className={`flex items-center gap-2 text-sm font-medium ${
                                darkMode ? 'text-navy-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Înapoi la listă
                        </button>
                    ) : showUploadForm ? (
                        <button
                            onClick={() => setShowUploadForm(false)}
                            className={`flex items-center gap-2 text-sm font-medium ${
                                darkMode ? 'text-navy-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Înapoi la listă
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-400" />
                            <h2 className="text-lg font-semibold">{title || 'Directive de funcționare'}</h2>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${
                            darkMode ? 'hover:bg-navy-800 text-navy-400' : 'hover:bg-gray-100 text-gray-500'
                        }`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                {showUploadForm || showEditForm ? (
                    <PolicyUploadForm
                        darkMode={darkMode}
                        scope={activeTab}
                        departmentId={departmentId}
                        postId={postId}
                        editPolicy={showEditForm ? selectedPolicy : null}
                        onSaved={() => {
                            setShowUploadForm(false);
                            setShowEditForm(false);
                            setSelectedPolicy(null);
                            loadPolicies();
                            showToast(showEditForm ? 'Directiva a fost actualizată.' : 'Directiva a fost încărcată.');
                        }}
                        onCancel={() => { setShowUploadForm(false); setShowEditForm(false); }}
                    />
                ) : selectedPolicy ? (
                    /* Single policy view */
                    <div className="flex-1 overflow-y-auto">
                        <div className={`px-5 py-4 border-b ${darkMode ? 'border-navy-700/30' : 'border-gray-100'}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-sm">{selectedPolicy.title}</h3>
                                    <div className={`flex items-center gap-3 mt-1.5 text-xs ${darkMode ? 'text-navy-400' : 'text-gray-500'}`}>
                                        {selectedPolicy.directive_number && <span>Nr. {selectedPolicy.directive_number}</span>}
                                        <span>{selectedPolicy.date}</span>
                                        {selectedPolicy.creator_name && <span>de {selectedPolicy.creator_name}</span>}
                                    </div>
                                </div>
                                {isSuperAdmin && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setShowEditForm(true)}
                                            className="p-2 rounded-lg text-navy-400 hover:text-blue-400 hover:bg-navy-800/50 transition-colors"
                                            title="Editează"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(selectedPolicy.id)}
                                            className="p-2 rounded-lg text-navy-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                            title="Șterge"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div
                            className="px-5 py-4 policy-html-content"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedPolicy.content_html) }}
                        />
                    </div>
                ) : (
                    /* Policy list */
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Scope tabs */}
                        <div className={`flex border-b px-4 ${darkMode ? 'border-navy-700/50' : 'border-gray-200'}`}>
                            {tabs.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => { setActiveTab(tab.key); setSelectedPolicy(null); setSearchQuery(''); }}
                                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                                        activeTab === tab.key
                                            ? 'border-blue-500 text-blue-400'
                                            : darkMode
                                                ? 'border-transparent text-navy-400 hover:text-navy-200'
                                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Search */}
                        {policies.length > 5 && (
                            <div className={`px-4 py-2 border-b ${darkMode ? 'border-navy-700/30' : 'border-gray-100'}`}>
                                <div className="relative">
                                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${darkMode ? 'text-navy-500' : 'text-gray-400'}`} />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Caută directivă..."
                                        className={`w-full pl-9 pr-4 py-2 rounded-lg text-xs focus:outline-none ${
                                            darkMode
                                                ? 'bg-navy-800/50 border border-navy-700/50 text-white placeholder:text-navy-500 focus:border-blue-500/50'
                                                : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500'
                                        }`}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Policy list */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-1">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : filteredPolicies.length === 0 ? (
                                <div className={`text-center py-12 ${darkMode ? 'text-navy-500' : 'text-gray-400'}`}>
                                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">
                                        {searchQuery ? 'Nicio directivă găsită.' : 'Nicio directivă în această categorie.'}
                                    </p>
                                    {isSuperAdmin && !searchQuery && (
                                        <button
                                            onClick={() => setShowUploadForm(true)}
                                            className="mt-3 text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            + Adaugă prima directivă
                                        </button>
                                    )}
                                </div>
                            ) : (
                                filteredPolicies.map(policy => (
                                    <button
                                        key={policy.id}
                                        onClick={() => setSelectedPolicy(policy)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                                            darkMode
                                                ? 'hover:bg-navy-800/50 text-navy-200'
                                                : 'hover:bg-gray-50 text-gray-700'
                                        }`}
                                    >
                                        <FileText className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-navy-500' : 'text-gray-400'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{policy.title}</p>
                                            <div className={`flex items-center gap-2 mt-0.5 text-[10px] ${darkMode ? 'text-navy-500' : 'text-gray-400'}`}>
                                                {policy.directive_number && <span>Nr. {policy.directive_number}</span>}
                                                <span>{policy.date}</span>
                                            </div>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-navy-600' : 'text-gray-300'}`} />
                                    </button>
                                ))
                            )}
                        </div>

                        {/* Upload button (superadmin) */}
                        {isSuperAdmin && (
                            <div className={`px-4 py-3 border-t ${darkMode ? 'border-navy-700/50' : 'border-gray-200'}`}>
                                <button
                                    onClick={() => setShowUploadForm(true)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-400 text-white transition-colors"
                                >
                                    <Upload className="w-4 h-4" />
                                    Încarcă directivă
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Upload / Edit Form ──────────────────────────────────────────────────────

function PolicyUploadForm({ darkMode, scope, departmentId, postId, editPolicy, onSaved, onCancel }: {
    darkMode: boolean;
    scope: PolicyScope;
    departmentId?: string;
    postId?: string;
    editPolicy: Policy | null;
    onSaved: () => void;
    onCancel: () => void;
}) {
    const [formTitle, setFormTitle] = useState(editPolicy?.title || '');
    const [directiveNumber, setDirectiveNumber] = useState(editPolicy?.directive_number?.toString() || '');
    const [date, setDate] = useState(editPolicy?.date || new Date().toISOString().split('T')[0]);
    const [formScope, setFormScope] = useState<PolicyScope>(editPolicy?.scope || scope || 'COMPANY');
    const [htmlContent, setHtmlContent] = useState(editPolicy?.content_html || '');
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [depts, setDepts] = useState<any[]>([]);
    const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>(editPolicy?.departments?.map((d: any) => d.id) || (departmentId ? [departmentId] : []));
    const [selectedPostIds, setSelectedPostIds] = useState<string[]>(editPolicy?.posts?.map((p: any) => p.id) || (postId ? [postId] : []));
    const [allPosts, setAllPosts] = useState<any[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        departmentsApi.list().then(data => {
            setDepts(data.departments || []);
            const posts: any[] = [];
            for (const dept of (data.departments || [])) {
                for (const sec of (dept.sections || [])) {
                    for (const post of (sec.posts || [])) {
                        posts.push({ ...post, deptName: dept.name, secName: sec.name });
                    }
                }
            }
            setAllPosts(posts);
        }).catch(() => {});
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        // Read content for preview
        const reader = new FileReader();
        reader.onload = () => setHtmlContent(reader.result as string);
        reader.readAsText(f);
    };

    const handleSubmit = async () => {
        if (!formTitle.trim()) { setError('Titlul este obligatoriu.'); return; }
        if (!date) { setError('Data este obligatorie.'); return; }
        if (!htmlContent && !file) { setError('Conținutul HTML este obligatoriu.'); return; }

        setSaving(true);
        setError('');

        try {
            if (editPolicy) {
                // Update existing
                await policiesApi.update(editPolicy.id, {
                    title: formTitle.trim(),
                    directive_number: directiveNumber ? parseInt(directiveNumber) : null,
                    date,
                    scope: formScope,
                    content_html: htmlContent,
                    department_ids: formScope === 'DEPARTMENT' ? selectedDeptIds : [],
                    post_ids: formScope === 'POST' ? selectedPostIds : [],
                } as any);
            } else {
                // Create new — use FormData for file upload
                const formData = new FormData();
                formData.append('title', formTitle.trim());
                formData.append('date', date);
                formData.append('scope', formScope);
                if (directiveNumber) formData.append('directive_number', directiveNumber);
                if (formScope === 'DEPARTMENT') formData.append('department_ids', JSON.stringify(selectedDeptIds));
                if (formScope === 'POST') formData.append('post_ids', JSON.stringify(selectedPostIds));

                if (file) {
                    formData.append('file', file);
                } else {
                    formData.append('content_html', htmlContent);
                }

                await policiesApi.upload(formData);
            }
            onSaved();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Eroare la salvare.');
        } finally {
            setSaving(false);
        }
    };

    const inputCls = `w-full px-3 py-2 rounded-lg text-sm focus:outline-none ${
        darkMode
            ? 'bg-navy-800/50 border border-navy-700/50 text-white placeholder:text-navy-500 focus:border-blue-500/50'
            : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-blue-500'
    }`;
    const labelCls = `text-xs font-medium mb-1.5 block ${darkMode ? 'text-navy-400' : 'text-gray-600'}`;

    return (
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <h3 className="text-sm font-semibold">{editPolicy ? 'Editare directivă' : 'Directivă nouă'}</h3>

            {error && <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</div>}

            <div>
                <label className={labelCls}>Titlu *</label>
                <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Titlul directivei" className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Nr. directivă</label>
                    <input type="number" value={directiveNumber} onChange={e => setDirectiveNumber(e.target.value)} placeholder="Ex: 1" className={inputCls} />
                </div>
                <div>
                    <label className={labelCls}>Data *</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
                </div>
            </div>

            <div>
                <label className={labelCls}>Scope *</label>
                <select value={formScope} onChange={e => setFormScope(e.target.value as PolicyScope)} className={inputCls}>
                    <option value="COMPANY">Companie</option>
                    <option value="DEPARTMENT">Departament</option>
                    <option value="POST">Post</option>
                </select>
            </div>

            {formScope === 'DEPARTMENT' && (
                <div>
                    <label className={labelCls}>Departamente</label>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                        {depts.map(d => (
                            <label key={d.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedDeptIds.includes(d.id)}
                                    onChange={e => {
                                        if (e.target.checked) setSelectedDeptIds(prev => [...prev, d.id]);
                                        else setSelectedDeptIds(prev => prev.filter(id => id !== d.id));
                                    }}
                                    className="rounded border-navy-600"
                                />
                                {d.name}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {formScope === 'POST' && (
                <div>
                    <label className={labelCls}>Posturi</label>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                        {allPosts.map(p => (
                            <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedPostIds.includes(p.id)}
                                    onChange={e => {
                                        if (e.target.checked) setSelectedPostIds(prev => [...prev, p.id]);
                                        else setSelectedPostIds(prev => prev.filter(id => id !== p.id));
                                    }}
                                    className="rounded border-navy-600"
                                />
                                <span className="text-navy-400">{p.deptName}</span> · {p.name}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <label className={labelCls}>Fișier HTML</label>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm"
                    onChange={handleFileChange}
                    className="hidden"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed transition-colors ${
                        darkMode
                            ? 'border-navy-600 hover:border-navy-500 text-navy-400 hover:text-navy-300'
                            : 'border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-600'
                    }`}
                >
                    <Upload className="w-4 h-4" />
                    {file ? file.name : 'Alege fișier HTML (.html)'}
                </button>
                {htmlContent && (
                    <p className={`text-[10px] mt-1 ${darkMode ? 'text-navy-500' : 'text-gray-400'}`}>
                        {Math.round(htmlContent.length / 1024)} KB conținut HTML încărcat
                    </p>
                )}
            </div>

            {!file && !editPolicy && (
                <div>
                    <label className={labelCls}>Sau scrie HTML direct</label>
                    <textarea
                        value={htmlContent}
                        onChange={e => setHtmlContent(e.target.value)}
                        rows={6}
                        placeholder="<h1>Titlu</h1><p>Conținut...</p>"
                        className={`${inputCls} resize-none font-mono text-xs`}
                    />
                </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
                <button onClick={onCancel} className={`px-4 py-2 rounded-lg text-sm ${darkMode ? 'text-navy-300 hover:bg-navy-800' : 'text-gray-500 hover:bg-gray-100'}`}>
                    Anulează
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="px-5 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-50 transition-colors"
                >
                    {saving ? 'Se salvează...' : editPolicy ? 'Salvează' : 'Încarcă directiva'}
                </button>
            </div>
        </div>
    );
}
