import { useState, useRef } from 'react';
import { commentsApi } from '../../../services/api';
import type { TaskDetail, TaskComment, User } from '../../../types';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { timeAgo } from '../../../utils/helpers';
import { MessageSquare, Send, Trash2, ThumbsUp, Reply, X } from 'lucide-react';
import UserAvatar from '../../ui/UserAvatar';

// Fixed avatar + border colors per known user (by first name), plus fallback palette
const NAMED_COLORS: Record<string, { avatar: string; border: string }> = {
    'róbert':  { avatar: 'from-blue-800 to-blue-600',    border: 'border-blue-700' },
    'robert':  { avatar: 'from-blue-800 to-blue-600',    border: 'border-blue-700' },
    'emo':     { avatar: 'from-pink-500 to-rose-400',    border: 'border-pink-500' },
    'emőke':   { avatar: 'from-pink-500 to-rose-400',    border: 'border-pink-500' },
    'alisa':   { avatar: 'from-amber-400 to-yellow-300', border: 'border-amber-400' },
    'mária':   { avatar: 'from-emerald-500 to-green-400', border: 'border-emerald-500' },
    'maria':   { avatar: 'from-emerald-500 to-green-400', border: 'border-emerald-500' },
};

// Fallback palette for any other users
const FALLBACK_AVATARS = [
    { avatar: 'from-violet-500 to-purple-500', border: 'border-violet-500' },
    { avatar: 'from-cyan-500 to-teal-400',     border: 'border-cyan-500' },
    { avatar: 'from-orange-500 to-red-400',     border: 'border-orange-500' },
    { avatar: 'from-lime-500 to-green-500',     border: 'border-lime-500' },
    { avatar: 'from-fuchsia-500 to-pink-500',   border: 'border-fuchsia-500' },
    { avatar: 'from-sky-500 to-indigo-500',     border: 'border-sky-500' },
    { avatar: 'from-rose-500 to-red-500',       border: 'border-rose-500' },
    { avatar: 'from-teal-500 to-cyan-500',      border: 'border-teal-500' },
];

// Cache: authorId -> color pair
const authorColorCache = new Map<string, { avatar: string; border: string }>();
let fallbackIndex = 0;

function getAuthorColors(authorId: string, authorName?: string): { avatar: string; border: string } {
    if (authorColorCache.has(authorId)) return authorColorCache.get(authorId)!;

    // Try matching by first name
    const firstName = (authorName || '').split(' ')[0].toLowerCase();
    const named = NAMED_COLORS[firstName];
    if (named) {
        authorColorCache.set(authorId, named);
        return named;
    }

    // Fallback: assign next available color
    const fb = FALLBACK_AVATARS[fallbackIndex % FALLBACK_AVATARS.length];
    fallbackIndex++;
    authorColorCache.set(authorId, fb);
    return fb;
}

function getAvatarColor(authorId: string, authorName?: string): string {
    return getAuthorColors(authorId, authorName).avatar;
}

function getBorderColor(authorId: string, authorName?: string): string {
    return getAuthorColors(authorId, authorName).border;
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

    // Build threaded comment tree: group by DIRECT parent
    const commentById = new Map<string, TaskComment>();
    for (const c of task.comments) commentById.set(c.id, c);

    const topLevel = task.comments.filter(c => !c.parent_comment_id);
    const childrenMap = new Map<string, TaskComment[]>();
    for (const c of task.comments) {
        if (c.parent_comment_id) {
            if (!childrenMap.has(c.parent_comment_id)) childrenMap.set(c.parent_comment_id, []);
            childrenMap.get(c.parent_comment_id)!.push(c);
        }
    }

    // Recursive thread renderer (max 4 levels deep to avoid UI overflow)
    function CommentThread({ comment, depth = 0 }: { comment: TaskComment; depth?: number }) {
        const children = childrenMap.get(comment.id) || [];
        const parentComment = comment.parent_comment_id ? commentById.get(comment.parent_comment_id) : undefined;
        const isReply = depth > 0;
        // Cap indentation at depth 4
        const indentPx = Math.min(depth, 4) * 28;

        return (
            <div>
                <div className="relative" style={{ paddingLeft: isReply ? `${indentPx}px` : '0px' }}>
                    {/* L-shaped thread connector */}
                    {isReply && (
                        <>
                            <div className="absolute w-px bg-navy-600/60" style={{ left: `${indentPx - 20}px`, top: '-6px', height: '30px' }} />
                            <div className="absolute h-px bg-navy-600/60" style={{ left: `${indentPx - 20}px`, top: '24px', width: '14px' }} />
                        </>
                    )}
                    <CommentCard comment={comment} isReply={isReply} parentComment={parentComment} />
                </div>
                {children.length > 0 && (
                    <div className="space-y-1.5 mt-1.5">
                        {children.map(child => (
                            <CommentThread key={child.id} comment={child} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Single comment card
    function CommentCard({ comment, isReply = false, parentComment }: { comment: TaskComment; isReply?: boolean; parentComment?: TaskComment }) {
        const borderColor = getBorderColor(comment.author_id, comment.author_name);
        const avatarColor = getAvatarColor(comment.author_id, comment.author_name);
        const isOwn = comment.author_id === user?.id;
        const reactions = comment.reactions || [];
        const likeCount = reactions.length;
        const iLiked = reactions.some(r => r.user_id === user?.id);
        const likedByNames = reactions.map(r => r.display_name);

        return (
            <div className={`rounded-lg border-l-[3px] ${borderColor} bg-navy-800/40 border border-navy-700/30 px-3.5 py-2.5 group transition-all hover:bg-navy-800/60`}>
                {/* Reply-to indicator */}
                {isReply && parentComment && (
                    <div className="flex items-center gap-1.5 mb-1.5 pl-7">
                        <Reply className="w-3 h-3 text-navy-500 flex-shrink-0" />
                        <div className="flex items-center gap-1 text-[10px] text-navy-500 bg-navy-900/40 px-2 py-0.5 rounded-full overflow-hidden max-w-full">
                            <span className="text-blue-400 font-medium flex-shrink-0">{parentComment.author_name}</span>
                            <span className="truncate italic">"{parentComment.content.substring(0, 60)}{parentComment.content.length > 60 ? '…' : ''}"</span>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center gap-2 mb-1.5">
                    <UserAvatar
                        name={comment.author_name}
                        avatarUrl={comment.author_avatar}
                        size={isReply ? 'xs' : 'xs'}
                    />
                    <span className={`text-xs font-semibold ${isOwn ? 'text-blue-300' : 'text-white'}`}>
                        {comment.author_name}
                        {isOwn && <span className="text-[9px] text-navy-500 ml-1 font-normal">(tu)</span>}
                    </span>
                    <span className="text-[10px] text-navy-500">{timeAgo(comment.created_at)}</span>

                    <div className="ml-auto flex items-center gap-1">
                        {/* Reply button */}
                        <button
                            onClick={() => startReply(comment)}
                            className="text-navy-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all px-1.5 py-0.5 rounded flex items-center gap-0.5 text-[10px]"
                            title="Răspunde"
                        >
                            <Reply className="w-3 h-3" />
                            <span className="hidden sm:inline">Răspunde</span>
                        </button>

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
                                <UserAvatar
                                    name={u.display_name}
                                    avatarUrl={u.avatar_url}
                                    size="xs"
                                />
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
                    {topLevel.map(comment => (
                        <CommentThread key={comment.id} comment={comment} depth={0} />
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
