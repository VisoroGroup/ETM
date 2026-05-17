-- Migration 093: Optional geo metadata on project attachments.
--
-- David's GPR surveys produce photos that NEED a location to be useful —
-- "borehole at (lat, lng) on 2026-05-17". Today an attachment is just a
-- filename + bytes; the location lives in the photo's EXIF if at all,
-- which the system never reads. Three optional columns are enough to
-- capture the site coordinates from the browser's Geolocation API at
-- upload time.

ALTER TABLE pug_project_attachments
    ADD COLUMN IF NOT EXISTS geo_lat       NUMERIC(9, 6),
    ADD COLUMN IF NOT EXISTS geo_lng       NUMERIC(9, 6),
    ADD COLUMN IF NOT EXISTS geo_accuracy  NUMERIC(7, 2),  -- meters
    ADD COLUMN IF NOT EXISTS captured_at   TIMESTAMPTZ;     -- when the photo was taken (browser clock)
