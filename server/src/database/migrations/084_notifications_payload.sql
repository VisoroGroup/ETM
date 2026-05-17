-- Migration 084: structured notification payload.
--
-- Until now the `notifications.message` column has held a pre-rendered
-- Romanian sentence ("X ți-a atribuit o sarcină nouă: ..."). When Hungarian
-- users open the bell, they get Romanian text inside an otherwise Hungarian
-- UI. Email already does it correctly (server-side localization per
-- recipient) — but the in-app bell can't know the recipient's locale at
-- INSERT time and shouldn't try to.
--
-- Solution: add a JSONB `payload` column carrying the structured ingredients
-- (actor, taskTitle, subtaskTitle, …). The client looks the message up by
-- `type` in its locale dictionary and interpolates the payload at render
-- time. The old `message` column stays as a fallback so existing rows keep
-- working and new INSERT sites can be migrated one at a time.

ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS payload JSONB;
