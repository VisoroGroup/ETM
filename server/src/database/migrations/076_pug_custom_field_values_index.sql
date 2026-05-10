-- Migration 076: add a stand-alone index on pug_custom_field_values.field_id.
--
-- The composite primary key (project_id, field_id) cannot be used by Postgres
-- to seek by field_id alone. This index makes "all values for a given custom
-- field" lookups fast — useful when the admin renames or analyses a field.

CREATE INDEX IF NOT EXISTS idx_pug_custom_field_values_field_id
    ON pug_custom_field_values(field_id);
