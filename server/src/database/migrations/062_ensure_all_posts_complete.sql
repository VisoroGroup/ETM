-- Migration 062: Ensure ALL posts exist across ALL departments
-- Idempotent — uses INSERT ... WHERE NOT EXISTS to avoid duplicates
-- Also removes duplicate posts if any exist from partial migration reruns
-- Also cleans up user_id references for users that don't exist in the system

-- ============================================================
-- STEP 1: Remove duplicate posts (keep oldest by created_at)
-- ============================================================
DELETE FROM posts WHERE id IN (
  SELECT p.id FROM posts p
  JOIN (
    SELECT name, section_id, MIN(created_at) as min_created
    FROM posts
    WHERE is_active = true
    GROUP BY name, section_id
    HAVING COUNT(*) > 1
  ) dups ON p.name = dups.name AND p.section_id = dups.section_id AND p.created_at > dups.min_created
  WHERE NOT EXISTS (SELECT 1 FROM tasks t WHERE t.assigned_post_id = p.id)
);

-- ============================================================
-- STEP 2: Clean up user_id for users that don't exist
-- ============================================================
UPDATE posts SET user_id = NULL
WHERE user_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = posts.user_id AND u.is_active = true);

-- ============================================================
-- 7 - ADMINISTRATIV (dept sort_order=1)
-- ============================================================

-- Resurse (sec sort=1): Tech, Directive de funcționare, Administrare
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Tech', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Urmărirea precisă a tehnologiei companiei.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 1 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Tech' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Directive de funcționare', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Respectarea directivelor de funcționare.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 1 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Directive de funcționare' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Administrare', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Întreținerea spațiilor organizației.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 1 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Administrare' AND p.section_id = s.id AND p.is_active = true);

-- Cazuri speciale (sec sort=2): Cazuri speciale, Juridic, Contracte
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Cazuri speciale', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Firma să fie în siguranță dacă sunt atacuri externe, ține legătura cu mediul instituțional.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 1 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Cazuri speciale' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Juridic', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Toate aspectele juridice ale firmei sunt în regulă.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 1 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Juridic' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Contracte', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Toate contractele, care ies, sau intră în firmă să aibă formă legală că și baza.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 1 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Contracte' AND p.section_id = s.id AND p.is_active = true);

-- Director general (sec sort=3): Director executiv, Strategie, Strategie financiară, Prețuri produse, Strategie de extindere, Salarii, Aprobare achiziții
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Director executiv', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  NULL, 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 1 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Director executiv' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Strategie', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Se ocupă de strategia firmei.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 1 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Strategie' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Strategie financiară', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Firma să fie solvabila.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 1 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Strategie financiară' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Prețuri produse', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Prețurile sunt la zi și reale.', 4
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 1 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Prețuri produse' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Strategie de extindere', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Responsabil pentru ca compania să fie viabilă, productivă și în expansiune.', 5
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 1 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Strategie de extindere' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Salarii', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Colegii să fie mulțumiți de salariile pe care le primesc în funcție de performanțele lor.', 6
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 1 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Salarii' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Aprobare achiziții', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Aprobă orice achiziție nouă.', 7
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 1 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Aprobare achiziții' AND p.section_id = s.id AND p.is_active = true);

-- ============================================================
-- 1 - HR - COMUNICARE (dept sort_order=2)
-- ============================================================

-- HR (sec sort=1): Tabel de organizare, Angajare, Posturi, Control regulament
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Tabel de organizare', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Monitorizează, compară harta Visoro cu realitatea, notează fiecare modificare și se asigură că tabelul de organizare reflectă în totalitate structura societății.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 2 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Tabel de organizare' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Angajare', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Angajează colegi potriviți.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 2 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Angajare' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Posturi', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Se asigură că toți angajații (noi sau existenți) au fost instruiți și lucrează conform procedurilor de lucru.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 2 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Posturi' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Control regulament', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Se asigură că toate regulamentele organizației sunt respectate.', 4
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 2 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Control regulament' AND p.section_id = s.id AND p.is_active = true);

