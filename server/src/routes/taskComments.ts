import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { validateCreateComment } from '../middleware/validation';
import { getSpecificStakeholders, buildNotificationHtml, sendNotificationEmail } from '../services/notificationEmailService';

const router = Router({ mergeParams: true });

// GET /api/tasks/:id/comments
router.get('/comments', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId } = req.params;
        const { rows } = await pool.query(
            `SELECT c.*, u.display_name AS author_name, u.avatar_url AS author_avatar
       FROM task_comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
            [taskId]
        );

        // Fetch reactions for all comments in one query
        const commentIds = rows.map(r => r.id);
        if (commentIds.length > 0) {
            const { rows: reactions } = await pool.query(
                `SELECT cr.comment_id, cr.reaction, cr.user_id, u.display_name
                 FROM comment_reactions cr
                 JOIN users u ON cr.user_id = u.id
                 WHERE cr.comment_id = ANY($1)`,
                [commentIds]
            );
            // Group reactions per comment
            const reactionMap = new Map<string, any[]>();
            for (const r of reactions) {
                if (!reactionMap.has(r.comment_id)) reactionMap.set(r.comment_id, []);
                reactionMap.get(r.comment_id)!.push({ user_id: r.user_id, display_name: r.display_name, reaction: r.reaction });
            }
            for (const row of rows) {
                row.reactions = reactionMap.get(row.id) || [];
            }
        } else {
            for (const row of rows) row.reactions = [];
        }

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Eroare la incarcarea comentariilor.' });
    }
});

// POST /api/tasks/:id/comments
router.post('/comments', authMiddleware, validateCreateComment, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId } = req.params;
        const { content, mentions = [], parent_comment_id = null } = req.body;

        if (!content || content.trim() === '') {
            res.status(400).json({ error: 'Conținutul comentariului este obligatoriu.' });
            return;
        }

        const { rows } = await pool.query(
            `INSERT INTO task_comments (task_id, author_id, content, mentions, parent_comment_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [taskId, req.user!.id, content, mentions, parent_comment_id]
        );

        // Activity log
        await pool.query(
            `INSERT INTO activity_log (task_id, user_id, action_type, details)
       VALUES ($1, $2, 'comment_added', $3)`,
            [taskId, req.user!.id, JSON.stringify({
                comment_preview: content.substring(0, 100),
                mentions
            })]
        );

        // NOTIFICATIONS: notify mentioned users + task creator
        try {
            const notifyUsers = new Set<string>();

            // Notify mentioned users
            if (mentions && mentions.length > 0) {
                for (const mentionedId of mentions) {
                    if (mentionedId !== req.user!.id) notifyUsers.add(mentionedId);
                }
            }

            // Notify task creator if they didn't write the comment
            const { rows: taskRows } = await pool.query('SELECT created_by, title FROM tasks WHERE id = $1', [taskId]);
            if (taskRows.length > 0 && taskRows[0].created_by !== req.user!.id) {
                notifyUsers.add(taskRows[0].created_by);
            }

            const taskTitle = taskRows[0]?.title || 'Sarcină';

            for (const userId of notifyUsers) {
                const isMention = mentions && mentions.includes(userId);
                await pool.query(
                    `INSERT INTO notifications (user_id, task_id, type, message, created_by)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [userId, taskId,
                        isMention ? 'mention' : 'comment',
                        isMention
                            ? `${req.user!.display_name} te-a menționat într-un comentariu`
                            : `${req.user!.display_name} a adăugat un comentariu la o sarcină a ta`,
                        req.user!.id]
                );
            }

            // Send EMAIL to mentioned users (centralized via notificationEmailService)
            if (mentions && mentions.length > 0) {
                const mentionedIds = mentions.filter((mid: string) => mid !== req.user!.id);
                if (mentionedIds.length > 0) {
                    const stakeholders = await getSpecificStakeholders(mentionedIds, req.user!.id);

                    for (const mu of stakeholders) {
                        const htmlBody = buildNotificationHtml({
                            recipientName: mu.display_name,
                            subtitle: 'Mențiune nouă',
                            bodyLines: [
                                `<p style="color: #555; font-size: 14px;"><strong>${req.user!.display_name}</strong> te-a menționat într-un comentariu la sarcina:</p>`,
                                `<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 12px 0; border-radius: 0 8px 8px 0;">
                                    <p style="margin: 0; color: #555; font-size: 14px; font-style: italic;">"${content.substring(0, 200)}${content.length > 200 ? '...' : ''}"</p>
                                </div>`,
                            ],
                            taskId,
                            taskTitle,
                        });

                        sendNotificationEmail({
                            userId: mu.id,
                            userEmail: mu.email,
                            userName: mu.display_name,
                            taskId,
                            subject: `[ETM] ${req.user!.display_name} te-a menționat — ${taskTitle}`,
                            htmlBody,
                            emailType: 'mention',
                        }).catch(err => console.error('[MENTION] Email error:', err));
                    }
                }
            }
        } catch (notifErr) {
            console.error('Notification error (non-critical):', notifErr);
        }

        // Get author info
        rows[0].author_name = req.user!.display_name;
        rows[0].author_avatar = req.user!.avatar_url;

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error creating comment:', err);
        res.status(500).json({ error: 'Eroare la adăugarea comentariului.' });
    }
});

// PUT /api/tasks/:id/comments/:commentId
router.put('/comments/:commentId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { commentId } = req.params;
        const { content } = req.body;

        // Only author can edit
        const { rows: existing } = await pool.query(
            'SELECT author_id FROM task_comments WHERE id = $1', [commentId]
        );

        if (existing.length === 0) {
            res.status(404).json({ error: 'Comentariul nu a fost găsit.' });
            return;
        }

        if (existing[0].author_id !== req.user!.id) {
            res.status(403).json({ error: 'Poți edita doar propriile comentarii.' });
            return;
        }

        const { rows } = await pool.query(
            `UPDATE task_comments SET content = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
            [content, commentId]
        );

        rows[0].author_name = req.user!.display_name;
        rows[0].author_avatar = req.user!.avatar_url;

        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Eroare la editarea comentariului.' });
    }
});

