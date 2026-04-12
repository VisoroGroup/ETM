-- Migration 060: Fix missing posts and task assignments
-- This is an idempotent fix migration that ensures ALL posts exist
-- and ALL 35 task assignments are correctly set.
-- Uses INSERT ... WHERE NOT EXISTS to avoid duplicates.

-- ============================================================
-- ENSURE ALL CALITATE POSTS EXIST (dept sort=6)
-- ============================================================

-- Verificare section (sec=1)
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Proiecte înainte de predare', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Pe bază de checklist. Verificare produse, ca să fie în conformitate cu standardele firmei.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Proiecte înainte de predare' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Feedback de le clienți despre colegi', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Adună și îndosariază feedbackurile primite (de la clienți legate de produse și colegi, respectiv feedbackuri de la colegi despre clienți și organizație).', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Feedback de le clienți despre colegi' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Funcționare softuri', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Minden létező szoftver amit használunk, legyen az az email rendszer, AI feliratkozások, termeléshez szükséges szoftok — minden működjön, figyelve legyen rá, hogy ne járjon le a subscription, hogy mindenki tudja nyugodtan csinálni a dolgát.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Funcționare softuri' AND p.section_id = s.id);

-- Examinare section (sec=2)
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Verificare cunoștințe', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Se fac teste periodice pentru verificarea cunoștințelor legate de procedurile interne și munca efectivă.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Verificare cunoștințe' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Protecția muncii', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Ține legătura cu firma de PSI (protecție și securitate în muncă), se asigură că totul este actualizat.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Protecția muncii' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Medicina muncii', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Ține evidență clară despre fișele de aptitudini, anunță și programează colegii la analizele anuale de medicina muncii.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Medicina muncii' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Instruire', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'În funcție de rezultatele testelor și necesitățile organizației caută și organizează cursuri de specialitate.', 4
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Instruire' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Mașini', s.id, NULL,
  'Leellenőrizni minden héten a kocsikat, hogy tiszták-e, hogy hibásak-e. Szervizbe vitetni őket, amikor kell, és bármi ami a kocsi flottához tartozik.', 5
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Mașini' AND p.section_id = s.id);

-- Performanță section (sec=3)
INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Examinare feedback + corectare', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Analizează feedbackurile primite, căutând cauza succesului sau identificarea greșelii. Pe baza analizei pregătește o propunere de recompensare și/sau modificarea, completarea directivelor de funcționare.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Examinare feedback + corectare' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'SOP', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Minden egyes létező folyamatról SOP-kat ír a cégben, legyen az iroda működés, termék gyártás, termék leadás — mindenre kell legyen SOP.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'SOP' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Hardware', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Minden hardware-t tartson működésben és vigyázzon rá, hogy működjenek és mindig legyenek toppon.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Hardware' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Funcționare birou', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Biztosítja, hogy az irodában mindig van kávé, tej, papír, toll, takarítva van, karban van tartva az iroda, maga az egész iroda optimálisan működik.', 4
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 6 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Funcționare birou' AND p.section_id = s.id);

-- ============================================================
-- ENSURE ALL EXTINDERE POSTS EXIST (dept sort=7)
-- ============================================================

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Evenimente unde sunt prezenți primarii', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Se ocupă ca la fiecare manifestare posibilă unde sunt primari să fie prezentă și firma, într-un fel sau altul.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 7 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Evenimente unde sunt prezenți primarii' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Politicieni cu funcții înalte - Asociere de imagine', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  NULL, 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 7 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Politicieni cu funcții înalte - Asociere de imagine' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Bază de date clienți', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
  'Se ocupă să întrețină și să mărească baza de date cu potențialii clienți calificați.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 7 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Bază de date clienți' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Promovare', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
  'Este responsabil să promoveze la cât mai mulți oameni, prin cât mai multe canale, cât de profesioniști suntem.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 7 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Promovare' AND p.section_id = s.id);

-- ============================================================
-- ENSURE ALL PRODUCȚIE POSTS EXIST (dept sort=5)
-- ============================================================

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Analiza informații', s.id, NULL,
  'După semnarea contractului face o evaluare a proiectului și o listă de necesități pentru a începe programarea proiectului.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Analiza informații' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Programare proiecte', s.id,
  (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
  'Realizarea programului anual/lunar/săptămânal.', 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Programare proiecte' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Programare vizită clienți', s.id, NULL, 'Informare clienți.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 1
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Programare vizită clienți' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Colectare date', s.id, NULL, '10 metode.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Colectare date' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Verificare date', s.id, NULL, NULL, 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Verificare date' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'GIS', s.id, NULL, 'Trasarea străzilor, completarea atributelor, efectuarea renumerotării, dacă este cazul.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'GIS' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Verificarea datelor', s.id, NULL, 'Verificarea corectitudinii datelor.', 4
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Verificarea datelor' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Obținere HCL', s.id,
  (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1), NULL, 5
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Obținere HCL' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Pregătire introducere RENNS', s.id, NULL,
  'Se asigură că are toate informațiile disponibile înainte de începerea introducerii în R.E.N.N.S.', 6
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Pregătire introducere RENNS' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Introducere în R.E.N.N.S.', s.id, NULL, NULL, 7
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 2
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Introducere în R.E.N.N.S.' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Verificare înainte de predare', s.id, NULL, 'Checklist R.E.N.N.S.', 1
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Verificare înainte de predare' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Predarea proiectului', s.id, NULL, NULL, 2
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Predarea proiectului' AND p.section_id = s.id);

INSERT INTO posts (name, section_id, user_id, description, sort_order)
SELECT 'Predare date suplimentare cu PV semnat', s.id, NULL,
  'GIS + Anexe + în R.E.N.N.S.', 3
FROM sections s JOIN departments d ON s.department_id = d.id
WHERE d.sort_order = 5 AND s.sort_order = 3
AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.name = 'Predare date suplimentare cu PV semnat' AND p.section_id = s.id);

