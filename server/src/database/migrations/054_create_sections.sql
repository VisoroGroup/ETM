-- Migration 054: Create sections table (sub-departments within departments)
-- Structure: Department → Section → Post
-- Each department has 3 sections, each section has its own PFV

CREATE TABLE IF NOT EXISTS sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  head_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  pfv TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sections_department_id ON sections(department_id);
CREATE INDEX idx_sections_head_user_id ON sections(head_user_id);
CREATE INDEX idx_sections_is_active ON sections(is_active);

-- === 7 - Administrativ (dept sort_order=1) ===
INSERT INTO sections (name, department_id, head_user_id, pfv, sort_order) VALUES
  ('Resurse',
    (SELECT id FROM departments WHERE sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'O firmă care este organizată.',
    1),
  ('Cazuri speciale',
    (SELECT id FROM departments WHERE sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'O firmă sigură din punct de vedere juridic.',
    2),
  ('Director general',
    (SELECT id FROM departments WHERE sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Dezoltarea produselor de calitate. O firmă viabilă cu rezultate foarte vizibile, în care resursele cresc și colegii câștigă bine.',
    3);

-- === 1 - HR - Comunicare (dept sort_order=2) ===
INSERT INTO sections (name, department_id, head_user_id, pfv, sort_order) VALUES
  ('HR',
    (SELECT id FROM departments WHERE sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Angajarea colegilor calificați, puși pe post și știu exact ce, cum și când să facă.',
    1),
  ('Comunicare',
    (SELECT id FROM departments WHERE sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Toate comunicările interne și externe sunt realizate precis, la timp și la persoana potrivită conform tabelului de organizare.',
    2),
  ('Statistici',
    (SELECT id FROM departments WHERE sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Statistici crescătoare.',
    3);

-- === 2 - Vânzări (dept sort_order=3) ===
INSERT INTO sections (name, department_id, head_user_id, pfv, sort_order) VALUES
  ('Marketing',
    (SELECT id FROM departments WHERE sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Numărul de clienți este în creștere continuă datorită campaniilor și sondajelor eficiente.',
    1),
  ('Publicații',
    (SELECT id FROM departments WHERE sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Vânzările merg ușor datorită vizibilității crescute.',
    2),
  ('Vânzări',
    (SELECT id FROM departments WHERE sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Contracte încheiate în număr cât mai mare.',
    3);

-- === 3 - Financiar (dept sort_order=4) ===
INSERT INTO sections (name, department_id, head_user_id, pfv, sort_order) VALUES
  ('Facturare - Încasare',
    (SELECT id FROM departments WHERE sort_order = 4),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Toate facturile sunt emise conform contract și toate facturile sunt încasate la timp.',
    1),
  ('Plăți',
    (SELECT id FROM departments WHERE sort_order = 4),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Furnizori și colegi mulțumiți.',
    2),
  ('Evidențe financiare',
    (SELECT id FROM departments WHERE sort_order = 4),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Înregistrări exacte despre situația financiară. Patrimoniul firmei este în siguranță și funcțională.',
    3);

-- === 4 - Producție (dept sort_order=5) ===
INSERT INTO sections (name, department_id, head_user_id, pfv, sort_order) VALUES
  ('Pregătire',
    (SELECT id FROM departments WHERE sort_order = 5),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Proiect complet pregătit pentru începerea producției.',
    1),
  ('Realizare',
    (SELECT id FROM departments WHERE sort_order = 5),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Colectarea datelor și GIS predat în timpul, calitatea și cheltuielile promise și HCL obținut la timp.',
    2),
  ('Predare',
    (SELECT id FROM departments WHERE sort_order = 5),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Proiecte verificate și predate în timp util.',
    3);

-- === 5 - Calitate și calificare (dept sort_order=6) ===
INSERT INTO sections (name, department_id, head_user_id, pfv, sort_order) VALUES
  ('Verificare',
    (SELECT id FROM departments WHERE sort_order = 6),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Clienți mulțumiți și recunoscători.',
    1),
  ('Examinare',
    (SELECT id FROM departments WHERE sort_order = 6),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Angajați eficienți, calificați și entuziaști.',
    2),
  ('Performanță',
    (SELECT id FROM departments WHERE sort_order = 6),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'O firmă organizată și colegi entuziaști.',
    3);

-- === 6 - Extindere (dept sort_order=7) ===
INSERT INTO sections (name, department_id, head_user_id, pfv, sort_order) VALUES
  ('Relații noi',
    (SELECT id FROM departments WHERE sort_order = 7),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Relații noi în creștere.',
    1),
  ('Extindere',
    (SELECT id FROM departments WHERE sort_order = 7),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Un aflux constant de clienți noi calificați.',
    2),
  ('Promovare',
    (SELECT id FROM departments WHERE sort_order = 7),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Un brand recunoscut la nivel național.',
    3);

-- Set department heads (same as before)
UPDATE departments SET head_user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1) WHERE name LIKE '7 -%';
UPDATE departments SET head_user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1) WHERE name LIKE '1 -%';
UPDATE departments SET head_user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1) WHERE name LIKE '2 -%';
UPDATE departments SET head_user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1) WHERE name LIKE '3 -%';
UPDATE departments SET head_user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1) WHERE name LIKE '4 -%';
UPDATE departments SET head_user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1) WHERE name LIKE '5 -%';
UPDATE departments SET head_user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1) WHERE name LIKE '6 -%';