-- Comunicare (sec sort=2): Comunicare externă, Comunicare internă, Arhivă, Bază de date colaboratori, Ședințe
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Comunicare externă', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Ține legătura cu clienții și partenerii firmei, se asigură că toate comunicările noastre exterioare să decurgă perfect. Trimitere: contracte, acte adiționale, comunicare stadiu contract.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 2 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Comunicare externă' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Comunicare internă', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Controlează, întreține sistemul de comunicare intern, redirecționează emailurile primite pe office către persoanele de interes. Informează toată firma despre stadiul fiecărui proiect.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 2 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Comunicare internă' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Arhivă', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Deține toate documentele originale ale societății (CUI, protocol de colaborare, etc.).', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 2 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Arhivă' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Bază de date colaboratori', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Se ocupă să întrețină baza de date cu toți colaboratorii firmei.', 4
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 2 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Bază de date colaboratori' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Ședințe', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Zilnice, săptămânale, lunare, trimestriale, anuale, team building.', 5
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 2 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Ședințe' AND p.section_id = s.id AND p.is_active = true);

-- Statistici (sec sort=3): Statistici, Formule de funcționare
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Statistici', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Realizarea, desenarea, afișarea statisticilor respectiv verificarea și examinarea lor. Stabilește formula stării de funcționare și se asigură că pașii formulei sunt urmați.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 2 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Statistici' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Formule de funcționare', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Se asigură că pe baza statisticilor sunt realizate formulele de funcționare.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 2 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Formule de funcționare' AND p.section_id = s.id AND p.is_active = true);

-- ============================================================
-- 2 - VANZARI (dept sort_order=3)
-- ============================================================

-- Marketing (sec sort=1): Chestionare, Campanii de promovare, Bază de date clienți, Arhivă design
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Chestionare', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Pregătirea unui chestionar pentru a identifica nevoile clienților, respectiv evaluarea lor.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 3 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Chestionare' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Campanii de promovare', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Email marketing + SMS.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 3 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Campanii de promovare' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Bază de date clineți', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Întreținerea la perfecțiune a bazei de date de clienți existenți (denumire client, adresă, număr de telefon de la oamenii de legatură, zile de naștere). Se ocupă să țină baza de date cu clienții foarte vie.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 3 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Bază de date clineți' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Arhivă design', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Deține toate elementele de design în format vectorial (mape, cărți de vizită, oferte, logo), respectiv la nevoie le multiplică și le folosește.', 4
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 3 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Arhivă design' AND p.section_id = s.id AND p.is_active = true);

-- Publicații (sec sort=2): Promovare
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Promovare', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Publică toate materialele primite pe toate canalele de comunicare (Facebook, Instagram, LinkedIn) + Newsletters + SMS.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 3 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Promovare' AND p.section_id = s.id AND p.is_active = true);

-- Vânzări (sec sort=3): Vânzări, Clienți VIP
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Vânzări', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Produsele societății sunt vândute într-un număr mare.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 3 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Vânzări' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Clienți VIP', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Meținerea unei legături strânse cu clienții cei mai importanți.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 3 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Clienți VIP' AND p.section_id = s.id AND p.is_active = true);

-- ============================================================
-- 3 - FINANCIAR (dept sort_order=4)
-- ============================================================

-- Facturare - Încasare (sec sort=1): Facturare, Încasare
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Facturare', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Facturarea conform contractului pe baza cerințelor departamentului de producție și a procesului verbal semnat, într-un timp cât mai scurt. Se asigură că fiecare factură a fost trimisă și descărcată prin portal e-facturi. Înregistrează facturile în baza de date.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 4 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Facturare' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Încasare', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Verificarea sumelor încasate, cât și realizarea listei cu facturile neîncasate. Contactează și menține o legătură strânsă cu departamentul financiar al clienților în vederea efectuării încasărilor.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 4 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Încasare' AND p.section_id = s.id AND p.is_active = true);

