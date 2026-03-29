-- Migration 035: Add quarterly and yearly to recurring_frequency enum
ALTER TYPE recurring_frequency ADD VALUE IF NOT EXISTS 'quarterly';
ALTER TYPE recurring_frequency ADD VALUE IF NOT EXISTS 'yearly';
