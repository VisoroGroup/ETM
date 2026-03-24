-- Migration 031: Add superadmin role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superadmin' BEFORE 'admin';

-- Set superadmin for the owner account
UPDATE users SET role = 'superadmin' WHERE email = 'ledenyi.robert@visoro-global.ro';
