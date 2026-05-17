-- Migration 089: Minimum invoicing fields on pug_projects.
--
-- David's GPR work and Neo Plan's permit work both finish with a
-- contract → invoice → payment lifecycle. The full finance module was
-- (correctly) dropped in migration 069 because it was overkill for the
-- current size of the operation. But the *bare minimum* — "this project
-- has been invoiced", "this project has been paid" — fits naturally on
-- the project row and avoids resurrecting the whole finance module.
--
-- Three nullable columns. No new tables, no new routes (yet) beyond the
-- already-existing PUT /pug/projects/:id meta editor.

ALTER TABLE pug_projects
    ADD COLUMN IF NOT EXISTS invoice_issued_date DATE,
    ADD COLUMN IF NOT EXISTS invoice_number TEXT,
    ADD COLUMN IF NOT EXISTS paid_at DATE;
