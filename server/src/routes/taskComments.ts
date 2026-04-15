import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { checkTaskAccess } from '../middleware/taskAccess';
import { validateCreateComment } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { getSpecificStakeholders, buildNotificationHtml, sendNotificationEmail, escapeHtml } from '../services/notificationEmailService';

const router = Router({ mergeParams: true });

// GET /api/tasks/:id/comments
router.get('/comments', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId } = req.params;
        const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
        const offset = parseInt(req.query.offset as string, 10) || 0;

        if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
            res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
            return;
        }

        const { rows } = await pool.query(
            `SELECT c.*, u.display_name AS author_name, u.avatar_url AS author_avatar
       FROM task_comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC
       LIMIT $2 OFFSET $3`,
            [taskId, limit, offset]
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
}));

// POST /api/tasks/:id/comments
router.post('/comments', authMiddleware, validateCreateComment, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId } = req.params;
        const { content, mentions = [], parent_comment_id = null } = req.body;

        if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
            res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
            return;
        }

        if (!content || content.trim() === '') {
            res.status(400).json({ error: 'Conținutul comentariului este obligatoriu.' });
            return;
        }

        // Validate mentions are valid UUIDs
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (mentions && Array.isArray(mentions)) {
            for (const mid of mentions) {
                if (!uuidRegex.test(mid)) {
                    res.status(400).json({ error: 'Invalid mention ID format.' });
                    return;
                }
            }
        }

        // Validate parent_comment_id belongs to this task
        if (parent_comment_id) {
            const { rows: parentCheck } = await pool.query(
                'SELECT 1 FROM task_comments WHERE id = $1 AND task_id = $2',
                [parent_comment_id, taskId]
            );
            if (parentCheck.length === 0) {
                res.status(400).json({ error: 'Parent comment not found in this task.' });
                return;
            }
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

        // NOTIFICATIONS: notify mentioned users + task creator + task assignee
        try {
            const notifyUsers = new Set<string>();

            // Notify mentioned users
            if (mentions && mentions.length > 0) {
                for (const mentionedId of mentions) {
                    if (mentionedId !== req.user!.id) notifyUsers.add(mentionedId);
                }
            }

            // Notify task creator and assignee if they didn't write the comment
            const { rows: taskRows } = await pool.query('SELECT created_by, assigned_to, title FROM tasks WHERE id = $1', [taskId]);
            if (taskRows.length > 0) {
                if (taskRows[0].created_by !== req.user!.id) {
                    notifyUsers.add(taskRows[0].created_by);
                }
                if (taskRows[0].assigned_to && taskRows[0].assigned_to !== req.user!.id) {
                    notifyUsers.add(taskRows[0].assigned_to);
                }
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
                            : `${req.user!.display_name} a adăugat un comentariu la sarcina: "${taskTitle}"`,
                        req.user!.id]
                );
            }

            // Send EMAIL to ALL notified users (creator + assignee + mentions)
            const allNotifyIds = Array.from(notifyUsers);
            if (allNotifyIds.length > 0) {
                const stakeholders = await getSpecificStakeholders(allNotifyIds, req.user!.id);
                for (const su of stakeholders) {
                    const isMention = mentions && mentions.includes(su.id);
                    const htmlBody = buildNotificationHtml({
                        recipientName: su.display_name,
                        subtitle: isMention ? 'Mențiune nouă' : 'Comentariu nou',
                        bodyLines: [
                            `<p style="color: #555; font-size: 14px;"><strong>${req.user!.display_name}</strong> ${
                                isMention ? 'te-a menționat într-un comentariu' : 'a adăugat un comentariu'
                            } la sarcina:</p>`,
                            `<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 12px 0; border-radius: 0 8px 8px 0;">
                                <p style="margin: 0; color: #555; font-size: 14px; font-style: italic;">"${escapeHtml(content.substring(0, 200))}${content.length > 200 ? '...' : ''}"</p>
                            </div>`,
                        ],
                        taskId,
                        taskTitle,
                    });

                    sendNotificationEmail({
                        userId: su.id,
                        userEmail: su.email,
                        userName: su.display_name,
                        taskId,
                        subject: `[ETM] ${isMention ? 'Mențiune' : 'Comentariu nou'} — ${taskTitle}`,
                        htmlBody,
                        emailType: isMention ? 'mention' : 'comment',
                    }).catch(err => console.error(`[${isMention ? 'MENTION' : 'COMMENT'}] Email error:`, err));
                }
            }
        } catch (notifErr) {
            console.error('Notification error (non-critical):', notifErr);
        }

        // Get author info
        rows[0].author_name = req.user!.display_name;
        rows[0].author_avatar = req.user!.avatar_url;

    res.status(201).json(rows[0]);
}));

