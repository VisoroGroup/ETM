import { useState, useEffect, useRef } from 'react';
import { useTaskDependencies } from '../../../hooks/useTaskDependencies';
import { tasksApi } from '../../../services/api';
import { useToast } from '../../../hooks/useToast';
import type { Task, TaskDependency } from '../../../types';
import { STATUSES } from '../../../types';
import { Link2, X, Search, CheckCircle2, Plus, Loader2 } from 'lucide-react';

interface Props {
    taskId: string;
    onReload: () => void;
}

export default function DependenciesTab({ taskId, onReload }: Props) {
    const { blocks, blockedBy, isLoading, addDependency, removeDependency, isAdding } = useTaskDependencies(taskId);
    const { showToast } = useToast();

    // Search
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Task[]>([]);
    const [searching, setSearching] = useState(false);
    const [direction, setDirection] = useState<'blocks' | 'blocked_by'>('blocked_by');
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await tasksApi.list({ search: searchQuery, limit: 8 });
                // Filter out current task and already-linked tasks
                const linked = new Set([...blocks.map(d => d.blocked_task_id), ...blockedBy.map(d => d.blocking_task_id), taskId]);
                setSearchResults(res.tasks.filter((t: Task) => !linked.has(t.id)));
            } catch {
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, taskId, blocks, blockedBy]);

    function handleAdd(targetId: string) {
        const data = direction === 'blocked_by'
            ? { blocking_task_id: targetId, blocked_task_id: taskId }
            : { blocking_task_id: taskId, blocked_task_id: targetId };

        addDependency(data, {
            onSuccess: () => {
                showToast('Dependență adăugată!');
                setShowSearch(false);
                setSearchQuery('');
                setSearchResults([]);
                onReload();
            },
            onError: (err: any) => {
                const msg = err.response?.data?.error || 'Eroare la adăugarea dependenței';
                showToast(msg, 'error');
            },
        });
    }

    function handleRemove(depId: string) {
        removeDependency(depId, {
            onSuccess: () => {
                showToast('Dependență eliminată');
                onReload();
            },
            onError: () => showToast('Eroare', 'error'),
        });
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-navy-500 animate-spin" />
            </div>
        );
    }

    const renderDep = (dep: TaskDependency, type: 'blocks' | 'blocked_by') => {
        const title = type === 'blocks' ? dep.blocked_task_title : dep.blocking_task_title;
        const status = type === 'blocks' ? dep.blocked_task_status : dep.blocking_task_status;
        const isResolved = (type === 'blocked_by' && dep.blocking_task_status === 'terminat') ||
                           (type === 'blocks' && dep.blocked_task_status === 'terminat');

        return (
            <div
                key={dep.id}
                className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors group ${
                    isResolved
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-navy-800/30 border-navy-700/30 hover:border-navy-600/50'
                }`}
            >
                {isResolved ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                ) : (
                    <Link2 className="w-4 h-4 text-orange-400 flex-shrink-0" />
                )}
                <span className={`flex-1 text-sm truncate ${isResolved ? 'line-through text-navy-500' : 'text-white'}`}>
                    {title}
                </span>
                {status && (
                    <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ background: STATUSES[status]?.bg, color: STATUSES[status]?.color }}
                    >
                        {STATUSES[status]?.label}
                    </span>
                )}
                <button
                    onClick={() => handleRemove(dep.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-navy-500 hover:text-red-400 transition-all"
                    title="Elimină dependența"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    };

    return (
        <div className="space-y-5">
            {/* Blocked by section */}
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-400/70 mb-2">
                    🔒 Blocat de ({blockedBy.length})
                </p>
                {blockedBy.length > 0 ? (
                    <div className="space-y-1.5">
                        {blockedBy.map(dep => renderDep(dep, 'blocked_by'))}
                    </div>
                ) : (
                    <p className="text-xs text-navy-500 italic pl-1">Acest task nu este blocat de nimic</p>
                )}
            </div>

            {/* Blocks section */}
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400/70 mb-2">
                    🚫 Blochează ({blocks.length})
                </p>
                {blocks.length > 0 ? (
                    <div className="space-y-1.5">
                        {blocks.map(dep => renderDep(dep, 'blocks'))}
                    </div>
                ) : (
                    <p className="text-xs text-navy-500 italic pl-1">Acest task nu blochează nimic</p>
                )}
            </div>

            {/* Add dependency */}
            {!showSearch ? (
                <button
                    onClick={() => {
                        setShowSearch(true);
                        setTimeout(() => searchRef.current?.focus(), 50);
                    }}
                    className="flex items-center gap-1.5 w-full px-3 py-2.5 bg-navy-800/30 border border-dashed border-navy-600/50 rounded-lg text-xs text-navy-400 hover:text-blue-400 hover:border-blue-500/40 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" /> Adaugă dependență
                </button>
            ) : (
                <div className="bg-navy-800/40 border border-navy-700/50 rounded-xl p-3 space-y-3">
                    {/* Direction picker */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setDirection('blocked_by')}
                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                direction === 'blocked_by' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-navy-800/50 text-navy-400 border border-transparent'
                            }`}
                        >
                            🔒 Blocat de...
                        </button>
                        <button
                            onClick={() => setDirection('blocks')}
                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                direction === 'blocks' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-navy-800/50 text-navy-400 border border-transparent'
                            }`}
                        >
                            🚫 Blochează...
                        </button>
                    </div>

                    {/* Search input */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-navy-500" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Caută task după titlu..."
                            className="w-full pl-9 pr-8 py-2 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50"
                        />
                        <button
                            onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-navy-500 hover:text-white transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Results */}
                    {searching && (
                        <div className="flex items-center justify-center py-3">
                            <Loader2 className="w-4 h-4 text-navy-500 animate-spin" />
                        </div>
                    )}
                    {searchResults.length > 0 && (
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                            {searchResults.map(task => (
                                <button
                                    key={task.id}
                                    onClick={() => handleAdd(task.id)}
                                    disabled={isAdding}
                                    className="w-full flex items-center gap-2 px-3 py-2 bg-navy-800/30 hover:bg-navy-700/40 rounded-lg text-left transition-colors disabled:opacity-50"
                                >
                                    <span className="flex-1 text-sm text-white truncate">{task.title}</span>
                                    <span
                                        className="px-1.5 py-0.5 rounded text-[10px]"
                                        style={{ background: STATUSES[task.status]?.bg, color: STATUSES[task.status]?.color }}
                                    >
                                        {STATUSES[task.status]?.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                    {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                        <p className="text-xs text-navy-500 text-center py-2">Nu s-au găsit task-uri</p>
                    )}
                </div>
            )}
        </div>
    );
}
