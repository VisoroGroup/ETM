-- Migration 095: org structure update to the 2026-06-30 org board
-- (Visoro_Tabel_de_organizare_SABLON.html). Scope: Visoro Global (company_id 1,
-- the only full-template tenant with an org tree).
--
-- Principles agreed with Robert (2026-07-06):
--   * Renames keep the same row (task links via assigned_post_id survive).
--   * Cross-section moves update section_id (links survive).
--   * Posts that disappear from the board are HARD DELETED (his explicit
--     choice): tasks fall to unassigned via ON DELETE SET NULL, policies
--     cascade, task_templates refs are nulled manually below (no FK there).
--   * ETM is a management-level task manager: multi-person posts get the
--     coordinator/team lead as holder (e.g. Vanzari -> Alisa), workers are
--     recorded in the post description, not as users.
--   * User matching is by email/name pattern with LIMIT 1 and falls back to
--     NULL when the person has no ETM profile yet (Lorin/Andras profiles are
--     being created; assignment can be completed later from the admin UI).
--
-- Every statement is scoped to company_id = 1 and guarded by name matches, so
-- it is a no-op for other tenants and resilient to minor drift.

-- ============================================================
-- A) Division heads + division PFV / statistic (from the board)
-- ============================================================

UPDATE departments SET head_user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  pfv = 'O firmă solventă și în creștere continuă!', statistic_name = 'Cash & Bill'
WHERE sort_order = 1 AND company_id = 1;

UPDATE departments SET head_user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  pfv = 'Organizație cu fundație solidă, colegi puși pe post.', statistic_name = 'Nr. statistici în creștere'
WHERE sort_order = 2 AND company_id = 1;

UPDATE departments SET head_user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  pfv = 'Vânzări realizate în număr cât mai mare.', statistic_name = 'Valoarea contractelor'
WHERE sort_order = 3 AND company_id = 1;

UPDATE departments SET head_user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  pfv = 'Patrimoniul și banii în siguranță maximă.', statistic_name = 'Facturi achitate la timp'
WHERE sort_order = 4 AND company_id = 1;

UPDATE departments SET head_user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  pfv = 'Servicii realizate la scară largă, la timp, calitate și cost.', statistic_name = 'Produse predate'
WHERE sort_order = 5 AND company_id = 1;

UPDATE departments SET head_user_id = (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  pfv = 'Organizație în continuă îmbunătățire, care funcționează la calitate înaltă.', statistic_name = 'Adaos / încasări per angajat'
WHERE sort_order = 6 AND company_id = 1;

UPDATE departments SET head_user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  pfv = 'Cerc de clienți potențiali în creștere, renume național.', statistic_name = 'Nr. clienți potențiali noi'
WHERE sort_order = 7 AND company_id = 1;

-- ============================================================
-- B) Section renames (before post moves that reference new names)
-- ============================================================

UPDATE sections SET name = 'Juridic și protecție'
WHERE name = 'Cazuri speciale' AND company_id = 1
  AND department_id = (SELECT id FROM departments WHERE sort_order = 1 AND company_id = 1);

UPDATE sections SET name = 'Calificare', sort_order = 1
WHERE name = 'Examinare' AND company_id = 1
  AND department_id = (SELECT id FROM departments WHERE sort_order = 6 AND company_id = 1);

UPDATE sections SET name = 'Calitate organizațională', sort_order = 2
WHERE name = 'Performanță' AND company_id = 1
  AND department_id = (SELECT id FROM departments WHERE sort_order = 6 AND company_id = 1);

UPDATE sections SET name = 'Operare', sort_order = 3
WHERE name = 'Verificare' AND company_id = 1
  AND department_id = (SELECT id FROM departments WHERE sort_order = 6 AND company_id = 1);

UPDATE sections SET name = 'Dezvoltare rețea'
WHERE name = 'Extindere' AND company_id = 1
  AND department_id = (SELECT id FROM departments WHERE sort_order = 7 AND company_id = 1);