// PUT /api/tasks/:id/comments/:commentId
router.put('/comments/:commentId', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId, commentId } = req.params;
        const { content } = req.body;

        if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
            res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
            return;
        }

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
}));

// DELETE /api/tasks/:id/comments/:commentId
router.delete('/comments/:commentId', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId, commentId } = req.params;

        if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
            res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
            return;
        }

        const { rows: existing } = await pool.query(
            'SELECT author_id FROM task_comments WHERE id = $1', [commentId]
        );

        if (existing.length === 0) {
            res.status(404).json({ error: 'Comentariul nu a fost găsit.' });
            return;
        }

        if (existing[0].author_id !== req.user!.id && req.user!.role !== 'admin' && req.user!.role !== 'superadmin') {
            res.status(403).json({ error: 'Poți șterge doar propriile comentarii.' });
            return;
        }

    await pool.query('DELETE FROM task_comments WHERE id = $1', [commentId]);
    res.json({ message: 'Comentariul a fost șters.' });
}));

// POST /api/tasks/:id/comments/:commentId/react — toggle reaction
router.post('/comments/:commentId/react', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: taskId, commentId } = req.params;
        const reaction = req.body.reaction || '👍';

        if (!await checkTaskAccess(taskId, req.user!.id, req.user!.role)) {
            res.status(403).json({ error: 'Nincs jogosultságod ehhez a feladathoz.' });
            return;
        }

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

            // Notify comment author about the reaction
            try {
                const { rows: commentRows } = await pool.query(
                    'SELECT tc.author_id, t.title as task_title FROM task_comments tc JOIN tasks t ON tc.task_id = t.id WHERE tc.id = $1',
                    [commentId]
                );
                if (commentRows.length > 0 && commentRows[0].author_id !== req.user!.id) {
                    const authorId = commentRows[0].author_id;
                    const taskTitle = commentRows[0].task_title;

                    // In-app notification
                    await pool.query(
                        `INSERT INTO notifications (user_id, task_id, type, message, created_by)
                         VALUES ($1, $2, 'comment', $3, $4)`,
                        [authorId, taskId, `${req.user!.display_name} a reacționat ${reaction} la comentariul tău`, req.user!.id]
                    );

                    // Email notification
                    const stakeholders = await getSpecificStakeholders([authorId], req.user!.id);
                    for (const su of stakeholders) {
                        const htmlBody = buildNotificationHtml({
                            recipientName: su.display_name,
                            subtitle: 'Reacție nouă',
                            bodyLines: [
                                `<p style="color: #555; font-size: 14px;"><strong>${req.user!.display_name}</strong> a reacționat ${reaction} la comentariul tău la sarcina:</p>`,
                            ],
                            taskId,
                            taskTitle,
                        });
                        sendNotificationEmail({
                            userId: su.id, userEmail: su.email, userName: su.display_name,
                            taskId, subject: `[ETM] Reacție ${reaction} — ${taskTitle}`,
                            htmlBody, emailType: 'reaction',
                        }).catch(err => console.error('[REACTION] Email error:', err));
                    }
                }
            } catch (err) {
                console.error('[REACTION] Notification error:', err);
            }

            res.json({ toggled: 'added' });
        }
}));

export default router;
