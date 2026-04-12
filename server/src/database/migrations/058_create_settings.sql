-- Migration 058: Create settings table + seed company main goal
-- Generic key-value settings table for app-wide configuration

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_settings_key ON settings(key);

-- Seed the company main goal (displayed on every page)
INSERT INTO settings (key, value) VALUES
  ('company_main_goal', 'O companie stabilă și în creștere rapidă, unde angajații ating obiectivele stabilite și se formează continuu, dezvoltându-se astfel încât creează produse care sunt cu adevărat utile pentru primării. Toate acestea sunt realizate printr-un schimb abundent, iar ca urmare a acestor lucruri, comunitățile în care semnăm contracte pot evolua mai bine, prin introducerea unui strop de etică.');
