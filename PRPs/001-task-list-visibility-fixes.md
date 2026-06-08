# PRP: Task-lista láthatósági javítások (Emo két bejelentése)

**Státusz:** Approved — Robert jóváhagyta 2026-06-08
**Indítva:** 2026-06-08
**Bejelentő:** Emo (Roberton keresztül)
**Érintett terület:** tasks, task-list, filtering, org-view, multitenancy
**Kapcsolódó:** TASK.md (Active, 2 tétel), brain `2026-06-05-open-day-week-monthly-views`

## Goal

Két, Emo által jelzett task-lista hiba javítása a Visoro Task Managerben:

1. **Bug 1:** a "Sarcinile mele / nálam" nézet idegen (más userre osztott)
   feladatokat is mutat, mert a szűrő valójában "bármiben érintett vagyok"
   (létrehozott VAGY rám osztva VAGY al-lépésem). Robert döntése: válasszuk
   ketté egy **Nálam** (csak rám osztva) és egy **Általam** (általam
   létrehozott) szűrőre.

2. **Bug 2:** újonnan létrehozott feladat nem jelenik meg a listában, de a
   keresés megtalálja. Emo a **Visoro Global** ('full' sablon) cégben látja.
   Két, egymástól független ok, mindkettőt javítjuk:
   - **2.1** A lista fix 50 feladatot tölt be, lapozó nélkül → 50 felett a
     többi láthatatlan.
   - **2.2** A 'full'-sablon szervezeti accordion csak a poszt/szekció/részleg
     besorolású feladatokat jeleníti meg; a besorolás nélküli feladat (csak
     személyre osztva, vagy sehova) lekérdeződik, de sehol nem látszik.

## Context

### Fájlok, amiket olvasni/módosítani kell
- `server/src/routes/tasks.ts` — `GET /` lista-lekérdezés (30–277), a
  `my_tasks` és role=user szűrők (159–178). **Módosul:** új szűrő-paraméterek.
- `client/src/components/tasks/TaskListPage.tsx` — a "Sarcinile mele" gomb
  (472–485), a `loadTasks` (258–275), a nézet-elágazás (629–790).
  **Módosul:** kétállású szűrő, magasabb limit, besorolatlan-csoport.
- `client/src/components/tasks/OrgDepartmentAccordion.tsx` — a szervezeti
  csoportosítás (csak referencia; a besorolatlan-csoport a szülőben épül).
- `client/src/types/index.ts` — `TaskFilters` típus (231–232 körül).
  **Módosul:** új opcionális mezők.
- `client/src/i18n/locales/{ro,hu,en}.json` — `tasks` névtér.
  **Módosul:** új kulcsok.

### Meglévő minták, amiket követünk
- A backend szűrők string-flag stílusúak (`my_tasks: 'true'`, `recurring: 'true'`).
  Az új paraméterek ugyanígy: `assigned_to_me: 'true'`, `created_by_me: 'true'`.
- A DashboardPage (`DashboardPage.tsx:74,149,152`) a `my_tasks=true` (érintett)
  szuperhalmazt kéri le, és kliens-oldalon bontja "assigned"/"created"-re.
  **Ezért a `my_tasks` szemantikáját NEM változtatjuk** — csak ÚJ paramétereket
  adunk hozzá, hogy a dashboard ne törjön.
- A magasabb limit precedense: a dashboard `limit: 500`-zal kér.

### Ismert gotchák
- A role=user default szűrő (tasks.ts:170) minden lista-lekérdezésnél
  ANDeli az "érintett vagyok" feltételt. Az új `assigned_to_me` / `created_by_me`
  ennek részhalmaza, így az AND helyes marad minden szerepnél (sima user is).
- Tenant-izoláció (PLANNING §7.1): a `company_id` szűrő minden ágban marad.
  Az új paraméterek csak a user-szűrést finomítják, a cég-szűrést nem.

## Implementation Plan

1. **Backend — `server/src/routes/tasks.ts`** → verify: `tsc -b` zöld, a query
   helyes paraméterekkel épül.
   - A `req.query` destrukturálásba felvenni: `assigned_to_me`, `created_by_me`.
   - Új feltétel: ha `assigned_to_me === 'true'` → `t.assigned_to = $userId`.
   - Új feltétel: ha `created_by_me === 'true'` → `t.created_by = $userId`.
   - A `my_tasks` ág változatlan marad (dashboard back-compat).

