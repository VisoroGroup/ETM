-- Migration 055: Create posts table (actual positions within sections)
-- Structure: Department → Section → Post
-- Each post has a user assigned (1 post = 1 user rule, first listed person is primary)
-- Posts without a user in ETM yet get NULL

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_section_id ON posts(section_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_is_active ON posts(is_active);

-- Helper aliases for readability:
-- dept(N) = department with sort_order=N
-- sec(D,S) = section with dept sort_order=D, section sort_order=S
-- robert = ledenyi.robert@visoro-global.ro
-- emoke = ledenyi.emoke@visoro-global.ro
-- maria = maria.vaszi (LIKE match)

-- ============================================================
-- 7 - ADMINISTRATIV (dept sort=1)
-- ============================================================

-- Section: Resurse (dept=1, sec=1)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Tech',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 1 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Urmărirea precisă a tehnologiei companiei.',
    1),
  ('Directive de funcționare',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 1 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Respectarea directivelor de funcționare.',
    2),
  ('Administrare',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 1 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Întreținerea spațiilor organizației.',
    3);

-- Section: Cazuri speciale (dept=1, sec=2)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Cazuri speciale',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 1 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Firma să fie în siguranță dacă sunt atacuri externe, ține legătura cu mediul instituțional.',
    1),
  ('Juridic',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 1 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Toate aspectele juridice ale firmei sunt în regulă.',
    2),
  ('Contracte',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 1 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Toate contractele, care ies, sau intră în firmă să aibă formă legală că și baza.',
    3);

-- Section: Director general (dept=1, sec=3)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Director executiv',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 1 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    NULL,
    1),
  ('Strategie',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 1 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Se ocupă de strategia firmei.',
    2),
  ('Strategie financiară',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 1 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Firma să fie solvabila.',
    3),
  ('Prețuri produse',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 1 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Prețurile sunt la zi și reale.',
    4),
  ('Strategie de extindere',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 1 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Responsabil pentru ca compania să fie viabilă, productivă și în expansiune.',
    5),
  ('Salarii',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 1 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Colegii să fie mulțumiți de salariile pe care le primesc în funcție de performanțele lor.',
    6),
  ('Aprobare achiziții',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 1 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Aprobă orice achiziție nouă.',
    7);

-- ============================================================
-- 1 - HR - COMUNICARE (dept sort=2)
-- ============================================================

-- Section: HR (dept=2, sec=1)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Tabel de organizare',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 2 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Monitorizează, compară harta Visoro cu realitatea, notează fiecare modificare și se asigură că tabelul de organizare reflectă în totalitate structura societății.',
    1),
  ('Angajare',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 2 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Angajează colegi potriviți.',
    2),
  ('Posturi',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 2 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Se asigură că toți angajații (noi sau existenți) au fost instruiți și lucrează conform procedurilor de lucru.',
    3),
  ('Control regulament',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 2 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Se asigură că toate regulamentele organizației sunt respectate.',
    4);

-- Section: Comunicare (dept=2, sec=2)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Comunicare externă',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 2 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Ține legătura cu clienții și partenerii firmei, se asigură că toate comunicările noastre exterioare să decurgă perfect. Trimitere: contracte, acte adiționale, comunicare stadiu contract.',
    1),
  ('Comunicare internă',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 2 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Controlează, întreține sistemul de comunicare intern (centrul de comunicare de pe hol cu tăvițe e actualizat), redirecționează emailurile primite pe office către persoanele de interes. Informează toată firma despre stadiul fiecărui proiect.',
    2),
  ('Arhivă',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 2 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Deține toate documentele originale ale societății (CUI, protocol de colaborare, etc.).',
    3),
  ('Bază de date colaboratori',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 2 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Se ocupă să întrețină baza de date cu toți colaboratorii firmei.',
    4),
  ('Ședințe',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 2 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Zilnice, săptămânale, lunare, trimestriale, anuale, team building.',
    5);

-- Section: Statistici (dept=2, sec=3)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Statistici',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 2 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Realizarea, desenarea, afișarea statisticilor respectiv verificarea și examinarea lor. Stabilește formula stării de funcționare și se asigură că pașii formulei sunt urmați.',
    1),
  ('Formule de funcționare',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 2 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Se asigură că pe baza statisticilor sunt realizate formulele de funcționare.',
    2);

-- ============================================================
-- 2 - VÂNZĂRI (dept sort=3)
-- ============================================================

-- Section: Marketing (dept=3, sec=1)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Chestionare',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 3 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Pregătirea unui chestionar pentru a identifica nevoile clienților, respectiv evaluarea lor.',
    1),
  ('Campanii de promovare',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 3 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Email marketing + SMS.',
    2),
  ('Bază de date clienți',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 3 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Întreținerea la perfecțiune a bazei de date de clienți existenți (denumire client, adresă, număr de telefon de la oamenii de legatură, zile de naștere). Se ocupă să țină baza de date cu clienții foarte vie.',
    3),
  ('Arhivă design',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 3 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Deține toate elementele de design în format vectorial (mape, cărți de vizită, oferte, logo), respectiv la nevoie le multiplică și le folosește.',
    4);

