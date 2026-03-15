-- Migration 013: Add assigned_to to tasks + seed initial users

-- Add assigned_to column to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);

-- Pre-seed Visoro team members (email-based, microsoft_id will be linked on first login)
INSERT INTO users (id, microsoft_id, email, display_name, role, department)
VALUES
  (uuid_generate_v4(), 'pending-maria-vaszi', 'Maria.vaszi@visoro-global.ro', 'Maria Vaszi', 'user', 'departament_1'),
  (uuid_generate_v4(), 'pending-alisa-marincas', 'Alisa.marincas@visoro-global.ro', 'Alisa Marincas', 'user', 'departament_1'),
  (uuid_generate_v4(), 'pending-emoke-ledenyi', 'Emoke.ledenyi@visoro-global.ro', 'Emőke Ledényi', 'user', 'departament_1')
ON CONFLICT (email) DO NOTHING;