-- ============================================================
-- RE-RUN ALL 35 TASK ASSIGNMENTS (idempotent — UPDATE is safe)
-- ============================================================

-- 1. Eljutni fehervari → Politicieni (6-Ext/Relații noi)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 7 AND s.sort_order = 1 AND p.name = 'Politicieni cu funcții înalte - Asociere de imagine'
) WHERE id = '1248354e-808d-4707-9d88-525854d3bcce' AND assigned_post_id IS NULL;

-- 2. Podcastosnak → Promovare (6-Ext/Promovare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 7 AND s.sort_order = 3 AND p.name = 'Promovare'
) WHERE id = 'a35dce17-075e-48eb-9881-b5a9d6c44844' AND assigned_post_id IS NULL;

-- 3. Arabella → Angajare (1-HR/HR)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 2 AND s.sort_order = 1 AND p.name = 'Angajare'
) WHERE id = '4c45edc9-01a9-4cf6-9728-5a7cf40da68c' AND assigned_post_id IS NULL;

-- 4. Spiroiunak → Strategie (7-Admin/Dir.gen)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 3 AND p.name = 'Strategie'
) WHERE id = 'd01d039f-301d-41e7-bb8d-54c7fca60dce' AND assigned_post_id IS NULL;

-- 5. SMS kuldo → Strategie (7-Admin/Dir.gen)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 3 AND p.name = 'Strategie'
) WHERE id = '53592633-843d-467d-b64e-d6c369e734a8' AND assigned_post_id IS NULL;

-- 6. David terepre → Programare proiecte (4-Prod/Pregătire)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 5 AND s.sort_order = 1 AND p.name = 'Programare proiecte'
) WHERE id = '07a98e72-2b4a-41b1-b6df-451135940d65' AND assigned_post_id IS NULL;

-- 7. Dgitalizare PUG → Strategie (7-Admin/Dir.gen)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 3 AND p.name = 'Strategie'
) WHERE id = 'da58a47e-bded-4aa8-88f2-c147d908c4d3' AND assigned_post_id IS NULL;

-- 8. Bonusztablazat → Salarii, Comision, Deconturi (3-Fin/Plăți)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 4 AND s.sort_order = 2 AND p.name = 'Salarii, Comision, Deconturi'
) WHERE id = '1d7ccce2-5229-48cd-a492-613b693a6465' AND assigned_post_id IS NULL;

-- 9. Aiud RSV → Verificare date (4-Prod/Realizare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 5 AND s.sort_order = 2 AND p.name = 'Verificare date'
) WHERE id = '38e90472-4eb3-4399-9adf-3d69d918cc5a' AND assigned_post_id IS NULL;

-- 10. Syscad → Funcționare softuri (5-Cal/Verificare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 1 AND p.name = 'Funcționare softuri'
) WHERE id = 'e18ebe5e-4a44-4478-9e82-a64d00c0dd5d' AND assigned_post_id IS NULL;

-- 11. Tudor szerzodes → Contracte (7-Admin/Cazuri sp)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 2 AND p.name = 'Contracte'
) WHERE id = 'd547e16d-8806-4163-b9c6-550c13d8f6dd' AND assigned_post_id IS NULL;

-- 12. Tudor+Istvan webGIS → Strategie (7-Admin/Dir.gen)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 3 AND p.name = 'Strategie'
) WHERE id = 'bd46a422-505e-4f47-a6b2-3655a13515e7' AND assigned_post_id IS NULL;

-- 13. WC javitas → Administrare (7-Admin/Resurse)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 1 AND p.name = 'Administrare'
) WHERE id = '41cd17ac-ff4e-4383-b1ad-c84e339e58c0' AND assigned_post_id IS NULL;

-- 14. 3D Magurele → Predarea proiectului (4-Prod/Predare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 5 AND s.sort_order = 3 AND p.name = 'Predarea proiectului'
) WHERE id = 'ae8f5357-135b-4c1c-b967-9674cc6f59e1' AND assigned_post_id IS NULL;

-- 15. GPR munkafolyamat → SOP (5-Cal/Performanță)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 3 AND p.name = 'SOP'
) WHERE id = 'f4f190ed-9fea-471a-bca3-cf2af166c217' AND assigned_post_id IS NULL;

