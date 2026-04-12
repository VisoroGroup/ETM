# ETM Átalakítás — Teljes Terv és Kontextus

## Ki a megrendelő?

- **Robert (CEO, Visoro Global SRL)** — nem fejlesztő, zero coding experience
- Minden fejlesztés AI-assisted prompts-al történik (vibe-coding)
- Robert magyarul és románul kommunikál
- A fejlesztést mindig jóvá kell hagyatni mielőtt építünk

## AGENTS.md szabályok (mindig be kell tartani!)

1. Never delete or overwrite existing functionality without explicit confirmation
2. Before making changes, briefly state what you will change and what it will affect
3. Before starting any task, ask clarifying questions to be 100% sure
4. Keep the codebase simple
5. Integrate into existing structure
6. Always preserve existing data — never drop tables or clear data without approval
7. After completing any change, test it yourself before reporting done
8. Never push to production without confirming with Robert

---

## Mi az ETM jelenleg?

### Tech Stack
- **Frontend:** React 19 + TypeScript + Tailwind CSS v4 + Vite
- **Backend:** Express.js + TypeScript
- **DB:** PostgreSQL 15 (Railway managed)
- **Auth:** Microsoft Entra ID / Azure AD (OAuth 2.0 + MSAL) + JWT (24h)
- **Deploy:** Railway + Docker multi-stage builds
- **Repo:** https://github.com/VisoroGroup/ETM

### Jelenlegi adatbázis táblák
- users, tasks, subtasks, task_comments, task_attachments, task_alerts
- task_status_changes, task_due_date_changes, task_checklist_items, task_dependencies
- activity_log, recurring_tasks, email_logs, notifications
- payments, payment_comments, payment_activity_log, payment_reminders
- webhook_subscriptions, webhook_deliveries

### Jelenlegi role-ok
- superadmin, admin, manager, user

### Jelenlegi department-ek (enum, NEM tábla!)
- departament_1: Comunicare si HR (Yellow)
- departament_2: Vanzari (Purple)
- departament_3: Financiar (Red)
- departament_4: Productie (Green)
- departament_5: Calitate (Gray)
- departament_6: Extindere (Orange)
- departament_7: Administrativ (Blue)

### Jelenlegi Sarcini oldal
- Flat user lista: userek és alattuk a taskjaik
- Nincs szervezeti struktúra, nincs hierarchia
- Lista + Kanban nézet
- Szűrők: Caută, Sarcinile mele, Filtre

---

## Mi az LRH Flow System?

Az LRH Flow egy **L. Ron Hubbard szervezeti rendszer alapú feladatkezelő** ami a Visoro Global SRL számára készült. A lényegi funkciók amit át kell építeni az ETM-be:

### Szervezeti struktúra
- **7 Department** (sorrend: 7, 1, 2, 3, 4, 5, 6)
- **Posztok** (pozíciók) department-eken belül
- **1 poszt = 1 user** (mindig!)
- Task = poszthoz rendelve (nem userhez!)

### Policies (Directive de funcționare)
- 3 scope: COMPANY / DEPARTMENT / POST
- Feltöltött HTML dokumentumok (standard Visoro formátum)
- Sorszámozottak (nr. 1, 2, 3...)

---

## A TERV — Mit kell építeni?

### A Sarcini oldal teljes átalakítása

A jelenlegi flat user-lista helyett **szervezeti struktúra alapú nézet**:

```
┌─────────────────────────────────────────────────────────────────┐
│ ═══════════════════════════════════════════════════════════════  │
│  "O companie stabilă și în creștere continuă, unde             │
│   angajații ating obiectivele stabilite..."                     │
│  (cég főcélja — MINDEN oldalon megjelenik felül)               │
│ ═══════════════════════════════════════════════════════════════  │
│                                                                 │
│  Sarcini                          Listă | Kanban | + Task nou   │
│  Caută...    Sarcinile mele    Filtre                           │
│                                                                 │
│  Directive la nivel de companie (2)             [Deschide]      │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │  7 - Administrativ                                        │   │
│ │  Responsabil: Róbert LEDÉNYI          [Editare] [▼]       │   │
│ │                                                            │   │
│ │   Resurse → Róbert LEDÉNYI     3 task | 0 dir  [gear]     │   │
│ │     TECH · Directive · Administrare                        │   │
│ │     ┌─────────────────────────────────────────────┐        │   │
│ │     │  Pregătirea raportului lunar    12 apr       │        │   │
│ │     │  Actualizare contracte          15 apr       │        │   │
│ │     │  Verificare backup-uri          10 apr       │        │   │
│ │     └─────────────────────────────────────────────┘        │   │
│ │                                                            │   │
│ │   Cazuri speciale → Róbert LEDÉNYI  0 task | 0 dir [gear]  │   │
│ │     Cazuri speciale · Juridic · Contracte                  │   │
│ │                                                            │   │
│ │   Director general → Róbert LEDÉNYI 2 task | 1 dir [gear]  │   │
│ │     Strategie · Salarii · Aprobare achiziții · ...         │   │
│ │                                                            │   │
│ │  PFV: O firmă solventă și în creștere continuă!            │   │
│ │  Statistică: Cash & Bill                                   │   │
│ │  Directive departament (1)                [Deschide]        │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│  1 - HR - Comunicare             Resp: E. Ledényi    [▶]       │
│  2 - Vânzări                     Resp: R. Ledényi    [▶]       │
│  3 - Financiar                   Resp: E. Ledényi    [▶]       │
│  4 - Producție                   Resp: E. Ledényi    [▶]       │
│  5 - Calitate și calificare      Resp: E. Ledényi    [▶]       │
│  6 - Extindere                   Resp: R. Ledényi    [▶]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Adatbázis változások

### Új táblák

```sql
-- Departmentek (a jelenlegi department_label enum-ot váltja ki)
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,           -- "7 - Administrativ"
  sort_order INTEGER NOT NULL,     -- 7,1,2,3,4,5,6 sorrend
  color VARCHAR NOT NULL,          -- "#3B82F6" (jelenlegi ETM színek)
  head_user_id UUID REFERENCES users(id),  -- department felelős
  pfv TEXT,                        -- "O firmă solventă și în creștere continuă!"
  statistic_name TEXT,             -- "Cash & Bill"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posztok (department-en belül)
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,           -- "Resurse", "Cazuri speciale"
  department_id UUID NOT NULL REFERENCES departments(id),
  user_id UUID REFERENCES users(id),  -- ki tölti be (NULL = vacant)
  pfv TEXT,                        -- poszt PFV-je
  job_description TEXT,            -- feltölthető leírás (HTML vagy plain text)
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Poszt felelősségek (a poszt alatti "TECH", "JURIDIC" stb.)
CREATE TABLE post_responsibilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,          -- "TECH", "JURIDIC"
  description TEXT,                -- részletes leírás
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policies (feltöltött HTML direktívák)
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  directive_number INTEGER,        -- sorszám (nr. 1, 2, 3...)
  title VARCHAR NOT NULL,          -- "Valoarea minimă obligatorie..."
  date DATE NOT NULL,              -- a direktíva dátuma
  content_html TEXT NOT NULL,      -- a feltöltött HTML tartalom
  scope VARCHAR NOT NULL,          -- 'COMPANY' | 'DEPARTMENT' | 'POST'
  created_by_id UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policy → Department kapcsolat
CREATE TABLE policy_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policy → Post kapcsolat
CREATE TABLE policy_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Meglévő táblák módosítása

```sql
-- tasks táblához új mező
ALTER TABLE tasks ADD COLUMN assigned_post_id UUID REFERENCES posts(id);
-- Az assigned_to (user FK) megmarad migrációs célból,
-- de az új rendszerben a post.user_id-ból származik
```

### Settings bővítés

```sql
-- A cég főcélja, ami minden oldal tetején megjelenik
INSERT INTO settings (key, value) VALUES ('company_main_goal', '"O companie stabilă și în creștere continuă..."');
```

---

## API végpontok