-- ============================================================
-- C) Section PFVs (from the board subdivision footers)
-- ============================================================

UPDATE sections s SET pfv = v.pfv
FROM (VALUES
  (1, 'Resurse', 'Reguli, tehnologie și condiții de funcționare asigurate pentru firmă.'),
  (1, 'Juridic și protecție', 'Firmă protejată juridic și față de atacuri externe.'),
  (1, 'Director general', 'Strategie, prețuri și decizii de conducere sub control.'),
  (2, 'HR', 'Posturi ocupate cu colegi potriviți și apți, cunoscuți și susținuți.'),
  (2, 'Comunicare', 'Comunicări interne/externe precise, la timp, la persoana potrivită.'),
  (2, 'Statistici', 'Statistici crescătoare și vizibile.'),
  (3, 'Marketing', 'Interes de piață constant pentru serviciile Visoro, bazat pe sondaje.'),
  (3, 'Publicații', 'Materiale de comunicare actuale și utilizabile pentru prezentarea serviciilor Visoro.'),
  (3, 'Vânzări', 'Contracte încheiate și clienți plătitori.'),
  (4, 'Facturare - Încasare', 'Facturi emise conform contract și încasate la timp.'),
  (4, 'Plăți', 'Achiziții și obligații financiare achitate la timp.'),
  (4, 'Evidențe financiare', 'Înregistrări financiare exacte și inventar la zi.'),
  (5, 'Pregătire', 'Proiect complet pregătit pentru începerea producției.'),
  (5, 'Realizare', 'Produse realizate la timp, calitate și cost promis.'),
  (5, 'Predare', 'Proiecte preluate de client, la timp (dovadă: PV semnat).'),
  (6, 'Calificare', 'Colegi calificați.'),
  (6, 'Calitate organizațională', 'Organizație care se corectează singură și funcționează după standarde.'),
  (6, 'Operare', 'Toate echipamentele și condițiile de lucru funcționează și sunt disponibile.'),
  (7, 'Relații noi', 'Relații noi în creștere.'),
  (7, 'Dezvoltare rețea', 'Aflux constant de clienți noi calificați.'),
  (7, 'Promovare', 'Brand recunoscut național, succese vizibile.')
) AS v(dept_sort, sec_name, pfv)
WHERE s.name = v.sec_name AND s.company_id = 1
  AND s.department_id = (SELECT id FROM departments WHERE sort_order = v.dept_sort AND company_id = 1);

-- ============================================================
-- D) DIV 7 - Administrativ (dept sort_order = 1)
-- ============================================================

UPDATE posts SET name = 'Suport operațional'
WHERE name = 'Administrare' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Resurse' AND d.sort_order = 1 AND s.company_id = 1);

UPDATE posts SET name = 'Protecția organizației'
WHERE name = 'Cazuri speciale' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Juridic și protecție' AND d.sort_order = 1 AND s.company_id = 1);

UPDATE posts SET user_id = (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1)
WHERE name IN ('Contracte', 'Juridic') AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Juridic și protecție' AND d.sort_order = 1 AND s.company_id = 1);

UPDATE posts SET sort_order = CASE name WHEN 'Directive de funcționare' THEN 1 WHEN 'Tech' THEN 2 WHEN 'Suport operațional' THEN 3 END
WHERE company_id = 1 AND name IN ('Directive de funcționare', 'Tech', 'Suport operațional')
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Resurse' AND d.sort_order = 1 AND s.company_id = 1);

UPDATE posts SET sort_order = CASE name WHEN 'Contracte' THEN 1 WHEN 'Juridic' THEN 2 WHEN 'Protecția organizației' THEN 3 END
WHERE company_id = 1 AND name IN ('Contracte', 'Juridic', 'Protecția organizației')
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Juridic și protecție' AND d.sort_order = 1 AND s.company_id = 1);