-- Plăți (sec sort=2): Achiziții, Salarii/Comision/Deconturi, Plăți
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Achiziții', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Se asigură că solicitările de achiziții aprobate sunt cumpărate și puse la dispoziția solicitantului.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 4 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Achiziții' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Salarii, Comision, Deconturi', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Se ocupă de adunarea documentelor financiare și realizarea deconturilor. Calcularea comisioanelor pe baza statisticilor. Plata salariilor la timp.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 4 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Salarii, Comision, Deconturi' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Plăți', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Pe baza planului bugetar alocă banii în conturi și plătește facturile.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 4 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Plăți' AND p.section_id = s.id AND p.is_active = true);

-- Evidențe financiare (sec sort=3): Bază de date - Documente financiare, Inventar, Întreținere patrimoniu, Consumabile, Contabilitate
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Bază de date - Documente financiare', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Toate documentele financiare (bonuri, chitanțe, facturi) sunt adunate, verificate și înregistrate în baza de date.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 4 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Bază de date - Documente financiare' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Inventar', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Realizarea evidenței financiare a firmei, evidența monetară și a obiectelor de inventar.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 4 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Inventar' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Întreținere patrimoniu', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Întreținerea permanentă a tuturor echipamentelor din proprietatea firmei, rezolvarea reparațiilor când este nevoie (mașini, birou, uniforme, laptopuri, telefoane).', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 4 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Întreținere patrimoniu' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Consumabile', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Inventarierea consumabilelor, pentru ca tot timpul să fie destul din ce este nevoie, pregătirea listei de necesități.', 4
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 4 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Consumabile' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Contabilitate', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Contabilitatea primară realizată la timp și cu precizie, ține legătura cu firma care face contabilitatea. Verifică lunar situația noastră și cea a contabilei.', 5
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 4 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Contabilitate' AND p.section_id = s.id AND p.is_active = true);

-- ============================================================
-- 4 - PRODUCTIE (dept sort_order=5)
-- ============================================================

-- Pregătire (sec sort=1): Analiza informații, Programare proiecte, Programare vizită clienți
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Analiza informații', s.id, NULL,
  'După semnarea contractului face o evaluare a proiectului și o listă de necesități pentru a începe programarea proiectului. Ține legătura cu clienții pentru obținerea documentelor necesare realizării proiectului.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Analiza informații' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Programare proiecte', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Realizarea programului anual/lunar/săptămânal.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Programare proiecte' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Programare vizită clienți', s.id, NULL,
  'Informare clienți.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Programare vizită clienți' AND p.section_id = s.id AND p.is_active = true);

-- Realizare (sec sort=2): Colectare date, Verificare date, GIS, Verificarea datelor, Obținere HCL, Pregătire introducere RENNS, Introducere în R.E.N.N.S.
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Colectare date', s.id, NULL,
  '10 metode.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Colectare date' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Verificare date', s.id, NULL, NULL, 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Verificare date' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'GIS', s.id, NULL,
  'Trasarea străzilor, completarea atributelor, efectuarea renumerotării, dacă este cazul.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'GIS' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Verificarea datelor', s.id, NULL,
  'Verificarea corectitudinii datelor.', 4
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Verificarea datelor' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Obținere HCL', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  NULL, 5
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Obținere HCL' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Pregătire introducere RENNS', s.id, NULL,
  'Se asigură că are toate informațiile disponibile înainte de începerea introducerii în R.E.N.N.S., varianta finală de GIS este încărcată pe drive, sunt conturi, verifică HCL-ul. Pregătește checklistul.', 6
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Pregătire introducere RENNS' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Introducere în R.E.N.N.S.', s.id, NULL, NULL, 7
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Introducere în R.E.N.N.S.' AND p.section_id = s.id AND p.is_active = true);

-- Predare (sec sort=3): Verificare înainte de predare, Predarea proiectului, Predare date suplimentare cu PV semnat
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Verificare înainte de predare', s.id, NULL,
  'Checklist R.E.N.N.S.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Verificare înainte de predare' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Predarea proiectului', s.id, NULL, NULL, 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Predarea proiectului' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Predare date suplimentare cu PV semnat', s.id, NULL,
  'GIS + Anexe + în R.E.N.N.S. cum și unde sunt + toate aspectele pe care trebuie să știe primăria.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Predare date suplimentare cu PV semnat' AND p.section_id = s.id AND p.is_active = true);