```
-- Departments --
GET    /api/departments              — lista sort_order szerint
POST   /api/departments              — új (superadmin)
PUT    /api/departments/:id          — módosítás (superadmin)
DELETE /api/departments/:id          — soft delete (superadmin)

-- Posts --
GET    /api/departments/:id/posts    — posztok egy dept-ben
POST   /api/departments/:id/posts   — új poszt (superadmin)
PUT    /api/posts/:id                — módosítás (superadmin)
DELETE /api/posts/:id                — törlés (superadmin)

-- Post Responsibilities --
GET    /api/posts/:id/responsibilities
POST   /api/posts/:id/responsibilities
PUT    /api/responsibilities/:id
DELETE /api/responsibilities/:id

-- Policies --
GET    /api/policies                 — összes (scope szűrés)
POST   /api/policies/upload          — HTML fájl feltöltés
PUT    /api/policies/:id             — módosítás
DELETE /api/policies/:id             — törlés
GET    /api/posts/:id/policies       — poszt policy-jai
GET    /api/departments/:id/policies — dept policy-jai

-- Company goal --
GET    /api/settings/company-goal
PUT    /api/settings/company-goal    — superadmin
```

---

## Frontend interakciók részletesen

### Department accordion
- Kattintásra kinyílik → látszanak a posztok, PFV, Statistică
- Összecsukva: department név + szín + felelős + nyíl
- [Editare] (csak superadmin): átnevezés, felelős csere, szín váltás, törlés
- [+ Departament nou] gomb az oldal alján

### Poszt sor
- Poszt neve → User neve | X task | Y directive | [gear]
- Alatta kompaktan: felelősségek pontokkal elválasztva (TECH · Juridic · Contracte)
- Kattintásra kinyílnak a **taskok** (mint most a user sorra kattintva)
- [gear] (csak superadmin):
  - Poszt átnevezése
  - User hozzárendelése / cseréje / törlése (dropdown a userekből)
  - Felelősségek szerkesztése (hozzáadás, törlés, átnevezés)
  - Job description feltöltése/szerkesztése
  - PFV szerkesztése
  - Poszt törlése
- [+ Post nou] gomb a department-en belül

### Policy drawer (kattintásra nyílik)
- Cég szintű / Department szintű / Poszt szintű — külön füleken
- Lista: sorszám + dátum + cím
- Kattintásra: teljes renderelt HTML (ahogy a feltöltött dokumentumban van)
- [+ Încarcă directivă] gomb → HTML fájl feltöltés
  - Scope választás: Companie / Department / Post
  - Ha department/post: melyik(ek)hez tartozik
- Ha 40+ policy van: lista nézet scroll-al a drawer-ben (nem foglalja el az egész oldalt)

### Task létrehozás ("+ Task nou")
- Először: melyik department → melyik poszt → automatikusan kapja a poszt userének email-címét
- A task a **poszthoz** van rendelve
- Ha a poszton user csere történik → a task marad, de az értesítések az új usernek mennek

### Cég főcélja (felső banner)
- MINDEN oldalon látszik (Sarcini, Dashboard, Financiar, stb.)
- Superadmin szerkesztheti a Settings-ben
- Elegáns, kompakt megjelenítés

### Task → Poszt logika (FONTOS!)
- Task = poszthoz rendelve (assigned_post_id)
- A poszt aktuális user-ének email-címére mennek az értesítések
- Ha valaki kommentál a taskhoz → poszt userének emailjére megy
- Ha task "terminat" lesz → poszt userének emailjére megy
- Ha új task rendelve a poszthoz → poszt userének emailjére megy
- Ha user csere a poszton → MINDEN értesítés az ÚJ user emailjére megy ettől kezdve
- A régi user többé nem kap semmit az adott posztról

---

## Migrációs lépések

1. Létrehozni a `departments` táblát a 7 departmenttal (7,1,2,3,4,5,6 sorrendben)
2. Létrehozni a `posts` táblát — kezdetben a jelenlegi userek alapján
3. A meglévő taskok `assigned_to` értékét átmásolni az `assigned_post_id`-ba
4. Policies tábla + kapcsoló táblák létrehozása
5. Frontend átalakítás

---

## A 7 Department és posztjaik (szervezési tábla alapján)

