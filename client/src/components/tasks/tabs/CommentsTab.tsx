import { useState, useRef } from 'react';
import { commentsApi } from '../../../services/api';
import type { TaskDetail, User } from '../../../types';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { timeAgo } from '../../../utils/helpers';
import { MessageSquare, Send, Trash2 } from 'lucide-react';

interface Props {
    task: TaskDetail;
    taskId: string;
    onReload: () => void;
}

export default function CommentsTab({ task, taskId, onReload }: Props) {
    const { user, users } = useAuth();
    const { showToast } = useToast();
    const [newComment, setNewComment] = useState('');
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIds, setMentionIds] = useState<string[]>([]);
    const commentRef = useRef<HTMLTextAreaElement>(null);

    function handleCommentInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
        const val = e.target.value;
        setNewComment(val);

        const lastAt = val.lastIndexOf('@');
        if (lastAt >= 0) {
            const afterAt = val.substring(lastAt + 1);
            if (!afterAt.includes(' ') && afterAt.length <= 30) {
                setMentionQuery(afterAt.toLowerCase());
                setShowMentionDropdown(true);
                return;
            }
        }
        setShowMentionDropdown(false);
    }

    function selectMention(u: User) {
        const lastAt = newComment.lastIndexOf('@');
        const before = newComment.substring(0, lastAt);
        setNewComment(`${before}@${u.display_name} `);
        setMentionIds(prev => [...prev, u.id]);
        setShowMentionDropdown(false);
        commentRef.current?.focus();
    }

    async function submitComment() {
        if (!newComment.trim()) return;
        try {
            await commentsApi.create(taskId, newComment.trim(), mentionIds);
            setNewComment('');
            setMentionIds([]);
            onReload();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    async function deleteComment(commentId: string) {
        try {
            await commentsApi.delete(taskId, commentId);
            onReload();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    const filteredMentionUsers = users.filter(u =>
        u.display_name.toLowerCase().includes(mentionQuery) ||
        u.email.toLowerCase().includes(mentionQuery)
    );

    return (
        <div className="space-y-4">
            {/* Comment input */}
            <div className="relative">
                <textarea
                    ref={commentRef}
                    value={newComment}
                    onChange={handleCommentInput}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                    rows={3}
                    placeholder="Scrie un comentariu... folosește @ pentru a menționa"
                    className="w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 rounded-lg text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50 resize-none"
                />
                {showMentionDropdown && filteredMentionUsers.length > 0 && (
                    <div className="absolute top-full left-0 w-64 mt-1 bg-navy-800 border border-navy-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto animate-fade-in">
                        {filteredMentionUsers.slice(0, 5).map(u => (
                            <button
                                key={u.id}
                                onClick={() => selectMention(u)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-navy-700/50 text-sm text-left transition-colors"
                            >
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                    {u.display_name.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-xs font-medium">{u.display_name}</p>
                                    <p className="text-[10px] text-navy-500">{u.email}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
                <button
                    onClick={submitComment}
                    disabled={!newComment.trim()}
                    className="absolute right-2 bottom-2 p-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg disabled:opacity-30 transition-all"
                >
                    <Send className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Comments list */}
            {task.comments.length > 0 ? (
                <div className="space-y-3">
                    {task.comments.map(comment => (
                        <div key={comment.id} className="flex gap-2.5 group">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                                {comment.author_name?.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium">{comment.author_name}</span>
                                    <span className="text-[10px] text-navy-500">{timeAgo(comment.created_at)}</span>
                                    {comment.author_id === user?.id && (
                                        <button
                                            onClick={() => deleteComment(comment.id)}
                                            className="opacity-0 group-hover:opacity-100 text-navy-600 hover:text-red-400 transition-all"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                                <p className="text-sm text-navy-200 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8">
                    <MessageSquare className="w-10 h-10 text-navy-700 mx-auto mb-2" />
                    <p className="text-navy-500 text-sm">Niciun comentariu încă</p>
                </div>
            )}
        </div>
    );
}