-- Section: Publicații (dept=3, sec=2)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Promovare',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 3 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Publică toate materialele primite pe toate canalele de comunicare (Facebook, Instagram, LinkedIn) + Newsletters + SMS.',
    1);

-- Section: Vânzări (dept=3, sec=3)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Vânzări',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 3 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Produsele societății sunt vândute într-un număr mare.',
    1),
  ('Clienți VIP',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 3 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Meținerea unei legături strânse cu clienții cei mai importanți.',
    2);

-- ============================================================
-- 3 - FINANCIAR (dept sort=4)
-- ============================================================

-- Section: Facturare - Încasare (dept=4, sec=1)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Facturare',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 4 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Facturarea conform contractului pe baza cerințelor departamentului de producție și a procesului verbal semnat, într-un timp cât mai scurt. Se asigură că fiecare factură a fost trimisă și descărcată prin portal e-facturi. Înregistrează facturile în baza de date.',
    1),
  ('Încasare',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 4 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Verificarea sumelor încasate, cât și realizarea listei cu facturile neîncasate. Contactează și menține o legătură strânsă cu departamentul financiar al clienților în vederea efectuării încasărilor.',
    2);

-- Section: Plăți (dept=4, sec=2)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Achiziții',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 4 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Se asigură că solicitările de achiziții aprobate sunt cumpărate și puse la dispoziția solicitantului (cere oferte de preț actualizate le cumpără, produsele ajung la destinație).',
    1),
  ('Salarii, Comision, Deconturi',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 4 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Se ocupă de adunarea documentelor financiare și realizarea deconturilor. Calcularea comisioanelor pe baza statisticilor. Trimiterea documentelor necesare pentru întocmirea statului de plată. Plata salariilor la timp.',
    2),
  ('Plăți',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 4 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Pe baza planului bugetar alocă banii în conturi și plătește facturile.',
    3);

-- Section: Evidențe financiare (dept=4, sec=3)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Bază de date - Documente financiare',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 4 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Toate documentele financiare (bonuri, chitanțe, facturi) sunt adunate, verificate și înregistrate în baza de date.',
    1),
  ('Inventar',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 4 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Realizarea evidenței financiare a firmei, evidența monetară și a obiectelor de inventar.',
    2),
  ('Întreținere patrimoniu',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 4 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Întreținerea permanentă a tuturor echipamentelor din proprietatea firmei, rezolvarea reparațiilor când este nevoie (mașini, birou, uniforme, laptopuri, telefoane).',
    3),
  ('Consumabile',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 4 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Inventarierea consumabilelor, pentru ca tot timpul să fie destul din ce este nevoie, pregătirea listei de necesități.',
    4),
  ('Contabilitate',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 4 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Contabilitatea primară realizată la timp și cu precizie, ține legătura cu firma care face contabilitatea. Verifică lunar situația noastră și cea a contabilei.',
    5);

-- ============================================================
-- 4 - PRODUCȚIE (dept sort=5)
-- ============================================================

-- Section: Pregătire (dept=5, sec=1)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Analiza informații',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 5 AND s.sort_order = 1),
    NULL,
    'După semnarea contractului face o evaluare a proiectului și o listă de necesități pentru a începe programarea proiectului. Ține legătura cu clienții pentru obținerea documentelor necesare realizării proiectului.',
    1),
  ('Programare proiecte',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 5 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Realizarea programului anual/lunar/săptămânal.',
    2),
  ('Programare vizită clienți',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 5 AND s.sort_order = 1),
    NULL,
    'Informare clienți.',
    3);

-- Section: Realizare (dept=5, sec=2)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Colectare date',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 5 AND s.sort_order = 2),
    NULL,
    '10 metode.',
    1),
  ('Verificare date',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 5 AND s.sort_order = 2),
    NULL,
    NULL,
    2),
  ('GIS',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 5 AND s.sort_order = 2),
    NULL,
    'Trasarea străzilor, completarea atributelor, efectuarea renumerotării, dacă este cazul.',
    3),
  ('Verificarea datelor',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 5 AND s.sort_order = 2),
    NULL,
    'Verificarea corectitudinii datelor.',
    4),
  ('Obținere HCL',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 5 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    NULL,
    5),
  ('Pregătire introducere RENNS',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 5 AND s.sort_order = 2),
    NULL,
    'Se asigură că are toate informațiile disponibile înainte de începerea introducerii în R.E.N.N.S., varianta finală de GIS este încărcată pe drive, sunt conturi, verifică HCL-ul. Pregătește checklistul.',
    6),
  ('Introducere în R.E.N.N.S.',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 5 AND s.sort_order = 2),
    NULL,
    NULL,
    7);

