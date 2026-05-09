-- Migration 069: Drop the entire Financiar (financial) module.
--
-- Removes the entire Financiar (financial) module. All payments, invoices,
-- budget data, and bank import data is permanently deleted. The
-- 'departament_3' / '3 - Financiar' task department is unrelated to this
-- module and remains untouched.
--
-- This migration drops:
--   - Bank statement import tables (rows reference payments via
--     matched_payment_id, so rows are dropped before payments)
--   - Payment-related tables (reminders, activity log, comments, then payments)
--   - Budget planning tables (entries reference categories, so entries first)
--   - Cash balance snapshots
--   - Client invoices
--   - Outstanding items (already dropped in migration 040, but kept here with
--     IF EXISTS for safety on environments where 040 was skipped)
--
-- CASCADE is used to also drop dependent indexes, constraints, and any
-- objects that reference these tables. The CREATE migrations did not define
-- standalone sequences, views, or custom types — only tables and indexes —
-- so no extra DROP statements are required beyond the tables themselves.

-- 1) Bank import (must come before payments — bank_statement_rows.matched_payment_id → payments.id)
DROP TABLE IF EXISTS bank_statement_rows CASCADE;
DROP TABLE IF EXISTS bank_statement_imports CASCADE;

-- 2) Payment-related tables (children before parent)
DROP TABLE IF EXISTS payment_reminders CASCADE;
DROP TABLE IF EXISTS payment_activity_log CASCADE;
DROP TABLE IF EXISTS payment_comments CASCADE;
DROP TABLE IF EXISTS payments CASCADE;

-- 3) Outstanding items (already removed by migration 040, kept defensively)
DROP TABLE IF EXISTS outstanding_items CASCADE;

-- 4) Client invoices (independent)
DROP TABLE IF EXISTS client_invoices CASCADE;

-- 5) Budget planning (entries reference categories; cash_balance is independent)
DROP TABLE IF EXISTS budget_entries CASCADE;
DROP TABLE IF EXISTS budget_categories CASCADE;
DROP TABLE IF EXISTS cash_balance CASCADE;
