-- Migration 059: Assign existing tasks to posts (assigned_post_id)
-- Each task gets mapped to a specific post based on Robert's manual assignment
-- Post lookup: JOIN sections s ON posts.section_id = s.id JOIN departments d ON s.department_id = d.id
-- dept sort_order: 1=Administrativ, 2=HR, 3=Vanzari, 4=Financiar, 5=Productie, 6=Calitate, 7=Extindere

-- Helper function to find post ID by dept_sort, sec_sort, post_name
-- We use inline subqueries for each UPDATE

-- ============================================================
-- RÓBERT LEDÉNYI tasks (5)
-- ============================================================

-- 1. "Eljutni a fehervari prefektushoz" → Politicieni cu funcții înalte (6-Extindere/Relații noi)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 7 AND s.sort_order = 1 AND p.name = 'Politicieni cu funcții înalte - Asociere de imagine'
) WHERE id = '1248354e-808d-4707-9d88-525854d3bcce';

-- 2. "Kikuldeni emailt az osszes podcastosnak" → Promovare (6-Extindere/Promovare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 7 AND s.sort_order = 3 AND p.name = 'Promovare'
) WHERE id = 'a35dce17-075e-48eb-9881-b5a9d6c44844';

-- 3. "Arabellat megkerdezni" → Angajare (1-HR/HR)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 2 AND s.sort_order = 1 AND p.name = 'Angajare'
) WHERE id = '4c45edc9-01a9-4cf6-9728-5a7cf40da68c';

-- 4. "Irni spiroiunak" → Strategie (7-Administrativ/Director general)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 3 AND p.name = 'Strategie'
) WHERE id = 'd01d039f-301d-41e7-bb8d-54c7fca60dce';

-- 5. "sms kuldo szoft" → Strategie (7-Administrativ/Director general)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 3 AND p.name = 'Strategie'
) WHERE id = '53592633-843d-467d-b64e-d6c369e734a8';

-- ============================================================
-- MÁRIA VASZI tasks (22)
-- ============================================================

-- 6. "David mikor megy terepre" → Programare proiecte (4-Producție/Pregătire)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 5 AND s.sort_order = 1 AND p.name = 'Programare proiecte'
) WHERE id = '07a98e72-2b4a-41b1-b6df-451135940d65';

-- 7. "Dgitalizare PUG csavo" → Strategie (7-Administrativ/Director general)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 3 AND p.name = 'Strategie'
) WHERE id = 'da58a47e-bded-4aa8-88f2-c147d908c4d3';

-- 8. "Bonusztablazat" → Salarii, Comision, Deconturi (3-Financiar/Plăți)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 4 AND s.sort_order = 2 AND p.name = 'Salarii, Comision, Deconturi'
) WHERE id = '1d7ccce2-5229-48cd-a492-613b693a6465';

-- 9. "Aiud - RSV" → Verificare date (4-Producție/Realizare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 5 AND s.sort_order = 2 AND p.name = 'Verificare date'
) WHERE id = '38e90472-4eb3-4399-9adf-3d69d918cc5a';

-- 10. "Syscad jelszo csere" → Funcționare softuri (5-Calitate/Verificare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 1 AND p.name = 'Funcționare softuri'
) WHERE id = 'e18ebe5e-4a44-4478-9e82-a64d00c0dd5d';

-- 11. "Tudor szerződés" → Contracte (7-Administrativ/Cazuri speciale)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 2 AND p.name = 'Contracte'
) WHERE id = 'd547e16d-8806-4163-b9c6-550c13d8f6dd';

-- 12. "Tudor+Istvan webGIS" → Strategie (7-Administrativ/Director general)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 3 AND p.name = 'Strategie'
) WHERE id = 'bd46a422-505e-4f47-a6b2-3655a13515e7';

-- 13. "WC javitas" → Administrare (7-Administrativ/Resurse)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 1 AND p.name = 'Administrare'
) WHERE id = '41cd17ac-ff4e-4383-b1ad-c84e339e58c0';

-- 14. "3D-t leadni Magurele" → Predarea proiectului (4-Producție/Predare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 5 AND s.sort_order = 3 AND p.name = 'Predarea proiectului'
) WHERE id = 'ae8f5357-135b-4c1c-b967-9674cc6f59e1';

-- 15. "GPR munkafolyamat" → SOP (5-Calitate/Performanță)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 3 AND p.name = 'SOP'
) WHERE id = 'f4f190ed-9fea-471a-bca3-cf2af166c217';

-- 16. "CNC első projekt" → Cazuri speciale (7-Administrativ/Cazuri speciale)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 2 AND p.name = 'Cazuri speciale'
) WHERE id = '1685a533-8aa6-4d5e-814e-c40a749f7709';

-- 17. "Miercurea Sibiului Cartinspect" → Proiecte înainte de predare (5-Calitate/Verificare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 1 AND p.name = 'Proiecte înainte de predare'
) WHERE id = 'af27bae5-b570-4196-9b4c-96ea029ad69b';