UPDATE posts SET sort_order = CASE name WHEN 'Strategie' THEN 1 WHEN 'Strategie financiară' THEN 2 WHEN 'Strategie de extindere' THEN 3 WHEN 'Prețuri produse' THEN 4 WHEN 'Director executiv' THEN 5 WHEN 'Aprobare achiziții' THEN 6 WHEN 'Salarii' THEN 7 END
WHERE company_id = 1 AND name IN ('Strategie', 'Strategie financiară', 'Strategie de extindere', 'Prețuri produse', 'Director executiv', 'Aprobare achiziții', 'Salarii')
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Director general' AND d.sort_order = 1 AND s.company_id = 1);

-- ============================================================
-- E) DIV 1 - HR - Comunicare (dept sort_order = 2)
-- ============================================================
-- Medicina muncii + Protecția muncii move here from DIV 5 (ex-Examinare, now
-- Calificare), holder Maria per the board.

UPDATE posts SET
  section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                WHERE s.name = 'HR' AND d.sort_order = 2 AND s.company_id = 1),
  user_id = (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1)
WHERE name IN ('Medicina muncii', 'Protecția muncii') AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Calificare' AND d.sort_order = 6 AND s.company_id = 1);

INSERT INTO posts (name, section_id, user_id, description, sort_order, company_id)
SELECT 'Status colegi', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Urmărirea statusului colegilor.', 7, 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE s.name = 'HR' AND d.sort_order = 2 AND s.company_id = 1
  AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Status colegi' AND p.section_id = s.id);

UPDATE posts SET section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                               WHERE s.name = 'HR' AND d.sort_order = 2 AND s.company_id = 1)
WHERE name = 'Arhivă' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Comunicare' AND d.sort_order = 2 AND s.company_id = 1);

UPDATE posts SET user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1)
WHERE name = 'Comunicare internă' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Comunicare' AND d.sort_order = 2 AND s.company_id = 1);

UPDATE posts SET sort_order = CASE name WHEN 'Tabel de organizare' THEN 1 WHEN 'Posturi' THEN 2 WHEN 'Angajare' THEN 3 WHEN 'Medicina muncii' THEN 4 WHEN 'Protecția muncii' THEN 5 WHEN 'Control regulament' THEN 6 WHEN 'Status colegi' THEN 7 WHEN 'Arhivă' THEN 8 END
WHERE company_id = 1 AND name IN ('Tabel de organizare', 'Posturi', 'Angajare', 'Medicina muncii', 'Protecția muncii', 'Control regulament', 'Status colegi', 'Arhivă')
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'HR' AND d.sort_order = 2 AND s.company_id = 1);

UPDATE posts SET sort_order = CASE name WHEN 'Bază de date colaboratori' THEN 1 WHEN 'Comunicare internă' THEN 2 WHEN 'Comunicare externă' THEN 3 WHEN 'Ședințe' THEN 4 END
WHERE company_id = 1 AND name IN ('Bază de date colaboratori', 'Comunicare internă', 'Comunicare externă', 'Ședințe')
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Comunicare' AND d.sort_order = 2 AND s.company_id = 1);

-- ============================================================
-- F) DIV 2 - Vânzări (dept sort_order = 3)
-- ============================================================