### 7 - Administrativ | Felelős: Róbert LEDÉNYI | Szín: Kék
| Poszt | User | Felelősségek |
|---|---|---|
| Resurse | Róbert LEDÉNYI | Tech, Directive de funcționare, Administrare |
| Cazuri speciale | Róbert LEDÉNYI | Cazuri speciale, Juridic, Contracte |
| Director general | Róbert LEDÉNYI | Director executiv, Strategie, Strategie financiară, Prețuri produse, Strategie de extindere, Salarii, Aprobare achiziții |
| **PFV dept:** | *O firmă solventă și în creștere continuă!* | **Statistică:** Cash & Bill |

### 1 - HR - Comunicare | Felelős: Emőke LEDÉNYI | Szín: Sárga
| Poszt | User | Felelősségek |
|---|---|---|
| HR | Emőke LEDÉNYI | Tabel de organizare, Angajare, Posturi, Control regulament |
| Comunicare | Emőke LEDÉNYI | Comunicare externă, Comunicare internă, Arhivă, Bază de date colaboratori, Ședințe |
| Statistici | Emőke LEDÉNYI | Statistici, Formule de funcționare |
| **PFV dept:** | *O organizație cu fundație solidă, cu colegi puși pe post, care sunt trainuiți și lucrează foarte eficient pe bază de statistici.* | **Statistică:** Nr. statistici în creștere vs nr. total statistici |

### 2 - Vânzări | Felelős: Róbert LEDÉNYI | Szín: Lila
| Poszt | User | Felelősségek |
|---|---|---|
| Marketing | Mária VASZI | Chestionare, Campanii de promovare, Bază de date clienți, Archivă design |
| Publicații | Mária VASZI | Promovare |
| Vânzări | Róbert LEDÉNYI | Vânzări, Clienți VIP |
| **PFV dept:** | *Vânzări realizate în atâta cantitate, încât încasările sunt mai mari decât cheltuielile plus banii puși deoparte. Produse de calitate renumite.* | **Statistică:** Valoarea contractelor încheiate |

### 3 - Financiar | Felelős: Emőke LEDÉNYI | Szín: Piros
| Poszt | User | Felelősségek |
|---|---|---|
| Facturare - Încasare | Emőke LEDÉNYI | Facturare, Încasare |
| Plăți | Emőke LEDÉNYI | Achiziții, Salarii/Comision/Deconturi, Plăți |
| Evidențe financiare | Emőke LEDÉNYI | Bază de date documente financiare, Inventar, Întreținere patrimoniu, Consumabile, Contabilitate |
| **PFV dept:** | *Patrimoniul firmei și banii sunt îngrijite în siguranță maximă.* | **Statistică:** Facturi achitate la timp vs facturi neachitate la termen, cantitativ și valoric |

### 4 - Producție | Felelős: Emőke LEDÉNYI | Szín: Zöld
| Poszt | User | Felelősségek |
|---|---|---|
| Pregătire | Emőke LEDÉNYI | Analiza informații, Programare proiecte, Programare vizită clienți |
| Realizare | Lorin BĂTINĂȘ | Colectare date, Verificare date, GIS, Verificarea datelor, Obținere HCL, Pregătire introducere RENNS, Introducere în R.E.N.N.S. |
| Predare | Emőke LEDÉNYI | Verificare înainte de predare, Predarea proiectului, Predare date suplimentare cu PV semnat |
| **PFV dept:** | *Servicii realizate la scară largă pentru clienți, în timpul, calitatea și cheltuielile promise, cu ajutorul cărora începe punerea în ordine a administrației publice locale.* | **Statistică:** Produse predate cantitativ vs valoric |

### 5 - Calitate și calificare | Felelős: Emőke LEDÉNYI | Szín: Szürke
| Poszt | User | Felelősségek |
|---|---|---|
| Verificare | Emőke LEDÉNYI | Proiecte înainte de predare, Feedback clienți despre colegi |
| Examinare | Emőke LEDÉNYI | Verificare cunoștințe, Protecția muncii, Medicina muncii, Instruire |
| Performanță | Emőke LEDÉNYI | Examinare feedback + corectare |
| **PFV dept:** | *Colegi instruiți, care lucrează eficace cu rezultate foarte bune. O organizație, care oferă servicii de înaltă claitate.* | **Statistică:** Adaos per angajat și încasări per angajat |