-- Section: Predare (dept=5, sec=3)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Verificare înainte de predare',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 5 AND s.sort_order = 3),
    NULL,
    'Checklist R.E.N.N.S.',
    1),
  ('Predarea proiectului',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 5 AND s.sort_order = 3),
    NULL,
    NULL,
    2),
  ('Predare date suplimentare cu PV semnat',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 5 AND s.sort_order = 3),
    NULL,
    'GIS + Anexe + în R.E.N.N.S. cum și unde sunt + toate aspectele pe care trebuie să știe primăria (Trimis HCL la Evidența Populației, Date de logare R.E.N.N.S. la ANCPI, pe ce calculatoare a fost instalat GIS-ul final).',
    3);

-- ============================================================
-- 5 - CALITATE ȘI CALIFICARE (dept sort=6)
-- ============================================================

-- Section: Verificare (dept=6, sec=1)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Proiecte înainte de predare',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 6 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Pe bază de checklist. Verificare produse, ca să fie în conformitate cu standardele firmei.',
    1),
  ('Feedback de le clienți despre colegi',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 6 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Adună și îndosariază feedbackurile primite (de la clienți legate de produse și colegi, respectiv feedbackuri de la colegi despre clienți și organizație).',
    2),
  ('Funcționare softuri',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 6 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Minden létező szoftver amit használunk, legyen az az email rendszer, AI feliratkozások, termeléshez szükséges szoftok — minden működjön, figyelve legyen rá, hogy ne járjon le a subscription, hogy mindenki tudja nyugodtan csinálni a dolgát.',
    3);

-- Section: Examinare (dept=6, sec=2)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Verificare cunoștințe',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 6 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Se fac teste periodice pentru verificarea cunoștințelor legate de procedurile interne și munca efectivă. Rezultatul testelor se completează în 2 exemplare, unul se dă angajatului și unul se îndosariază în dosarul dedicat angajatului.',
    1),
  ('Protecția muncii',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 6 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Ține legătura cu firma de PSI (protecție și securitate în muncă), se asigură că totul este actualizat. Furnizează datele în timp despre orice fluxul angajaților, de exemplu angajarea noilor colegi.',
    2),
  ('Medicina muncii',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 6 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Ține evidență clară despre fișele de aptitudini, anunță și programează colegii la analizele anuale de medicina muncii.',
    3),
  ('Instruire',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 6 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'În funcție de rezultatele testelor și necesitățile organizației caută și organizează cursuri de specialitate.',
    4),
  ('Mașini',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 6 AND s.sort_order = 2),
    NULL,
    'Leellenőrizni minden héten a kocsikat, hogy tiszták-e, hogy hibásak-e. Szervizbe vitetni őket, amikor kell, és bármi ami a kocsi flottához tartozik.',
    5);

-- Section: Performanță (dept=6, sec=3)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Examinare feedback + corectare',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 6 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.emoke@visoro-global.ro' AND is_active = true LIMIT 1),
    'Analizează feedbackurile primite, căutând cauza succesului sau identificarea greșelii. Pe baza analizei pregătește o propunere de recompensare și/sau modificarea, completarea directivelor de funcționare.',
    1),
  ('SOP',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 6 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Minden egyes létező folyamatról SOP-kat ír a cégben, legyen az iroda működés, termék gyártás, termék leadás — mindenre kell legyen SOP.',
    2),
  ('Hardware',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 6 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Minden hardware-t tartson működésben és vigyázzon rá, hogy működjenek és mindig legyenek toppon.',
    3),
  ('Funcționare birou',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 6 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Biztosítja, hogy az irodában mindig van kávé, tej, papír, toll, takarítva van, karban van tartva az iroda, maga az egész iroda optimálisan működik.',
    4);

-- ============================================================
-- 6 - EXTINDERE (dept sort=7)
-- ============================================================

-- Section: Relații noi (dept=7, sec=1)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Evenimente unde sunt prezenți primarii',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 7 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Se ocupă ca la fiecare manifestare posibilă unde sunt primari să fie prezentă și firma, într-un fel sau altul. Fie vorba de GAL, ACoR, ADI, sau orice altă adunare.',
    1),
  ('Politicieni cu funcții înalte - Asociere de imagine',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 7 AND s.sort_order = 1),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    NULL,
    2);

-- Section: Extindere (dept=7, sec=2)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Bază de date clienți',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 7 AND s.sort_order = 2),
    (SELECT id FROM users WHERE LOWER(email) = 'ledenyi.robert@visoro-global.ro' AND is_active = true LIMIT 1),
    'Se ocupă să întrețină și să mărească baza de date cu potențialii clienți calificați.',
    1);

-- Section: Promovare (dept=7, sec=3)
INSERT INTO posts (name, section_id, user_id, description, sort_order) VALUES
  ('Promovare',
    (SELECT s.id FROM sections s JOIN departments d ON s.department_id = d.id WHERE d.sort_order = 7 AND s.sort_order = 3),
    (SELECT id FROM users WHERE LOWER(email) LIKE '%maria.vaszi%' AND is_active = true LIMIT 1),
    'Este responsabil să promoveze la cât mai mulți oameni, prin cât mai multe canale, cât de profesioniști suntem.',
    1);