// DELETE /api/tasks/:id/comments/:commentId
router.delete('/comments/:commentId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { commentId } = req.params;

        const { rows: existing } = await pool.query(
            'SELECT author_id FROM task_comments WHERE id = $1', [commentId]
        );

        if (existing.length === 0) {
            res.status(404).json({ error: 'Comentariul nu a fost găsit.' });
            return;
        }

        if (existing[0].author_id !== req.user!.id && req.user!.role !== 'admin') {
            res.status(403).json({ error: 'Poți șterge doar propriile comentarii.' });
            return;
        }

        await pool.query('DELETE FROM task_comments WHERE id = $1', [commentId]);
        res.json({ message: 'Comentariul a fost șters.' });
    } catch (err) {
        res.status(500).json({ error: 'Eroare la ștergerea comentariului.' });
    }
});

// POST /api/tasks/:id/comments/:commentId/react — toggle reaction
router.post('/comments/:commentId/react', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { commentId } = req.params;
        const reaction = req.body.reaction || '👍';

        // Check if already reacted
        const { rows: existing } = await pool.query(
            'SELECT id FROM comment_reactions WHERE comment_id = $1 AND user_id = $2 AND reaction = $3',
            [commentId, req.user!.id, reaction]
        );

        if (existing.length > 0) {
            // Remove reaction
            await pool.query('DELETE FROM comment_reactions WHERE id = $1', [existing[0].id]);
            res.json({ toggled: 'removed' });
        } else {
            // Add reaction
            await pool.query(
                'INSERT INTO comment_reactions (comment_id, user_id, reaction) VALUES ($1, $2, $3)',
                [commentId, req.user!.id, reaction]
            );
            res.json({ toggled: 'added' });
        }
    } catch (err) {
        console.error('Reaction error:', err);
        res.status(500).json({ error: 'Eroare la reactie.' });
    }
});

export default router;