### 6 - Extindere | Felelős: Róbert LEDÉNYI | Szín: Narancs
| Poszt | User | Felelősségek |
|---|---|---|
| Relații noi | Róbert LEDÉNYI | Evenimente unde sunt prezenți primarii, Politicieni cu funcții înalte - Asociere de imagine |
| Extindere | Róbert LEDÉNYI | Bază de date clienți |
| Promovare | Mária VASZI | Promovare |
| **PFV dept:** | *Un cerc de clienți potențiali, în constantă creștere și un renume foarte bun la nivel național.* | **Statistică:** Numărul de clienți potențiali noi |

---

## Vezetés (nem department, felettük áll)

- **DIRECTOR GENERAL:** Róbert LEDÉNYI
- **ASISTENT EXECUTIV:** Mária VASZI
- **DIRECTOR EXECUTIV:** Emőke LEDÉNYI

---

## Cég főcélja (minden oldalon megjelenik)

> "O companie stabilă și în creștere rapidă, unde angajații ating obiectivele stabilite și se formează continuu, dezvoltându-se astfel încât creează produse care sunt cu adevărat utile pentru primării. Toate acestea sunt realizate printr-un schimb abundent, iar ca urmare a acestor lucruri, comunitățile în care semnăm contracte pot evolua mai bine, prin introducerea unui strop de etică."

---

## Policy (Directivă) formátum

A policy-k mindig **feltöltött HTML fájlok**. Standard Visoro formátum:

### Header
- "VISORO GLOBAL SRL"
- "Directivă de funcționare Visoro nr. X — DÁTUM"
- Departament: melyik departmenthez szól
- Destinatar: kinek szól (poszt nevek)

### Body szekciók
- "De ce această directivă?" — indoklás
- "Regula de bază" — fő szabály
- "Excepție" — kivétel esetek
- "Ce trebuie să facă echipa" — teendők
- "Raportare și informații" — táblázat
- "Recunoaștem succesele" — pozitív megerősítés

### Formátum
- HTML email formátum (inline CSS)
- Kék header (#1A3A6B) + arany keret (#B8962E) — Visoro brand színek
- Strukturált szekciók
- Sorszámozott (nr. 1, 2, 3...)
- "După ce ai citit emailul te rog să răspunzi acestui email cum că ai citit și ai înțeles!" — olvasási visszaigazolás

### Létező policy fájlok (példák)
- Directiva Visoro 02.03.2026 - Vanzari CRM si Comunicare
- Directiva Visoro 06.03.2026 - Vanzari Programarea Intalnirilor
- Directiva Visoro 09.03.2026 - General Parcare Curte
- Directiva Visoro 16.03.2026 - Vanzari Coordonarea Programarilor si Raportarea Zilnica
- Directiva Visoro 03.04.2026 - Vanzari Valoare Minima Contract
- Directiva Visoro 09.04.2026 - Vanzari Perioada Critica Post-Buget

---

## Jelenlegi userek az ETM-ben

- Róbert LEDÉNYI (6 task)
- Mária VASZI (22 task)
- Alisa MARINCAȘ (6 task)
- Ledényi Emőke (1 task)

Plusz a szervezési táblában:
- Lorin BĂTINĂȘ (Producție - Realizare)
- Ștefan EȘANU (Producție - Realizare)
- István SZŐCS (Producție - Predare)

---

## FONTOS SZABÁLYOK

1. **Csak superadmin** szerkesztheti a szervezeti struktúrát (department, poszt, policy)
2. **1 poszt = 1 user** (mindig, nincs backup user kezelés)
3. **Policy-k feltöltése** — mindig külső HTML fájlt tölt fel Robert, nem a rendszerben írja
4. **Task = poszthoz rendelve** — ha user csere a poszton, a task marad, értesítések az új usernek mennek
5. **Cég főcélja** — minden oldal tetején látszik
6. **Department sorrend:** 7, 1, 2, 3, 4, 5, 6 (fix)
7. **Ne építs semmit jóváhagyás nélkül** — először terv, aztán Robert jóváhagyja, aztán build

---

## STÁTUSZ: JÓVÁHAGYVA, ÉPÍTÉSRE KÉSZ!

Robert jóváhagyta a tervet 2026-04-11-én. Az ETM repo-ban kell dolgozni.
Következő lépés: ETM mappában megnyitni a Claude Code-ot és elkezdeni az implementációt.
