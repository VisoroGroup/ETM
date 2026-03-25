import { useState, useRef } from 'react';
import { commentsApi } from '../../../services/api';
import type { TaskDetail, TaskComment, User } from '../../../types';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { timeAgo } from '../../../utils/helpers';
import { MessageSquare, Send, Trash2, ThumbsUp, Reply, X } from 'lucide-react';

// Deterministic avatar color per author
const AVATAR_COLORS = [
    'from-blue-500 to-cyan-500',
    'from-pink-500 to-rose-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-violet-500 to-purple-500',
    'from-red-500 to-pink-500',
    'from-cyan-500 to-blue-500',
    'from-lime-500 to-green-500',
];

function getAvatarColor(authorId: string): string {
    let hash = 0;
    for (let i = 0; i < authorId.length; i++) hash = authorId.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const BORDER_COLORS = [
    'border-blue-500', 'border-pink-500', 'border-emerald-500', 'border-amber-500',
    'border-violet-500', 'border-red-500', 'border-cyan-500', 'border-lime-500',
];
function getBorderColor(authorId: string): string {
    let hash = 0;
    for (let i = 0; i < authorId.length; i++) hash = authorId.charCodeAt(i) + ((hash << 5) - hash);
    return BORDER_COLORS[Math.abs(hash) % BORDER_COLORS.length];
}

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
    const [replyTo, setReplyTo] = useState<TaskComment | null>(null);
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

    function startReply(comment: TaskComment) {
        setReplyTo(comment);
        commentRef.current?.focus();
    }

    function cancelReply() {
        setReplyTo(null);
    }

    async function submitComment() {
        if (!newComment.trim()) return;
        try {
            await commentsApi.create(taskId, newComment.trim(), mentionIds, replyTo?.id || null);
            setNewComment('');
            setMentionIds([]);
            setReplyTo(null);
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

    async function toggleReaction(commentId: string) {
        try {
            await commentsApi.toggleReaction(taskId, commentId);
            onReload();
        } catch {
            showToast('Eroare', 'error');
        }
    }

    const filteredMentionUsers = users.filter(u =>
        u.display_name.toLowerCase().includes(mentionQuery) ||
        u.email.toLowerCase().includes(mentionQuery)
    );

    // Highlight @mentions in comment text
    function renderContent(content: string) {
        const parts = content.split(/(@[A-ZÀ-Ža-zà-ž\s]+?)(?=\s|$|@)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                return (
                    <span key={i} className="text-blue-400 font-medium bg-blue-500/10 px-0.5 rounded">
                        {part}
                    </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    }

    // Build threaded comment structure: top-level + replies grouped beneath
    const topLevel = task.comments.filter(c => !c.parent_comment_id);
    const repliesMap = new Map<string, TaskComment[]>();
    for (const c of task.comments) {
        if (c.parent_comment_id) {
            if (!repliesMap.has(c.parent_comment_id)) repliesMap.set(c.parent_comment_id, []);
            repliesMap.get(c.parent_comment_id)!.push(c);
        }
    }

    // Single comment card
    function CommentCard({ comment, isReply = false }: { comment: TaskComment; isReply?: boolean }) {
        const borderColor = getBorderColor(comment.author_id);
        const avatarColor = getAvatarColor(comment.author_id);
        const isOwn = comment.author_id === user?.id;
        const reactions = comment.reactions || [];
        const likeCount = reactions.length;
        const iLiked = reactions.some(r => r.user_id === user?.id);
        const likedByNames = reactions.map(r => r.display_name);

        return (
            <div className={`rounded-lg border-l-[3px] ${borderColor} bg-navy-800/40 border border-navy-700/30 px-3.5 py-2.5 group transition-all hover:bg-navy-800/60 ${isReply ? 'ml-8' : ''}`}>
                {/* Header */}
                <div className="flex items-center gap-2 mb-1.5">
                    <div className={`${isReply ? 'w-5 h-5 text-[8px]' : 'w-6 h-6 text-[9px]'} rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                        {comment.author_avatar
                            ? <img src={comment.author_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                            : comment.author_name?.charAt(0).toUpperCase()
                        }
                    </div>
                    <span className={`text-xs font-semibold ${isOwn ? 'text-blue-300' : 'text-white'}`}>
                        {comment.author_name}
                        {isOwn && <span className="text-[9px] text-navy-500 ml-1 font-normal">(tu)</span>}
                    </span>
                    <span className="text-[10px] text-navy-500">{timeAgo(comment.created_at)}</span>

                    <div className="ml-auto flex items-center gap-1">
                        {/* Reply button — only for top-level comments */}
                        {!isReply && (
                            <button
                                onClick={() => startReply(comment)}
                                className="opacity-0 group-hover:opacity-100 text-navy-500 hover:text-blue-400 transition-all p-0.5 flex items-center gap-0.5 text-[10px]"
                                title="Răspunde"
                            >
                                <Reply className="w-3 h-3" />
                            </button>
                        )}

                        {/* Like button */}
                        <button
                            onClick={() => toggleReaction(comment.id)}
                            title={likedByNames.length > 0 ? likedByNames.join(', ') : 'Like'}
                            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] transition-all ${
                                iLiked
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'opacity-0 group-hover:opacity-100 text-navy-500 hover:text-blue-400 hover:bg-navy-700/50'
                            }`}
                        >
                            <ThumbsUp className={`w-3 h-3 ${iLiked ? 'fill-blue-400' : ''}`} />
                            {likeCount > 0 && <span className="font-medium">{likeCount}</span>}
                        </button>

                        {/* Delete */}
                        {comment.author_id === user?.id && (
                            <button
                                onClick={() => deleteComment(comment.id)}
                                className="opacity-0 group-hover:opacity-100 text-navy-600 hover:text-red-400 transition-all p-0.5"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <p className={`text-sm text-navy-200 whitespace-pre-wrap leading-relaxed ${isReply ? 'pl-7' : 'pl-8'}`}>
                    {renderContent(comment.content)}
                </p>

                {/* Reactions summary */}
                {likeCount > 0 && (
                    <div className={`flex items-center gap-1 mt-1.5 ${isReply ? 'pl-7' : 'pl-8'}`}>
                        <span className="text-[10px] text-navy-500 flex items-center gap-0.5">
                            👍 {likedByNames.join(', ')}
                        </span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Comment input */}
            <div className="relative">
                {/* Reply indicator */}
                {replyTo && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-t-lg text-xs">
                        <Reply className="w-3 h-3 text-blue-400" />
                        <span className="text-blue-400">Răspuns pentru</span>
                        <span className="text-white font-medium">{replyTo.author_name}</span>
                        <span className="text-navy-500 truncate max-w-[200px]">"{replyTo.content.substring(0, 50)}{replyTo.content.length > 50 ? '...' : ''}"</span>
                        <button onClick={cancelReply} className="ml-auto text-navy-500 hover:text-white transition-colors">
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}
                <textarea
                    ref={commentRef}
                    value={newComment}
                    onChange={handleCommentInput}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                    rows={3}
                    placeholder={replyTo ? `Scrie un răspuns pentru ${replyTo.author_name}...` : 'Scrie un comentariu... folosește @ pentru a menționa'}
                    className={`w-full px-3.5 py-2.5 bg-navy-800/50 border border-navy-700/50 ${replyTo ? 'rounded-b-lg border-t-0' : 'rounded-lg'} text-sm text-white placeholder:text-navy-500 focus:outline-none focus:border-blue-500/50 resize-none`}
                />
                {showMentionDropdown && filteredMentionUsers.length > 0 && (
                    <div className="absolute top-full left-0 w-64 mt-1 bg-navy-800 border border-navy-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto animate-fade-in">
                        {filteredMentionUsers.slice(0, 5).map(u => (
                            <button
                                key={u.id}
                                onClick={() => selectMention(u)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-navy-700/50 text-sm text-left transition-colors"
                            >
                                <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(u.id)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
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

            {/* Comments list — threaded */}
            {topLevel.length > 0 ? (
                <div className="space-y-2">
                    {topLevel.map(comment => {
                        const replies = repliesMap.get(comment.id) || [];
                        return (
                            <div key={comment.id}>
                                {/* Parent comment */}
                                <CommentCard comment={comment} />

                                {/* Replies */}
                                {replies.length > 0 && (
                                    <div className="space-y-1.5 mt-1.5 relative">
                                        {/* Thread line */}
                                        <div className="absolute left-4 top-0 bottom-0 w-px bg-navy-700/50" />
                                        {replies.map(reply => (
                                            <CommentCard key={reply.id} comment={reply} isReply />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
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
