import { useEffect, useState } from 'react';
import { pugProjectsApi, PugStageDependency } from '../../services/api';
import { useTranslation } from '../../i18n/I18nContext';
import { useToast } from '../../hooks/useToast';
import { Link2, AlertTriangle, X, Plus } from 'lucide-react';

interface Stage {
    id: string;
    stage_name: string;
    status_is_terminal: boolean | null;
}

interface Props {
    projectId: string;
    stages: Stage[];
    isAdmin: boolean;
}

// Compact dependency manager for project stages. Sits inside the stages
// section; shows the existing chain and lets admins add/remove edges.
// Highlights stages that are blocked by an unfinished predecessor.
export default function ProjectStageSequenceIndicator({ projectId, stages, isAdmin }: Props) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [deps, setDeps] = useState<PugStageDependency[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [blockingId, setBlockingId] = useState('');
    const [blockedId, setBlockedId] = useState('');

    async function reload() {
        try {
            setDeps(await pugProjectsApi.listStageDependencies(projectId));
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { reload(); }, [projectId]);

    const stageById = new Map(stages.map(s => [s.id, s] as const));

    // Compute which stages are currently blocked: an edge (a → b) where the
    // blocking stage is NOT terminal blocks b.
    const blockedStageIds = new Set<string>();
    for (const d of deps) {
        const blocker = stageById.get(d.blocking_stage_id);
        if (blocker && !blocker.status_is_terminal) {
            blockedStageIds.add(d.blocked_stage_id);
        }
    }

    async function addDep() {
        if (!blockingId || !blockedId) return;
        try {
            const created = await pugProjectsApi.addStageDependency(projectId, {
                blocking_stage_id: blockingId,
                blocked_stage_id: blockedId,
            });
            setDeps(prev => [...prev, created]);
            setShowAdd(false);
            setBlockingId(''); setBlockedId('');
        } catch (e: any) {
            showToast(e.response?.data?.error || t('common.error_saving'), 'error');
        }
    }

    async function removeDep(id: string) {
        try {
            await pugProjectsApi.removeStageDependency(projectId, id);
            setDeps(prev => prev.filter(d => d.id !== id));
        } catch {
            showToast(t('tasks.try_again'), 'error');
        }
    }

    if (loading || (deps.length === 0 && !isAdmin)) return null;

    return (
        <div className="mt-3 pt-3 border-t border-navy-700/30">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5 text-navy-400" />
                    <span className="text-xs font-medium text-navy-300">
                        {t('projects.stage_dependencies_title')} ({deps.length})
                    </span>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowAdd(s => !s)}
                        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                        <Plus className="w-3 h-3" /> {t('projects.stage_dependencies_add')}
                    </button>
                )}
            </div>

            {blockedStageIds.size > 0 && (
                <div className="mb-2 flex items-center gap-2 text-[11px] text-amber-400">
                    <AlertTriangle className="w-3 h-3" />
                    {t('projects.stage_dependencies_blocked_warning', { count: blockedStageIds.size })}
                </div>
            )}

            {deps.length > 0 && (
                <div className="space-y-1 mb-2">
                    {deps.map(d => {
                        const a = stageById.get(d.blocking_stage_id)?.stage_name || '?';
                        const b = stageById.get(d.blocked_stage_id)?.stage_name || '?';
                        return (
                            <div key={d.id} className="flex items-center gap-2 text-xs text-navy-200 group">
                                <span className="text-navy-400">{a}</span>
                                <span className="text-navy-500">→</span>
                                <span className="flex-1">{b}</span>
                                {isAdmin && (
                                    <button
                                        onClick={() => removeDep(d.id)}
                                        className="text-navy-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {showAdd && (
                <div className="p-2 rounded-lg border border-navy-700 bg-navy-900/40 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <select
                            value={blockingId}
                            onChange={e => setBlockingId(e.target.value)}
                            className="px-2 py-1.5 bg-navy-800 border border-navy-700 rounded text-xs text-white"
                        >
                            <option value="">{t('projects.stage_dependencies_blocking_placeholder')}</option>
                            {stages.map(s => <option key={s.id} value={s.id}>{s.stage_name}</option>)}
                        </select>
                        <select
                            value={blockedId}
                            onChange={e => setBlockedId(e.target.value)}
                            className="px-2 py-1.5 bg-navy-800 border border-navy-700 rounded text-xs text-white"
                        >
                            <option value="">{t('projects.stage_dependencies_blocked_placeholder')}</option>
                            {stages.map(s => <option key={s.id} value={s.id}>{s.stage_name}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setShowAdd(false); setBlockingId(''); setBlockedId(''); }}
                            className="flex-1 py-1 rounded bg-navy-700 hover:bg-navy-600 text-xs"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={addDep}
                            disabled={!blockingId || !blockedId || blockingId === blockedId}
                            className="flex-1 py-1 rounded bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white text-xs"
                        >
                            {t('common.add')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
