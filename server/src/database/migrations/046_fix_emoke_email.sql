-- Migration 046: Fix Emőke's email to match Microsoft SSO login
UPDATE users SET email = 'ledenyi.emoke@visoro-global.ro', updated_at = NOW() WHERE LOWER(email) = 'emoke.ledenyi@visoro-global.ro' AND is_active = true;
