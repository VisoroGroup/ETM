import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, ListTodo, MessageSquare, Paperclip, FileText, Users as UsersIcon, Briefcase, Layers, Building2, X, Loader2 } from 'lucide-react';
import { searchApi, GlobalSearchResult } from '../../services/api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import UserAvatar from '../ui/UserAvatar';
import TaskDrawer from '../tasks/TaskDrawer';
import { timeAgo } from '../../utils/helpers';

/**
 * Global search page.
 * Reachable from the sidebar ("Căutare"). Accepts ?q=... in the URL for deep links.
 * Searches tasks, comments, attachments, policies, users, posts, sections, departments —
 * diacritics-insensitive (so "plati" finds "plăți", "sarcin" finds "sarcină").
 */
export default function SearchPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const initialQ = new URLSearchParams(location.search).get('q') || '';
    const [query, setQuery] = useState(initialQ);
    const debounced = useDebouncedValue(query, 250);
    const [result, setResult] = useState<GlobalSearchResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus the input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Keep URL in sync so people can bookmark / share search URLs
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (query.trim()) {
            params.set('q', query);
        } else {
            params.delete('q');
        }
        const newSearch = params.toString();
        if (newSearch !== location.search.replace(/^\?/, '')) {
            navigate({ search: newSearch ? `?${newSearch}` : '' }, { replace: true });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    // Actual search
    useEffect(() => {
        const q = debounced.trim();
        if (q.length < 1) {
            setResult(null);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        searchApi.search(q, 10)
            .then(data => { if (!cancelled) setResult(data); })
            .catch(() => { if (!cancelled) setResult(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [debounced]);

    function highlight(text: string, q: string): React.ReactNode {
        if (!text || !q.trim()) return text;
        // Strip diacritics from both sides so the highlight matches the user's typed query
        const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const hayNorm = strip(text);
        const needleNorm = strip(q);
        const idx = hayNorm.indexOf(needleNorm);
        if (idx === -1) return text;
        return (
            <>
                {text.substring(0, idx)}
                <mark className="bg-yellow-500/30 text-yellow-200 px-0.5 rounded">
                    {text.substring(idx, idx + q.length)}
                </mark>
                {text.substring(idx + q.length)}
            </>
        );
    }

    const sections: { key: keyof GlobalSearchResult; label: string; icon: React.ReactNode }[] = [
        { key: 'tasks', label: 'Sarcini', icon: <ListTodo className="w-4 h-4 text-blue-400" /> },
        { key: 'comments', label: 'Comentarii', icon: <MessageSquare className="w-4 h-4 text-cyan-400" /> },
        { key: 'attachments', label: 'Fișiere', icon: <Paperclip className="w-4 h-4 text-violet-400" /> },
        { key: 'policies', label: 'Directive', icon: <FileText className="w-4 h-4 text-amber-400" /> },
        { key: 'users', label: 'Utilizatori', icon: <UsersIcon className="w-4 h-4 text-green-400" /> },
        { key: 'posts', label: 'Posturi', icon: <Briefcase className="w-4 h-4 text-purple-400" /> },
        { key: 'sections', label: 'Subdepartamente', icon: <Layers className="w-4 h-4 text-orange-400" /> },
        { key: 'departments', label: 'Departamente', icon: <Building2 className="w-4 h-4 text-red-400" /> },
    ];

    return (
        <div className="p-4 md:p-6 max-w-[1200px] mx-auto w-full animate-fade-in">
            {/* Header */}
            <div className="mb-4">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Search className="w-6 h-6 text-blue-400" />
                    Căutare
                </h1>
                <p className="text-navy-400 text-sm mt-1">
                    Caută în sarcini, comentarii, fișiere, directive, utilizatori, posturi și departamente.
                </p>
            </div>

            {/* Search input */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-400 pointer-events-none" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Scrie un cuvânt — diacriticele nu contează (ex: 'plati' găsește 'plăți')"
                    aria-label="Caută global"
                    className="w-full pl-12 pr-12 py-4 bg-navy-800/50 border border-navy-700/50 rounded-xl text-base text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50 shadow-lg"
                />
                {query && (
                    <button
                        onClick={() => setQuery('')}
                        aria-label="Șterge căutarea"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-navy-400 hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Empty state (no query) */}
            {!query.trim() && (
                <div className="text-center py-16 text-navy-400">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Scrie un cuvânt ca să începi. Căutarea ignoră diacriticele.</p>
                </div>
            )}

            {/* Loading */}
            {query.trim() && loading && (
                <div className="flex items-center justify-center py-12 text-navy-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Se caută…
                </div>
            )}

            {/* Results */}
            {query.trim() && !loading && result && (
                <>
                    {result.total === 0 ? (
                        <div className="text-center py-16 text-navy-400">
                            <p className="text-sm">Niciun rezultat pentru „{query}".</p>
                            <p className="text-xs text-navy-500 mt-1">Încearcă un cuvânt mai scurt sau verifică ortografia.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-xs text-navy-400">{result.total} {result.total === 1 ? 'rezultat' : 'rezultate'}</p>

                            {sections.map(({ key, label, icon }) => {
                                const items = result[key] as any[];
                                if (!Array.isArray(items) || items.length === 0) return null;
                                return (
                                    <div key={key} className="bg-navy-900/50 border border-navy-700/50 rounded-xl overflow-hidden">
                                        <div className="px-4 py-3 border-b border-navy-700/50 flex items-center gap-2">
                                            {icon}
                                            <h3 className="text-sm font-semibold">{label}</h3>
                                            <span className="text-xs text-navy-500">({items.length})</span>
                                        </div>
                                        <div className="divide-y divide-navy-700/30">
                                            {items.map((item: any) => renderResult(key, item, query, highlight, navigate, setSelectedTaskId))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {selectedTaskId && (
                <TaskDrawer
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                    onUpdate={() => {
                        // refresh the current search to pick up any edits
                        searchApi.search(debounced.trim(), 10)
                            .then(setResult)
                            .catch(() => {});
                    }}
                />
            )}
        </div>
    );
}

// --- Per-entity result renderers ---

function renderResult(
    kind: string,
    item: any,
    query: string,
    highlight: (t: string, q: string) => React.ReactNode,
    navigate: (to: string) => void,
    openTask: (id: string) => void
): React.ReactNode {
    switch (kind) {
        case 'tasks':
            return (
                <button
                    key={item.id}
                    onClick={() => openTask(item.id)}
                    className="w-full text-left px-4 py-3 hover:bg-navy-800/40 transition-colors"
                >
                    <div className="flex items-start gap-2">
                        <ListTodo className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{highlight(item.title, query)}</p>
                            {item.description && (
                                <p className="text-xs text-navy-400 mt-0.5 line-clamp-1">
                                    {highlight(item.description.substring(0, 150), query)}
                                </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-navy-500">
                                {item.department_name && <span>{item.department_name}</span>}
                                {item.section_name && <span>· {item.section_name}</span>}
                                {item.post_name && <span>· {item.post_name}</span>}
                                {item.assignee_name && <span>· → {item.assignee_name}</span>}
                            </div>
                        </div>
                    </div>
                </button>
            );
        case 'comments':
            return (
                <button
                    key={item.id}
                    onClick={() => openTask(item.task_id)}
                    className="w-full text-left px-4 py-3 hover:bg-navy-800/40 transition-colors"
                >
                    <div className="flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-navy-500">
                                pe sarcina: <span className="text-navy-300">{item.task_title}</span>
                            </p>
                            <p className="text-sm text-white mt-0.5 line-clamp-2">
                                {highlight(item.content, query)}
                            </p>
                            <p className="text-[10px] text-navy-500 mt-1">
                                {item.author_name} · {timeAgo(item.created_at)}
                            </p>
                        </div>
                    </div>
                </button>
            );
        case 'attachments':
            return (
                <button
                    key={item.id}
                    onClick={() => openTask(item.task_id)}
                    className="w-full text-left px-4 py-3 hover:bg-navy-800/40 transition-colors"
                >
                    <div className="flex items-start gap-2">
                        <Paperclip className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{highlight(item.filename, query)}</p>
                            <p className="text-xs text-navy-500 mt-0.5">pe sarcina: {item.task_title}</p>
                        </div>
                    </div>
                </button>
            );
        case 'policies':
            return (
                <div key={item.id} className="px-4 py-3 hover:bg-navy-800/40 transition-colors">
                    <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">{highlight(item.title, query)}</p>
                            <p className="text-[10px] text-navy-500 mt-0.5">scope: {item.scope}</p>
                        </div>
                    </div>
                </div>
            );
        case 'users':
            return (
                <div key={item.id} className="px-4 py-3 hover:bg-navy-800/40 transition-colors flex items-center gap-3">
                    <UserAvatar name={item.display_name} avatarUrl={item.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{highlight(item.display_name, query)}</p>
                        <p className="text-xs text-navy-500">{highlight(item.email, query)} · {item.role}</p>
                    </div>
                </div>
            );
        case 'posts':
            return (
                <button
                    key={item.id}
                    onClick={() => navigate(`/tasks`)}
                    className="w-full text-left px-4 py-3 hover:bg-navy-800/40 transition-colors"
                >
                    <div className="flex items-start gap-2">
                        <Briefcase className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{highlight(item.name, query)}</p>
                            <p className="text-xs text-navy-500 mt-0.5">
                                {item.department_name} · {item.section_name}
                                {item.user_name && ` · → ${item.user_name}`}
                            </p>
                        </div>
                    </div>
                </button>
            );
        case 'sections':
            return (
                <div key={item.id} className="px-4 py-3 hover:bg-navy-800/40 transition-colors">
                    <div className="flex items-start gap-2">
                        <Layers className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">{highlight(item.name, query)}</p>
                            <p className="text-xs text-navy-500 mt-0.5">{item.department_name}</p>
                        </div>
                    </div>
                </div>
            );
        case 'departments':
            return (
                <div key={item.id} className="px-4 py-3 hover:bg-navy-800/40 transition-colors flex items-center gap-2">
                    <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: item.color || '#666' }} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{highlight(item.name, query)}</p>
                        {item.pfv && <p className="text-xs text-navy-500 mt-0.5 line-clamp-1">{highlight(item.pfv, query)}</p>}
                    </div>
                </div>
            );
        default:
            return null;
    }
}
