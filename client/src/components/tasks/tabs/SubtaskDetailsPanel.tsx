import { useState, useEffect } from 'react';
import { subtasksApi, attachmentsApi } from '../../../services/api';
import { useTranslation } from '../../../i18n/I18nContext';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../hooks/useAuth';
import type { SubtaskComment, SubtaskAttachment } from '../../../types';
import { Send, Paperclip, Trash2, Upload, FileText } from 'lucide-react';
import { timeAgo } from '../../../utils/helpers';

interface Props {
    taskId: string;
    subtaskId: string;
}

// Subtask-scoped comments + attachments — the "expand" panel under a subtask
// row in SubtasksTab. Hungary uses subtasks as the actual unit of work so
// conversations and files belong here, not on the umbrella parent task.
export default function SubtaskDetailsPanel({ taskId, subtaskId }: Props) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [comments, setComments] = useState<SubtaskComment[]>([]);
    const [attachments, setAttachments] = useState<SubtaskAttachment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);

    async function reload() {
        try {
            const [c, a] = await Promise.all([
                subtasksApi.listComments(taskId, subtaskId),
                subtasksApi.listAttachments(taskId, subtaskId),
            ]);
            setComments(c);
            setAttachments(a);
        } catch {
            showToast(t('tasks.try_again'), 'error');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { reload(); }, [taskId, subtaskId]);

    async function submitComment() {
        const trimmed = newComment.trim();
        if (!trimmed) return;
        try {
            const created = await subtasksApi.addComment(taskId, subtaskId, trimmed);
            setComments(prev => [...prev, created]);
            setNewComment('');
        } catch {
            showToast(t('tasks.try_again'), 'error');
        }
    }

    async function removeComment(id: string) {
        try {
            await subtasksApi.deleteComment(taskId, subtaskId, id);
            setComments(prev => prev.filter(c => c.id !== id));
        } catch {
            showToast(t('tasks.try_again'), 'error');
        }
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            // Re-use parent task's upload endpoint (existing virus scan + size
            // limits live there); then register against the subtask.
            const uploaded = await attachmentsApi.upload(taskId, file);
            const registered = await subtasksApi.registerAttachment(taskId, subtaskId, {
                file_name: uploaded.file_name,
                file_url: uploaded.file_url,
                file_size: uploaded.file_size,
            });
            setAttachments(prev => [registered, ...prev]);
        } catch {
            showToast(t('tasks.try_again'), 'error');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }

    async function removeAttachment(id: string) {
        try {
            await subtasksApi.deleteAttachment(taskId, subtaskId, id);
            setAttachments(prev => prev.filter(a => a.id !== id));
        } catch {
            showToast(t('tasks.try_again'), 'error');
        }
    }

    if (loading) {
        return (
            <div className="pl-12 pr-2 py-2 text-xs text-navy-500">{t('common.loading')}</div>
        );
    }

    return (
        <div className="pl-12 pr-2 pb-3 space-y-3 bg-navy-900/30 border-l-2 border-navy-700/40 ml-3">
            {/* Comments */}
            <div className="space-y-2 pt-2">
                <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">
                    {t('task_drawer.tab_comments')} ({comments.length})
                </div>
                {comments.length > 0 && (
                    <div className="space-y-1.5">
                        {comments.map(c => (
                            <div key={c.id} className="flex items-start gap-2 group">
                                <div className="flex-1 bg-navy-800/40 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-[11px] font-medium text-navy-200">{c.author_name}</span>
                                        <span className="text-[10px] text-navy-500">{timeAgo(c.created_at)}</span>
                                    </div>
                                    <p className="text-xs text-navy-200 whitespace-pre-wrap">{c.content}</p>
                                </div>
                                {(c.author_id === user?.id || user?.role === 'admin' || user?.role === 'superadmin') && (
                                    <button
                                        onClick={() => removeComment(c.id)}
                                        className="text-navy-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label={t('common.delete')}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && submitComment()}
                        placeholder={t('comments.placeholder')}
                        className="flex-1 px-3 py-1.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-xs text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50"
                    />
                    <button
                        onClick={submitComment}
                        disabled={!newComment.trim()}
                        className="px-2.5 py-1.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:hover:bg-blue-500 text-white rounded-lg transition-colors"
                    >
                        <Send className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-wider text-navy-500 font-semibold">
                        {t('task_drawer.tab_files')} ({attachments.length})
                    </div>
                    <label className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer">
                        {uploading ? (
                            <span className="text-navy-400">{t('common.loading')}</span>
                        ) : (
                            <>
                                <Upload className="w-3 h-3" />
                                {t('common.add')}
                            </>
                        )}
                        <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                    </label>
                </div>
                {attachments.length > 0 && (
                    <div className="space-y-1">
                        {attachments.map(a => (
                            <div key={a.id} className="flex items-center gap-2 group bg-navy-800/40 rounded-lg px-3 py-1.5">
                                <FileText className="w-3.5 h-3.5 text-navy-400 flex-shrink-0" />
                                <a
                                    href={a.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 text-xs text-blue-300 hover:text-blue-200 truncate"
                                >
                                    {a.file_name}
                                </a>
                                <span className="text-[10px] text-navy-500">{(a.file_size / 1024).toFixed(0)} KB</span>
                                {(a.uploaded_by === user?.id || user?.role === 'admin' || user?.role === 'superadmin') && (
                                    <button
                                        onClick={() => removeAttachment(a.id)}
                                        className="text-navy-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label={t('common.delete')}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