UPDATE posts SET user_id = (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%alisa%' OR LOWER(email) LIKE '%alisa%') AND is_active = true LIMIT 1)
WHERE name IN ('Chestionare', 'Bază de date clienți') AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Marketing' AND d.sort_order = 3 AND s.company_id = 1);

UPDATE posts SET name = 'Materiale promoționale'
WHERE name = 'Promovare' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Publicații' AND d.sort_order = 3 AND s.company_id = 1);

INSERT INTO posts (name, section_id, user_id, description, sort_order, company_id)
SELECT 'Prognoză vânzări', s.id,
  (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%alisa%' OR LOWER(email) LIKE '%alisa%') AND is_active = true LIMIT 1),
  'Prognoza vânzărilor.', 1, 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE s.name = 'Vânzări' AND d.sort_order = 3 AND s.company_id = 1
  AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Prognoză vânzări' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order, company_id)
SELECT 'Coordonator vânzări', s.id,
  (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%alisa%' OR LOWER(email) LIKE '%alisa%') AND is_active = true LIMIT 1),
  'Coordonarea echipei de vânzări.', 2, 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE s.name = 'Vânzări' AND d.sort_order = 3 AND s.company_id = 1
  AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Coordonator vânzări' AND p.section_id = s.id);

UPDATE posts SET
  user_id = (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%alisa%' OR LOWER(email) LIKE '%alisa%') AND is_active = true LIMIT 1),
  description = 'Echipa de vânzări: Dorin DONȚU, Dorin APAHIDEAN, Ioan CARADAN, Árpád NAGY. Coordonator: Alisa MARINCAȘ.'
WHERE name = 'Vânzări' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Vânzări' AND d.sort_order = 3 AND s.company_id = 1);

UPDATE posts SET sort_order = CASE name WHEN 'Chestionare' THEN 1 WHEN 'Bază de date clienți' THEN 2 WHEN 'Campanii de promovare' THEN 3 WHEN 'Arhivă design' THEN 4 END
WHERE company_id = 1 AND name IN ('Chestionare', 'Bază de date clienți', 'Campanii de promovare', 'Arhivă design')
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Marketing' AND d.sort_order = 3 AND s.company_id = 1);

UPDATE posts SET sort_order = CASE name WHEN 'Prognoză vânzări' THEN 1 WHEN 'Coordonator vânzări' THEN 2 WHEN 'Vânzări' THEN 3 WHEN 'Clienți VIP' THEN 4 END
WHERE company_id = 1 AND name IN ('Prognoză vânzări', 'Coordonator vânzări', 'Vânzări', 'Clienți VIP')
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Vânzări' AND d.sort_order = 3 AND s.company_id = 1);

-- ============================================================
-- G) DIV 3 - Financiar (dept sort_order = 4)
-- ============================================================

UPDATE posts SET user_id = (SELECT id FROM users WHERE (LOWER(email) LIKE '%timea%' OR LOWER(display_name) LIKE '%tímea%' OR LOWER(display_name) LIKE '%timea%') AND is_active = true LIMIT 1)
WHERE name IN ('Facturare', 'Încasare') AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Facturare - Încasare' AND d.sort_order = 4 AND s.company_id = 1);

UPDATE posts SET user_id = (SELECT id FROM users WHERE (LOWER(email) LIKE '%timea%' OR LOWER(display_name) LIKE '%tímea%' OR LOWER(display_name) LIKE '%timea%') AND is_active = true LIMIT 1)
WHERE name = 'Achiziții' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Plăți' AND d.sort_order = 4 AND s.company_id = 1);

UPDATE posts SET name = 'Bază de date - documente',
  user_id = (SELECT id FROM users WHERE (LOWER(email) LIKE '%timea%' OR LOWER(display_name) LIKE '%tímea%' OR LOWER(display_name) LIKE '%timea%') AND is_active = true LIMIT 1)
WHERE name = 'Bază de date - Documente financiare' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Evidențe financiare' AND d.sort_order = 4 AND s.company_id = 1);

UPDATE posts SET user_id = (SELECT id FROM users WHERE (LOWER(email) LIKE '%timea%' OR LOWER(display_name) LIKE '%tímea%' OR LOWER(display_name) LIKE '%timea%') AND is_active = true LIMIT 1)
WHERE name = 'Inventar' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Evidențe financiare' AND d.sort_order = 4 AND s.company_id = 1);

-- Intretinere patrimoniu + Consumabile move to DIV 5 / Operare (holder Timea).
UPDATE posts SET
  section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                WHERE s.name = 'Operare' AND d.sort_order = 6 AND s.company_id = 1),
  user_id = (SELECT id FROM users WHERE (LOWER(email) LIKE '%timea%' OR LOWER(display_name) LIKE '%tímea%' OR LOWER(display_name) LIKE '%timea%') AND is_active = true LIMIT 1)
WHERE name IN ('Întreținere patrimoniu', 'Consumabile') AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Evidențe financiare' AND d.sort_order = 4 AND s.company_id = 1);

UPDATE posts SET sort_order = CASE name WHEN 'Achiziții' THEN 1 WHEN 'Salarii, Comision, Deconturi' THEN 2 WHEN 'Plăți' THEN 3 END
WHERE company_id = 1 AND name IN ('Achiziții', 'Salarii, Comision, Deconturi', 'Plăți')
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Plăți' AND d.sort_order = 4 AND s.company_id = 1);

UPDATE posts SET sort_order = CASE name WHEN 'Bază de date - documente' THEN 1 WHEN 'Inventar' THEN 2 WHEN 'Contabilitate' THEN 3 END
WHERE company_id = 1 AND name IN ('Bază de date - documente', 'Inventar', 'Contabilitate')
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Evidențe financiare' AND d.sort_order = 4 AND s.company_id = 1);

-- ============================================================
-- H) DIV 4 - Producție (dept sort_order = 5)
-- ============================================================

-- H1) Pregatire: rename + holders + 2 new posts
UPDATE posts SET name = 'Programare proiecte noi'
WHERE name = 'Programare proiecte' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Pregătire' AND d.sort_order = 5 AND s.company_id = 1);