-- ============================================================
-- 5 - CALITATE SI CALIFICARE (dept sort_order=6)
-- ============================================================

-- Verificare (sec sort=1): Proiecte înainte de predare, Feedback de le clienți despre colegi, Funcționare softuri
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Proiecte înainte de predare', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Pe bază de checklist. Verificare produse, ca să fie în conformitate cu standardele firmei.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Proiecte înainte de predare' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Feedback de le clienți despre colegi', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Adună și îndosariază feedbackurile primite (de la clienți legate de produse și colegi, respectiv feedbackuri de la colegi despre clienți și organizație).', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Feedback de le clienți despre colegi' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Funcționare softuri', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Toate softurile folosite funcționează corect, subscripțiile sunt la zi, colegii pot lucra fără probleme.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Funcționare softuri' AND p.section_id = s.id AND p.is_active = true);

-- Examinare (sec sort=2): Verificare cunoștințe, Protecția muncii, Medicina muncii, Instruire, Mașini
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Verificare cunoștințe', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Se fac teste periodice pentru verificarea cunoștințelor legate de procedurile interne și munca efectivă.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Verificare cunoștințe' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Protecția muncii', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Ține legătura cu firma de PSI (protecție și securitate în muncă), se asigură că totul este actualizat.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Protecția muncii' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Medicina muncii', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Ține evidență clară despre fișele de aptitudini, anunță și programează colegii la analizele anuale de medicina muncii.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Medicina muncii' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Instruire', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'În funcție de rezultatele testelor și necesitățile organizației caută și organizează cursuri de specialitate.', 4
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Instruire' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Mașini', s.id, NULL,
  'Verificarea săptămânală a mașinilor, trimiterea la service, gestionarea flotei auto.', 5
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Mașini' AND p.section_id = s.id AND p.is_active = true);

-- Performanță (sec sort=3): Examinare feedback + corectare, SOP, Hardware, Funcționare birou
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Examinare feedback + corectare', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Analizează feedbackurile primite, căutând cauza succesului sau identificarea greșelii. Pe baza analizei pregătește o propunere de recompensare și/sau modificarea, completarea directivelor de funcționare.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Examinare feedback + corectare' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'SOP', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Realizarea procedurilor standard de operare pentru toate procesele firmei.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'SOP' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Hardware', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Menținerea în funcțiune a tuturor echipamentelor hardware.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Hardware' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Funcționare birou', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Asigurarea funcționării optime a biroului (curățenie, consumabile, întreținere).', 4
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Funcționare birou' AND p.section_id = s.id AND p.is_active = true);

-- ============================================================
-- 6 - EXTINDERE (dept sort_order=7)
-- ============================================================

-- Relații noi (sec sort=1): Evenimente unde sunt prezenți primarii, Politicieni cu funcții înalte - Asociere de imagine
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Evenimente unde sunt prezenți primarii', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Se ocupă ca la fiecare manifestare posibilă unde sunt primari să fie prezentă și firma, într-un fel sau altul.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 7 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Evenimente unde sunt prezenți primarii' AND p.section_id = s.id AND p.is_active = true);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Politicieni cu funcții înalte - Asociere de imagine', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  NULL, 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 7 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Politicieni cu funcții înalte - Asociere de imagine' AND p.section_id = s.id AND p.is_active = true);

-- Extindere (sec sort=2): Bază de date clienți
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Bază de date clienți', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Se ocupă să întrețină și să mărească baza de date cu potențialii clienți calificați.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 7 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Bază de date clienți' AND p.section_id = s.id AND p.is_active = true);

-- Promovare (sec sort=3): Promovare
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Promovare', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Este responsabil să promoveze la cât mai mulți oameni, prin cât mai multe canale, cât de profesioniști suntem.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 7 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Promovare' AND p.section_id = s.id AND p.is_active = true);