-- 18. "Consultanta szerzodest Adi" → Contracte (7-Administrativ/Cazuri speciale)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 2 AND p.name = 'Contracte'
) WHERE id = '37e572fe-4d2a-48b9-a980-84d491cd5900';

-- 19. "ANCPI clarificari" → Cazuri speciale (7-Administrativ/Cazuri speciale)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 2 AND p.name = 'Cazuri speciale'
) WHERE id = 'db786f16-3237-4073-8f4d-e8cad1e2c910';

-- 22. "Arobs GPS-ek" → Funcționare softuri (5-Calitate/Verificare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 1 AND p.name = 'Funcționare softuri'
) WHERE id = '3016a2dd-a9e6-4983-94da-b82211a3be47';

-- 28. "ReScan kapcsolat" → Strategie (7-Administrativ/Director general)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 3 AND p.name = 'Strategie'
) WHERE id = 'cd3aab55-2c77-4cf0-b69a-2fb8f4ed8b9c';

-- 29. "Indiaiakkal kapcsolat" → Strategie (7-Administrativ/Director general)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 3 AND p.name = 'Strategie'
) WHERE id = 'f9b48eb1-8f6e-4e79-9b2f-6bedf4b68597';

-- 30. "Tulcea javitasok" → Proiecte înainte de predare (5-Calitate/Verificare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 1 AND p.name = 'Proiecte înainte de predare'
) WHERE id = '67ee262b-9f06-48a0-adb2-27b269f3a79a';

-- 31. "Plotter leteszteni" → Hardware (5-Calitate/Performanță)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 3 AND p.name = 'Hardware'
) WHERE id = '5d8fc616-1684-4f36-87e5-fc5d22e97c3a';

-- 32. "Cristian RSV" → Verificare înainte de predare (4-Producție/Predare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 5 AND s.sort_order = 3 AND p.name = 'Verificare înainte de predare'
) WHERE id = 'f2b88e1e-e1c3-4dc2-ade2-8672ace088db';

-- 33. "Ugyvedek megbeszelni" → Juridic (7-Administrativ/Cazuri speciale)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 2 AND p.name = 'Juridic'
) WHERE id = '5a0d6340-f11b-4066-9714-07cf4a5b7707';

-- 34. "Shopping list" → Funcționare birou (5-Calitate/Performanță)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 3 AND p.name = 'Funcționare birou'
) WHERE id = '1fb849f5-1200-45cd-bcb3-b2d054d79028';

-- 35. "Minden termek AACR/CNC" → Juridic (7-Administrativ/Cazuri speciale)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 2 AND p.name = 'Juridic'
) WHERE id = '687eb35d-8524-47cb-a403-92db418611cd';

-- ============================================================
-- ALISA MARINCAȘ tasks (6)
-- ============================================================

-- 20. "Dacia prize de casa" → Mașini (5-Calitate/Examinare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 2 AND p.name = 'Mașini'
) WHERE id = '54347deb-1ef6-4ab8-8362-7ce3d1f558e6';

-- 21. "Inspectie flota vineri Productie" → Mașini (5-Calitate/Examinare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 2 AND p.name = 'Mașini'
) WHERE id = 'f1b5e9a9-cf21-4021-90fb-07ba1b38921e';

-- 23. "Schimb anvelope vara" → Mașini (5-Calitate/Examinare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 2 AND p.name = 'Mașini'
) WHERE id = '79500a41-2743-4356-9fa3-c4edac9f33ce';

-- 24. "Schimb anvelope iarna" → Mașini (5-Calitate/Examinare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 2 AND p.name = 'Mașini'
) WHERE id = '225273e1-4f50-4f8f-a989-fb5d1031db4f';

-- 25. "Inspectie flota luni Vanzari" → Mașini (5-Calitate/Examinare)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 6 AND s.sort_order = 2 AND p.name = 'Mașini'
) WHERE id = '4d2731c5-d517-4116-a2eb-4b64c0ab2912';

-- 26. "Programare newsletter" → Promovare (2-Vânzări/Publicații)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 3 AND s.sort_order = 2 AND p.name = 'Promovare'
) WHERE id = '05f7c28c-6bb2-404b-a14f-9579a3db4df6';

-- ============================================================
-- EMŐKE LEDÉNYI tasks (1)
-- ============================================================

-- 27. "Hivd fel ING-s mancit" → Strategie financiară (7-Administrativ/Director general)
UPDATE tasks SET assigned_post_id = (
  SELECT p.id FROM posts p JOIN sections s ON p.section_id = s.id JOIN departments d ON s.department_id = d.id
  WHERE d.sort_order = 1 AND s.sort_order = 3 AND p.name = 'Strategie financiară'
) WHERE id = 'cb5c15f5-515c-4913-8f41-4d7ad0b367c7';