UPDATE posts SET user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1)
WHERE name IN ('Analiza informații', 'Programare proiecte noi', 'Programare vizită clienți') AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Pregătire' AND d.sort_order = 5 AND s.company_id = 1);

INSERT INTO posts (name, section_id, user_id, description, sort_order, company_id)
SELECT 'Date de la taxe și impozite', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Obținerea datelor de la taxe și impozite pentru proiecte.', 2, 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE s.name = 'Pregătire' AND d.sort_order = 5 AND s.company_id = 1
  AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Date de la taxe și impozite' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order, company_id)
SELECT 'Autorizații (zbor dronă, CNC)', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Obținerea autorizațiilor necesare (zbor dronă, CNC).', 3, 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE s.name = 'Pregătire' AND d.sort_order = 5 AND s.company_id = 1
  AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Autorizații (zbor dronă, CNC)' AND p.section_id = s.id);

UPDATE posts SET sort_order = CASE name WHEN 'Analiza informații' THEN 1 WHEN 'Date de la taxe și impozite' THEN 2 WHEN 'Autorizații (zbor dronă, CNC)' THEN 3 WHEN 'Programare proiecte noi' THEN 4 WHEN 'Programare vizită clienți' THEN 5 END
WHERE company_id = 1 AND name IN ('Analiza informații', 'Date de la taxe și impozite', 'Autorizații (zbor dronă, CNC)', 'Programare proiecte noi', 'Programare vizită clienți')
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Pregătire' AND d.sort_order = 5 AND s.company_id = 1);

-- H2) Realizare + Predare: the old process-based posts are replaced by
-- product-based posts. HARD DELETE per Robert. Tasks fall to unassigned
-- (FK ON DELETE SET NULL), policy links cascade, template refs nulled here
-- because task_templates has no FK on assigned_post_id.

UPDATE task_templates SET assigned_post_id = NULL
WHERE assigned_post_id IN (
  SELECT p.id FROM posts p
  JOIN sections s ON p.section_id = s.id
  JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 5 AND p.company_id = 1 AND s.name IN ('Realizare', 'Predare')
    AND p.name IN ('Colectare date', 'Verificare date', 'GIS', 'Verificarea datelor', 'Obținere HCL', 'Pregătire introducere RENNS', 'Introducere în R.E.N.N.S.', 'Verificare înainte de predare', 'Predare date suplimentare cu PV semnat')
);