-- 16. CNC első → Cazuri speciale (7-Admin/Cazuri sp)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 2 AND p.name = 'Cazuri speciale'
) WHERE id = '1685a533-8aa6-4d5e-814e-c40a749f7709' AND assigned_post_id IS NULL;

-- 17. Miercurea Sibiului → Proiecte înainte de predare (5-Cal/Verificare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 1 AND p.name = 'Proiecte înainte de predare'
) WHERE id = 'af27bae5-b570-4196-9b4c-96ea029ad69b' AND assigned_post_id IS NULL;

-- 18. Consultanta Adi → Contracte (7-Admin/Cazuri sp)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 2 AND p.name = 'Contracte'
) WHERE id = '37e572fe-4d2a-48b9-a980-84d491cd5900' AND assigned_post_id IS NULL;

-- 19. ANCPI → Cazuri speciale (7-Admin/Cazuri sp)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 2 AND p.name = 'Cazuri speciale'
) WHERE id = 'db786f16-3237-4073-8f4d-e8cad1e2c910' AND assigned_post_id IS NULL;

-- 20. Dacia → Mașini (5-Cal/Examinare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 2 AND p.name = 'Mașini'
) WHERE id = '54347deb-1ef6-4ab8-8362-7ce3d1f558e6' AND assigned_post_id IS NULL;

-- 21. Flota vineri → Mașini (5-Cal/Examinare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 2 AND p.name = 'Mașini'
) WHERE id = 'f1b5e9a9-cf21-4021-90fb-07ba1b38921e' AND assigned_post_id IS NULL;

-- 22. Arobs GPS → Funcționare softuri (5-Cal/Verificare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 1 AND p.name = 'Funcționare softuri'
) WHERE id = '3016a2dd-a9e6-4983-94da-b82211a3be47' AND assigned_post_id IS NULL;

-- 23. Anvelope vara → Mașini (5-Cal/Examinare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 2 AND p.name = 'Mașini'
) WHERE id = '79500a41-2743-4356-9fa3-c4edac9f33ce' AND assigned_post_id IS NULL;

-- 24. Anvelope iarna → Mașini (5-Cal/Examinare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 2 AND p.name = 'Mașini'
) WHERE id = '225273e1-4f50-4f8f-a989-fb5d1031db4f' AND assigned_post_id IS NULL;

-- 25. Flota luni → Mașini (5-Cal/Examinare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 2 AND p.name = 'Mașini'
) WHERE id = '4d2731c5-d517-4116-a2eb-4b64c0ab2912' AND assigned_post_id IS NULL;

-- 26. Newsletter → Promovare (2-Vânzări/Publicații)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 3 AND s.sort_order = 2 AND p.name = 'Promovare'
) WHERE id = '05f7c28c-6bb2-404b-a14f-9579a3db4df6' AND assigned_post_id IS NULL;

-- 27. ING → Strategie financiară (7-Admin/Dir.gen)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 3 AND p.name = 'Strategie financiară'
) WHERE id = 'cb5c15f5-515c-4913-8f41-4d7ad0b367c7' AND assigned_post_id IS NULL;

-- 28. ReScan → Strategie (7-Admin/Dir.gen)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 3 AND p.name = 'Strategie'
) WHERE id = 'cd3aab55-2c77-4cf0-b69a-2fb8f4ed8b9c' AND assigned_post_id IS NULL;

-- 29. Indiaiakkal → Strategie (7-Admin/Dir.gen)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 3 AND p.name = 'Strategie'
) WHERE id = 'f9b48eb1-8f6e-4e79-9b2f-6bedf4b68597' AND assigned_post_id IS NULL;

-- 30. Tulcea → Proiecte înainte de predare (5-Cal/Verificare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 1 AND p.name = 'Proiecte înainte de predare'
) WHERE id = '67ee262b-9f06-48a0-adb2-27b269f3a79a' AND assigned_post_id IS NULL;

-- 31. Plotter → Hardware (5-Cal/Performanță)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 3 AND p.name = 'Hardware'
) WHERE id = '5d8fc616-1684-4f36-87e5-fc5d22e97c3a' AND assigned_post_id IS NULL;

-- 32. Cristian RSV → Verificare înainte de predare (4-Prod/Predare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 5 AND s.sort_order = 3 AND p.name = 'Verificare înainte de predare'
) WHERE id = 'f2b88e1e-e1c3-4dc2-ade2-8672ace088db' AND assigned_post_id IS NULL;

-- 33. Ugyvedek → Juridic (7-Admin/Cazuri sp)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 2 AND p.name = 'Juridic'
) WHERE id = '5a0d6340-f11b-4066-9714-07cf4a5b7707' AND assigned_post_id IS NULL;

-- 34. Shopping list → Funcționare birou (5-Cal/Performanță)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 3 AND p.name = 'Funcționare birou'
) WHERE id = '1fb849f5-1200-45cd-bcb3-b2d054d79028' AND assigned_post_id IS NULL;

-- 35. AACR/CNC → Juridic (7-Admin/Cazuri sp)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 2 AND p.name = 'Juridic'
) WHERE id = '687eb35d-8524-47cb-a403-92db418611cd' AND assigned_post_id IS NULL;
