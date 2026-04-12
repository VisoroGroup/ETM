import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { X, FileText, ChevronRight, ArrowLeft, Upload, Building2, Users, UserCircle } from 'lucide-react';
import { Policy, PolicyScope } from '../../types';
import { policiesApi } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

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
    const [policies, setPolicies] = useState<Policy[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
    const [activeTab, setActiveTab] = useState<PolicyScope>(scope || 'COMPANY');

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

    const tabs: { key: PolicyScope; label: string; icon: React.ReactNode }[] = [
        { key: 'COMPANY', label: 'Companie', icon: <Building2 className="w-3.5 h-3.5" /> },
        { key: 'DEPARTMENT', label: 'Departament', icon: <Users className="w-3.5 h-3.5" /> },
        { key: 'POST', label: 'Post', icon: <UserCircle className="w-3.5 h-3.5" /> },
    ];

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Drawer */}
            <div className={`relative w-full max-w-2xl h-full flex flex-col shadow-2xl animate-slide-in-right ${
                darkMode ? 'bg-navy-900 border-l border-navy-700/50' : 'bg-white border-l border-gray-200'
            }`}>
                {/* Header */}
                <div className={`flex items-center justify-between px-5 py-4 border-b ${
                    darkMode ? 'border-navy-700/50' : 'border-gray-200'
                }`}>
                    {selectedPolicy ? (
                        <button
                            onClick={() => setSelectedPolicy(null)}
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
                {selectedPolicy ? (
                    /* Single policy view — rendered HTML */
                    <div className="flex-1 overflow-y-auto">
                        <div className={`px-5 py-4 border-b ${darkMode ? 'border-navy-700/30' : 'border-gray-100'}`}>
                            <h3 className="font-semibold text-sm">{selectedPolicy.title}</h3>
                            <div className={`flex items-center gap-3 mt-1.5 text-xs ${darkMode ? 'text-navy-400' : 'text-gray-500'}`}>
                                {selectedPolicy.directive_number && (
                                    <span>Nr. {selectedPolicy.directive_number}</span>
                                )}
                                <span>{selectedPolicy.date}</span>
                                {selectedPolicy.creator_name && (
                                    <span>de {selectedPolicy.creator_name}</span>
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
                                    onClick={() => { setActiveTab(tab.key); setSelectedPolicy(null); }}
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

                        {/* Policy list */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-1">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : policies.length === 0 ? (
                                <div className={`text-center py-12 ${darkMode ? 'text-navy-500' : 'text-gray-400'}`}>
                                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">Nicio directivă în această categorie.</p>
                                </div>
                            ) : (
                                policies.map(policy => (
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
                                <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-400 text-white transition-colors">
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