2. **Típus — `client/src/types/index.ts`** → verify: `tsc -b` zöld.
   - `TaskFilters`-be: `assigned_to_me?: string; created_by_me?: string;`
     (a `my_tasks` marad).

3. **i18n — `ro/hu/en.json`, `tasks` névtér** → verify: nincs hiányzó kulcs RO-ban.
   - `filter_assigned_to_me`: RO "Atribuite mie" · HU "Nekem kiosztva" · EN "Assigned to me"
   - `filter_created_by_me`: RO "Create de mine" · HU "Általam létrehozott" · EN "Created by me"
   - `unscoped_group`: RO "Fără atribuire organizatorică" · HU "Szervezeti besorolás nélkül" · EN "Without org assignment"

4. **Frontend — `TaskListPage.tsx`** → verify: vizuális ellenőrzés + build zöld.
   - **Bug 1:** az egy "Sarcinile mele" gomb helyett **két** gomb (kis szegmens):
     "Nálam" (`assigned_to_me`) és "Általam" (`created_by_me`). Egymást kizárók
     (egyik bekapcsolása kikapcsolja a másikat). A lapos-lista nézet akkor jön,
     ha bármelyik aktív. Az üres-állapot és a feltételek (`filters.my_tasks` →
     `filters.assigned_to_me || filters.created_by_me`) frissítése.
   - **Bug 2.1:** a `loadTasks` `tasksApi.list({ ...filters, exclude_status:
     'terminat', limit: 500 })`-zal hív (a dashboard mintájára).
   - **Bug 2.2:** a szervezeti accordion ág alatt (orgDepartments.length > 0)
     egy új "besorolatlan" blokk: a `tasks` azon eleme, aminek nincs
     `assigned_post_id` ÉS nincs `assigned_section_id` ÉS nincs
     `assigned_department_id`. Csak akkor jelenik meg, ha van ilyen feladat.
     A blokk az `OrgTaskRowsList` mintáját vagy a meglévő lapos táblát követi,
     kattintásra `setSelectedTaskId`.

## Validation Loop

- **Lint:** `cd client && npx eslint src/components/tasks/TaskListPage.tsx
  src/types/index.ts` és `cd server && npx eslint src/routes/tasks.ts`
  — a megérintett sorokban 0 új hiba (a pre-existing `no-explicit-any`
  adósságot nem javítjuk, Surgical §4).
- **Build (a prod build a szigorúbb):** `cd client && npx tsc -b` és a szerver
  oldalon `npx tsc -b` — zöld.
- **Manuális teszt (Robert, élesben Chrome):**
  1. Visoro Global cég, "Sarcinile" oldal. Kapcsold be a **Nálam** szűrőt →
     csak a rád osztott feladatok. Kapcsold be az **Általam** szűrőt → csak az
     általad létrehozottak. Egy másra osztott, általad NEM létrehozott feladat
     a Nálam alatt NEM látszik.
  2. Hozz létre egy feladatot, oszd egy posztra → jelenjen meg a szervezeti
     nézet megfelelő részlegénél.
  3. (Besorolatlan teszt) Egy személyre osztott, poszt nélküli feladat
     jelenjen meg a "Szervezeti besorolás nélkül" blokkban.
  4. Ha >50 nyitott feladat van, mind látszódjon (500-ig).

## Out of Scope

- **Valódi lapozás / végtelen görgetés.** Most a limitet 500-ra emeljük (a
  dashboard mintájára). Ha a Visoro Global valaha 500+ nyitott feladatot
  ér el, a lapozás külön task lesz.
- **A `my_tasks` paraméter és a DashboardPage logikájának átírása** — érintetlen.
- **A közös `authedFetch` wrapper** (TASK.md backlog) — nem ez a feladat.
- **Dangling FK eset** (feladat olyan poszt/szekció/részleg ID-val, ami már
  nem létezik az org-fában) — ritka; a "nincs FK" besorolatlan-csoport a
  bejelentett esetet fedi. Ha előjön, külön kezeljük.
