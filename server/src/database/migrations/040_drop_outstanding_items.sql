-- Migration 040: Drop unused outstanding_items table
-- This table was created in 038 but never used.
-- Client invoices (paid/unpaid) already covers receivables tracking.

DROP TABLE IF EXISTS outstanding_items;
DROP INDEX IF EXISTS idx_outstanding_items_type;