DELETE FROM posts
WHERE id IN (
  SELECT p.id FROM posts p
  JOIN sections s ON p.section_id = s.id
  JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 5 AND p.company_id = 1 AND s.name IN ('Realizare', 'Predare')
    AND p.name IN ('Colectare date', 'Verificare date', 'GIS', 'Verificarea datelor', 'Obținere HCL', 'Pregătire introducere RENNS', 'Introducere în R.E.N.N.S.', 'Verificare înainte de predare', 'Predare date suplimentare cu PV semnat')
);

-- H3) Realizare: product-based posts. Holder = team lead (management level).
INSERT INTO posts (name, section_id, user_id, description, sort_order, company_id)
SELECT v.name, s.id, v.user_id, v.description, v.sort_order, 1
FROM (VALUES
  ('Ortofoto', (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%lorin%' OR LOWER(display_name) LIKE '%batinas%' OR LOWER(display_name) LIKE '%bătinaș%') AND is_active = true LIMIT 1), 'Echipa Lorin BĂTINAȘ: Lorin BĂTINAȘ, Sergiu TĂUTAN.', 1),
  ('RENNS', (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%lorin%' OR LOWER(display_name) LIKE '%batinas%' OR LOWER(display_name) LIKE '%bătinaș%') AND is_active = true LIMIT 1), 'Echipa Lorin BĂTINAȘ: Sergiu TĂUTAN, Vlăduț HAPCA.', 2),
  ('RSV', (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%lorin%' OR LOWER(display_name) LIKE '%batinas%' OR LOWER(display_name) LIKE '%bătinaș%') AND is_active = true LIMIT 1), 'Echipa Lorin BĂTINAȘ: Paul CÎMPEAN, Andrei NEGRU.', 3),
  ('Cartinspect', (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%kovasznai%' OR LOWER(display_name) LIKE '%kovásznai%') AND is_active = true LIMIT 1), 'Echipa András KOVÁSZNAI: Dóra JAKAB, Boglárka SZÉKELY, Alexia RUS, Roxana MICULAȘ.', 4),
  ('GPR', (SELECT id FROM users WHERE LOWER(display_name) LIKE '%ifrim%' AND is_active = true LIMIT 1), 'Responsabil: Vlad IFRIM.', 5),
  ('WebGIS', (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%szocs%' OR LOWER(display_name) LIKE '%szőcs%') AND is_active = true LIMIT 1), 'Responsabil: István SZŐCS.', 6)
) AS v(name, user_id, description, sort_order)
CROSS JOIN LATERAL (
  SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
  WHERE s.name = 'Realizare' AND d.sort_order = 5 AND s.company_id = 1
) AS s
WHERE NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = v.name AND p.section_id = s.id);

-- H4) Predare: per-product quality control + handover.
UPDATE posts SET name = 'Predare proiect',
  user_id = (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%lorin%' OR LOWER(display_name) LIKE '%batinas%' OR LOWER(display_name) LIKE '%bătinaș%') AND is_active = true LIMIT 1),
  description = 'Lorin BĂTINAȘ, Sergiu TĂUTAN, Vlăduț HAPCA.'
WHERE name = 'Predarea proiectului' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Predare' AND d.sort_order = 5 AND s.company_id = 1);

INSERT INTO posts (name, section_id, user_id, description, sort_order, company_id)
SELECT v.name, s.id, v.user_id, v.description, v.sort_order, 1
FROM (VALUES
  ('Control calitate - RENNS', (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%tautan%' OR LOWER(display_name) LIKE '%tăutan%') AND is_active = true LIMIT 1), 'Responsabil: Sergiu TĂUTAN.', 1),
  ('Control calitate - RSV', (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%lorin%' OR LOWER(display_name) LIKE '%batinas%' OR LOWER(display_name) LIKE '%bătinaș%') AND is_active = true LIMIT 1), 'Responsabil: Lorin BĂTINAȘ.', 2),
  ('Control calitate - Cartinspect', (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%kovasznai%' OR LOWER(display_name) LIKE '%kovásznai%') AND is_active = true LIMIT 1), 'Responsabil: András KOVÁSZNAI.', 3),
  ('Control calitate - GPR', (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%páll%' OR LOWER(display_name) LIKE '%pall%') AND is_active = true LIMIT 1), 'Responsabil: Dávid Gergely PÁLL.', 4),
  ('Control calitate - WebGIS', (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%szocs%' OR LOWER(display_name) LIKE '%szőcs%') AND is_active = true LIMIT 1), 'Responsabil: István SZŐCS.', 5)
) AS v(name, user_id, description, sort_order)
CROSS JOIN LATERAL (
  SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
  WHERE s.name = 'Predare' AND d.sort_order = 5 AND s.company_id = 1
) AS s
WHERE NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = v.name AND p.section_id = s.id);

UPDATE posts SET sort_order = 6
WHERE name = 'Predare proiect' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Predare' AND d.sort_order = 5 AND s.company_id = 1);

-- ============================================================
-- I) DIV 5 - Calitate și calificare (dept sort_order = 6)
-- ============================================================
-- Sections were renamed in B: Examinare->Calificare, Performanță->Calitate
-- organizațională, Verificare->Operare. Medicina/Protecția muncii already
-- moved to HR in E.

UPDATE posts SET user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1)
WHERE name IN ('Instruire', 'Verificare cunoștințe') AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Calificare' AND d.sort_order = 6 AND s.company_id = 1);

UPDATE posts SET sort_order = CASE name WHEN 'Instruire' THEN 1 WHEN 'Verificare cunoștințe' THEN 2 END
WHERE company_id = 1 AND name IN ('Instruire', 'Verificare cunoștințe')
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Calificare' AND d.sort_order = 6 AND s.company_id = 1);

-- 'Proiecte înainte de predare' -> 'Verificare predare' (same duty, new name),
-- and it moves from ex-Verificare (now Operare) into Calitate organizațională.
UPDATE posts SET name = 'Verificare predare',
  section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                WHERE s.name = 'Calitate organizațională' AND d.sort_order = 6 AND s.company_id = 1),
  user_id = (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1)
WHERE name = 'Proiecte înainte de predare' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Operare' AND d.sort_order = 6 AND s.company_id = 1);

-- 'Feedback de le clienți despre colegi' -> 'Verificare satisfacție client'.
UPDATE posts SET name = 'Verificare satisfacție client',
  section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                WHERE s.name = 'Calitate organizațională' AND d.sort_order = 6 AND s.company_id = 1),
  user_id = (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%alisa%' OR LOWER(email) LIKE '%alisa%') AND is_active = true LIMIT 1)
WHERE name = 'Feedback de le clienți despre colegi' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Operare' AND d.sort_order = 6 AND s.company_id = 1);

UPDATE posts SET user_id = (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1)
WHERE name = 'SOP' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Calitate organizațională' AND d.sort_order = 6 AND s.company_id = 1);

UPDATE posts SET user_id = (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1)
WHERE name = 'Examinare feedback + corectare' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Calitate organizațională' AND d.sort_order = 6 AND s.company_id = 1);

UPDATE posts SET sort_order = CASE name WHEN 'SOP' THEN 1 WHEN 'Examinare feedback + corectare' THEN 2 WHEN 'Verificare predare' THEN 3 WHEN 'Verificare satisfacție client' THEN 4 END
WHERE company_id = 1 AND name IN ('SOP', 'Examinare feedback + corectare', 'Verificare predare', 'Verificare satisfacție client')
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Calitate organizațională' AND d.sort_order = 6 AND s.company_id = 1);

-- Operare gathers every operations post, all held by Timea. Hardware +
-- Funcționare birou move over from ex-Performanță, Mașini from ex-Examinare.
UPDATE posts SET
  section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                WHERE s.name = 'Operare' AND d.sort_order = 6 AND s.company_id = 1)
WHERE name IN ('Hardware', 'Funcționare birou') AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Calitate organizațională' AND d.sort_order = 6 AND s.company_id = 1);

UPDATE posts SET
  section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                WHERE s.name = 'Operare' AND d.sort_order = 6 AND s.company_id = 1)
WHERE name = 'Mașini' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Calificare' AND d.sort_order = 6 AND s.company_id = 1);

UPDATE posts SET user_id = (SELECT id FROM users WHERE (LOWER(email) LIKE '%timea%' OR LOWER(display_name) LIKE '%tímea%' OR LOWER(display_name) LIKE '%timea%') AND is_active = true LIMIT 1)
WHERE name IN ('Funcționare softuri', 'Hardware', 'Funcționare birou', 'Mașini', 'Întreținere patrimoniu', 'Consumabile') AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Operare' AND d.sort_order = 6 AND s.company_id = 1);

UPDATE posts SET sort_order = CASE name WHEN 'Funcționare softuri' THEN 1 WHEN 'Hardware' THEN 2 WHEN 'Funcționare birou' THEN 3 WHEN 'Mașini' THEN 4 WHEN 'Întreținere patrimoniu' THEN 5 WHEN 'Consumabile' THEN 6 END
WHERE company_id = 1 AND name IN ('Funcționare softuri', 'Hardware', 'Funcționare birou', 'Mașini', 'Întreținere patrimoniu', 'Consumabile')
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Operare' AND d.sort_order = 6 AND s.company_id = 1);

-- ============================================================
-- J) DIV 6 - Extindere (dept sort_order = 7)
-- ============================================================

UPDATE posts SET name = 'Evenimente cu primari'
WHERE name = 'Evenimente unde sunt prezenți primarii' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Relații noi' AND d.sort_order = 7 AND s.company_id = 1);

UPDATE posts SET name = 'Politicieni'
WHERE name = 'Politicieni cu funcții înalte - Asociere de imagine' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Relații noi' AND d.sort_order = 7 AND s.company_id = 1);

INSERT INTO posts (name, section_id, user_id, description, sort_order, company_id)
SELECT 'Pregătire evenimente noi', s.id,
  (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%alisa%' OR LOWER(email) LIKE '%alisa%') AND is_active = true LIMIT 1),
  'Pregătirea evenimentelor noi.', 1, 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE s.name = 'Relații noi' AND d.sort_order = 7 AND s.company_id = 1
  AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Pregătire evenimente noi' AND p.section_id = s.id);

UPDATE posts SET name = 'Bază de date clienți potențiali',
  user_id = (SELECT id FROM users WHERE (LOWER(display_name) LIKE '%alisa%' OR LOWER(email) LIKE '%alisa%') AND is_active = true LIMIT 1)
WHERE name = 'Bază de date clienți' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Dezvoltare rețea' AND d.sort_order = 7 AND s.company_id = 1);

UPDATE posts SET name = 'Imagine și reputație',
  user_id = (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1)
WHERE name = 'Promovare' AND company_id = 1
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Promovare' AND d.sort_order = 7 AND s.company_id = 1);

INSERT INTO posts (name, section_id, user_id, description, sort_order, company_id)
SELECT 'Succese și referințe', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Colectarea și publicarea succeselor și referințelor.', 1, 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE s.name = 'Promovare' AND d.sort_order = 7 AND s.company_id = 1
  AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Succese și referințe' AND p.section_id = s.id);

UPDATE posts SET sort_order = CASE name WHEN 'Pregătire evenimente noi' THEN 1 WHEN 'Evenimente cu primari' THEN 2 WHEN 'Politicieni' THEN 3 END
WHERE company_id = 1 AND name IN ('Pregătire evenimente noi', 'Evenimente cu primari', 'Politicieni')
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Relații noi' AND d.sort_order = 7 AND s.company_id = 1);

UPDATE posts SET sort_order = CASE name WHEN 'Succese și referințe' THEN 1 WHEN 'Imagine și reputație' THEN 2 END
WHERE company_id = 1 AND name IN ('Succese și referințe', 'Imagine și reputație')
  AND section_id = (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id
                    WHERE s.name = 'Promovare' AND d.sort_order = 7 AND s.company_id = 1);
