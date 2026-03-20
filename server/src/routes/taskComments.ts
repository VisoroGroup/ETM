import { Router, Response } from 'express';
import pool from '../config/database';
import { AuthRequest, authMiddleware } from '../middleware/auth';

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
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Eroare la încărcarea comentariilor.' });
    }
});

// POST /api/tasks/:id/comments
router.post('/comments', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id: taskId } = req.params;
        const { content, mentions = [] } = req.body;

        if (!content || content.trim() === '') {
            res.status(400).json({ error: 'Conținutul comentariului este obligatoriu.' });
            return;
        }

        const { rows } = await pool.query(
            `INSERT INTO task_comments (task_id, author_id, content, mentions)
       VALUES ($1, $2, $3, $4) RETURNING *`,
            [taskId, req.user!.id, content, mentions]
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

            // Send EMAIL to mentioned users
            if (mentions && mentions.length > 0) {
                const mentionedIds = mentions.filter((mid: string) => mid !== req.user!.id);
                if (mentionedIds.length > 0) {
                    // Check Azure credentials are present before attempting email
                    const hasAzureCredentials = !!(
                        process.env.AZURE_CLIENT_ID &&
                        process.env.AZURE_CLIENT_SECRET &&
                        process.env.AZURE_TENANT_ID
                    );

                    if (!hasAzureCredentials) {
                        console.warn(`📧 [MENTION] Email not sent — Azure credentials missing (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID). Mentioned users: ${mentionedIds.join(', ')}`);
                    } else {
                        const { rows: mentionedUsers } = await pool.query(
                            'SELECT id, email, display_name FROM users WHERE id = ANY($1)',
                            [mentionedIds]
                        );

                        const { sendEmail } = await import('../services/emailService');
                        const appUrl = process.env.CLIENT_URL || 'https://etm-production-62a7.up.railway.app';

                        for (const mu of mentionedUsers) {
                            console.log(`📧 [MENTION] Attempting to send email to ${mu.email} (${mu.display_name})...`);
                            try {
                                await sendEmail({
                                    to: mu.email,
                                    subject: `[ETM] ${req.user!.display_name} te-a menționat — ${taskTitle}`,
                                    htmlBody: `
                                        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
                                            <div style="background: #1E3A5F; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                                                <h1 style="margin: 0; font-size: 20px;">Visoro Task Manager</h1>
                                                <p style="margin: 5px 0 0; opacity: 0.8; font-size: 14px;">Mențiune nouă</p>
                                            </div>
                                            <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px;">
                                                <p style="font-size: 16px; color: #333;">Bună, <strong>${mu.display_name}</strong>!</p>
                                                <p style="color: #555; font-size: 14px;">
                                                    <strong>${req.user!.display_name}</strong> te-a menționat într-un comentariu la sarcina:
                                                </p>
                                                <div style="background: #f0f4f8; border-left: 4px solid #2563EB; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
                                                    <p style="margin: 0 0 4px; font-weight: bold; color: #1E3A5F;">${taskTitle}</p>
                                                    <p style="margin: 0; color: #555; font-size: 14px; font-style: italic;">"${content.substring(0, 200)}${content.length > 200 ? '...' : ''}"</p>
                                                </div>
                                                <a href="${appUrl}/tasks" style="display: inline-block; background: #2563EB; color: white; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; font-weight: bold; margin-top: 8px;">
                                                    Deschide sarcina
                                                </a>
                                                <hr style="margin-top: 24px; border: none; border-top: 1px solid #e5e7eb;">
                                                <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
                                                    Această notificare a fost generată automat de Visoro Task Manager.
                                                </p>
                                            </div>
                                        </div>
                                    `,
                                    displayName: mu.display_name,
                                });
                                console.log(`📧 [MENTION] Email sent successfully to ${mu.email} for task ${taskId}`);
                            } catch (emailErr: any) {
                                console.error(`📧 [MENTION] Failed to send email to ${mu.email}:`, emailErr?.message || emailErr);
                            }
                        }
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

export default router;
