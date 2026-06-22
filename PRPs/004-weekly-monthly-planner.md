# PRP: 004 — Heti és havi tervező (Planificare săptămânală / lunară)

**Státusz:** Draft — 2026-06-22. **Jóváhagyásra vár** (Robert). Két kérdés-kör után
összeállt a scope (lásd a session-beszélgetést).

## Goal

Új, kézi **tervező** alrendszer az ETM-be. A meglévő napi/heti nézet és havi riport
a feladatok **határideje** szerint, automatikusan listáz — ez érintetlen marad. Az új
tervező ezzel szemben **kézi kuráció**: a felhasználó a feladatlistában bejelöli, mely
meglévő feladatokat szándékozik **ezen a héten** (illetve **ebben a hónapban**)
elvégezni, függetlenül attól, mikor van a határidejük. Cél, hogy mindenki össze tudja
állítani a saját heti és havi tennivaló-listáját a meglévő feladatokból, a vezető pedig
egy összesített nézetben lássa, ki mit tervezett be.

Ezzel egyidejűleg a régi, határidő-alapú **heti nézet** és a **havi riport** kikerül,
és a Tervező lép a helyükre. A **napi nézet marad** (operatív „mi van ma").

## Döntések (a két kérdés-körből — ezek a terv alapjai)

1. **A terv külön réteg.** A betervezés NEM módosítja a feladat `due_date`-jét. Egy
   júliusi határidős feladat is betehető a mostani heti tervbe. A terv = személyes
   szándék; a határidő = üzleti tény. Külön táblában él, nem a `tasks`-ban.
2. **Heti → havi automatikus irány (egyelőre).** A heti terv az elsődleges: amit a
   hetibe teszel, az automatikusan beleszámít a havi tervbe (ugyanannak a hónapnak).
   A havihoz közvetlenül is adható feladat (ami nincs konkrét hétre téve). A fordított
   irány (havi a forrás, abból szemezünk a hetibe) **későbbi fázis** — Robert:
   „gradiensenként kezdjük".
3. **Bejelöléssel kerül a tervbe.** A feladatlista meglévő jelölőnégyzetes
   kiválasztására építünk: a kijelölt feladatokat egy gomb teszi a heti (vagy havi)
   tervbe. Nincs drag-and-drop ebben a fázisban.
4. **Be-nem-fejezett tételek átgörögnek.** A hét végén a még nem `terminat` heti
   tételek átkerülnek a következő hét tervébe (havi szinten ugyanígy).
5. **Behúzható feladatok köre:** a felhasználóhoz **rendelt** feladatok (`assigned_to`),
   PLUSZ a több-szereplős feladatok, ahol a felhasználónak **van subtaskja**. Csak a
   sajátját látja a tervében; a megosztott (subtaskos) feladat minden érintettnél
   megjelenhet.
6. **Hozzáférés:** a saját tervet minden belépett felhasználó kezeli
   (`requireRole('user')`). A **céges összesített** nézetet (mindenki terve, user
   szerint csoportosítva) **csak három konkrét személy** látja (Robert döntése,
   2026-06-22): **Ledényi Emőke** (`12c31954-6e1e-476d-a077-4e3dc635bef6`, admin),
   **Róbert LEDÉNYI** (`e2be1cdd-223e-403f-aa2b-cb0cb950b817`, superadmin), **Mária
   VASZI** (`da0fb403-6436-44aa-95b5-f46ff6569856`, admin). Ez **user-whitelist**, NEM
   szerep-alapú gát — más admin/manager NEM látja. Megvalósítás: szerver-oldali konstans
   `COMPANY_PLAN_VIEWER_IDS` (a fenti id-k, kommentben a nevek); a `/company/*` route ezt
   ellenőrzi a `req.user.id`-vel. A tenant-szűrés EZ FELETT is érvényes (mindenki csak az
   aktív cége terveit látja).
7. **Megjelenés:** egy új **„Tervező" (Planificare)** menüpont, benne két fül
   (Heti / Havi), és vezetőknek egy kapcsoló a „Céges áttekintés"-re.
8. **A régi nézetek leváltása (Robert, 2026-06-22):** a meglévő határidő-alapú
   **heti nézet** (`/week-view`) és a **havi riport** (Dashboard „Raport lunar" gomb →
   `/api/reports/monthly`, PDF/Excel) **kikerül**. A **napi nézet marad**. A régi
   heti-nézet webcím a Tervezőre **irányít át** (könyvjelzők nem törnek). A havi riport
   **teljesen megy** (a statisztika-exportot nem használták). **FONTOS:** ez NEM a
   lezáráskor küldött »completion report« e-mail — az másik rendszer (brain 2026-06-04),
   érintetlen marad.

## Context

- **Olvasandó fájlok (minták + érintett kód):**
  - `server/src/routes/dayView.ts` — a kanonikus „nézet" route: tenant-scoping,
    `requireRole('user')`, per-user csoportosítás, hét-kezdő (`start`) számítás. Ezt
    követjük a planner route-nál. (A hét kezdő-napjának konvencióját INNEN vesszük át,
    hogy a tervező és a meglévő heti nézet ugyanazt a hetet jelentse.)
  - `server/src/routes/reports.ts` — `requireRole('user')` feloldás mintája (2026-06-05).
  - `server/src/routes/tasks.ts` — a tenant-scoping idióma (`req.activeCompanyId` guard,
    `WHERE t.company_id = $n`), és az `assigned_to_me` query-param logika (a behúzható
    feladatok szűréséhez újrahasznosítható).
  - `server/src/routes/taskSubtasks.ts` — a subtask FK cross-company guard mintája.
  - `server/src/database/migrations/` — a legutóbbi migráció a számozáshoz; a tenant-
    scoped tábla mintája (`company_id INTEGER NOT NULL REFERENCES companies(id)`,
    indexek). A jelenlegi csúcs: 093 (lásd PLANNING §4.1) → az új migráció **094**.
  - `server/src/cron/emailScheduler.ts` — node-cron + DB-alapú distributed lock minta
    (multi-replica Railway) — az átgörgető job ezt követi.
  - `client/src/components/tasks/TaskListPage.tsx` — meglévő `selectedIds` multi-select
    + bulk-action sáv (status/assign/delete). Ide kerül az „Add to plan" gomb.
  - `client/src/components/dayview/WeekViewPage.tsx` és `DayViewPage.tsx` — a per-user
    csoportosított megjelenítés mintája a céges áttekintő nézethez.
  - `client/src/components/dashboard/DashboardPage.tsx` — a `renderTaskRow` flex-sor +
    `InlineStatusPill` minta a tervezett-feladat sorokhoz.
  - `client/src/App.tsx` (route-ok, ~104) + `client/src/components/layout/Layout.tsx`
    (menü, ~39, mindkét sablon-ág) — új `/planner` route + menüpont.
  - `client/src/services/api.ts` — API-kliens minta (`X-Active-Company` interceptor).
  - `server/src/i18n/serverI18n.ts` (ha kell szerver-oldali szöveg) +
    `client/src/i18n/locales/ro.json` / `hu.json` — i18n kulcsok (RO master, HU; EN
    RO-fallback, lásd PLANNING §8).
- **Követendő minták:**
  - Tenant-scoping: MINDEN planner-query `WHERE company_id = req.activeCompanyId`; az
    FK-knál (task_id) ellenőrizzük, hogy a task a cégben van (`taskSubtasks.ts` minta).
  - „Bárki belépett" = `requireRole('user')` (a hierarchia miatt mindenkit átenged);
    a céges nézet külön, magasabb gát (2026-06-05 brain).
  - i18n: RO + HU minden új kulcsra; EN kihagyható (RO-fallback).
- **Ismert gotchák:**
  - **Soft-delete:** a `tasks` `deleted_at IS NULL` szűrésű. A planner lekérdezések is
    JOIN-oljanak a `tasks`-ra és szűrjenek `deleted_at IS NULL`-ra, hogy törölt feladat
    ne maradjon a tervben (vagy a tábla `ON DELETE CASCADE`, de a soft-delete nem
    triggereli a CASCADE-et → a JOIN-szűrés a biztos).
  - **Cégváltás:** a planner mindig a `req.activeCompanyId`-re szűr; multi-céges
    usernél a tervek cégenként külön élnek.
  - **Hét/hónap határ a periódus-kulcsban:** a `period_start` DATE legyen a hét hétfője
    (week) / a hónap 1-je (month), hogy a kulcs determinisztikus és join-olható legyen.
  - **Lint:** a kódbázisban sok pre-existing eslint debt van; az ÚJ sorokban 0 hibát
    célzunk, a meglévőt nem javítjuk (Surgical §4).
  - **A havi riport ≠ completion report e-mail.** A `reports.ts` `/monthly` a Dashboard
    havi riportját szolgálja (EZ megy ki). A lezáráskor küldött összesítő e-mail
    (`notificationEmailService.ts`, `serverI18n.ts` `report.*` kulcsok) MÁS rendszer
    (brain 2026-06-04) — azt NEM bántjuk. A `reports.ts` törlése előtt KÖTELEZŐ
    végigolvasni: ha van benne a completion-PDF által is használt közös segédfüggvény,
    az marad; csak a `/monthly` route + a kizárólag általa használt kód megy.
  - **A `dayView.ts` `/week` végpont** a heti nézet backendje. A napi nézet a `/` és a
    `/pdf/:userId` végpontot használja → a `/week` törölhető, DE előbb ellenőrizni, hogy
    tényleg csak a `WeekViewPage` fogyasztja (a napi nézet ne sérüljön).

## Adatmodell

Új tábla **`planned_tasks`** (migráció 094):

| Oszlop | Típus | Megjegyzés |
|--------|-------|-----------|
| `id` | UUID PK (`uuid_generate_v4()`) | |
| `task_id` | UUID NOT NULL → `tasks(id)` ON DELETE CASCADE | mit terveztek be |
| `user_id` | UUID NOT NULL → `users(id)` ON DELETE CASCADE | kié a terv |
| `company_id` | INTEGER NOT NULL → `companies(id)` | tenant-scoping |
| `scope` | TEXT NOT NULL CHECK (`scope IN ('week','month')`) | heti vagy közvetlen havi |
| `period_start` | DATE NOT NULL | hét hétfője / hónap 1-je |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | |

- **UNIQUE** (`user_id`, `task_id`, `scope`, `period_start`) — egy feladat egyszer
  szerepel egy adott user adott periódusában.
- **Indexek:** (`user_id`, `company_id`, `scope`, `period_start`) a saját nézethez;
  (`company_id`, `scope`, `period_start`) a céges áttekintőhöz.

**A „heti → havi automatikus" megvalósítása (kulcsdöntés):** a havi terv **számolt**,
nem duplikált. A havi nézet a következők uniója egy adott hónapra:
- minden `scope='month'` sor, ahol `period_start` = a hónap 1-je (közvetlen havi), ÉS
- minden `scope='week'` sor, ahol `period_start` hónapja = az adott hónap (a heti
  tételek automatikusan beleszámítanak).

Így a heti behúzás külön havi sor írása nélkül megjelenik a haviban; nincs szinkron-
probléma. (Ezért a `scope='month'` sorok csak a *közvetlenül* haviba tett feladatok.)

## Implementation Plan

1. **Migráció `094_create_planned_tasks.sql`** (a fenti séma + indexek).
   → Ellenőrzés: a migráció lefut helyi/Railway Postgres-en, tábla létrejön.
2. **Típusok:** `server/src/types/index.ts` + `client/src/types/index.ts` — `PlannedTask`
   és a planner-válasz típusok (heti lista eleme = task-mező-részhalmaz + `period_start`).
   → Ellenőrzés: tsc zöld.
3. **Backend route `server/src/routes/planner.ts` (új), bekötve `app.ts`-be `/api/planner`:**
   - `GET /week?start=YYYY-MM-DD` — a belépett user heti terve (JOIN tasks, teljes
     megjelenítő mezők + státusz). `requireRole('user')`, tenant-scoped.
   - `GET /month?month=YYYY-MM` — havi terv a fenti **unió** szerint.
   - `POST /week` body `{ start, task_ids[] }` — a kijelölt feladatok heti tervbe;
     szerveroldali validáció: minden task a cégben van ÉS (assigned_to = user VAGY a
     usernek van benne subtaskja). Idempotens (UNIQUE → ON CONFLICT DO NOTHING).
   - `POST /month` body `{ month, task_ids[] }` — közvetlen havi hozzáadás (ugyanaz a
     validáció).
   - `DELETE /week/:taskId?start=...` és `DELETE /month/:taskId?month=...` — kivétel.
   - `GET /company/week?start=...` és `GET /company/month?month=...` — összesítő, user
     szerint csoportosítva. Gát: **user-whitelist** (`COMPANY_PLAN_VIEWER_IDS` = Emőke,
     Róbert, Mária id-i) a `requireRole('user')` felett; nem whitelistelt user → 403.
     Tenant-szűrés a query-ben végig (`company_id = req.activeCompanyId`).
   → Ellenőrzés: szerver tsc zöld; kézi curl/Thunder a 8 végpontra (cég-szűrés stimmel).
4. **API-kliens `client/src/services/api.ts`:** `plannerApi` — `getWeek/getMonth`,
   `addToWeek/addToMonth`, `removeFromWeek/removeFromMonth`, `getCompanyWeek/getCompanyMonth`.
   → Ellenőrzés: tsc zöld.
5. **Tervező oldal `client/src/components/planner/PlannerPage.tsx` (új):**
   - Két fül (Heti / Havi) + periódus-navigáció (előző/következő hét ill. hónap).
   - A betervezett feladatok listája a Dashboard sor-stílusában (`InlineStatusPill`,
     státusz-csík, cím + halvány meta), soronként „Kivétel a tervből" gomb.
   - Üres állapot szöveg + a hetiben jelölés az átgörgetett tételekre.
   - Vezetőknél kapcsoló: „Saját terv" / „Céges áttekintés" → utóbbi a `WeekViewPage`
     per-user csoportosítás mintájával (user-fejléc + az ő tervezett tételei).
   → Ellenőrzés: vite build zöld; az oldal betölt, a fülek és a navigáció működnek.
6. **Behúzás a feladatlistából `client/src/components/tasks/TaskListPage.tsx`:** a
   meglévő bulk-action sávba (ahol a Status/Assign/Delete van) új gomb:
   **„Adaugă în planul săptămânii"** (+ a havi opció). A `selectedIds`-t POST-olja a
   `plannerApi.addToWeek`-nek az aktuális hét `start`-jával; siker után visszajelzés.
   → Ellenőrzés: néhány feladat kijelölése → gomb → megjelennek a Tervezőben.
7. **Route + menü:** `client/src/App.tsx` — `/planner` lazy route, nyitott minden
   belépettnek (mint `/day-view`). `client/src/components/layout/Layout.tsx` — „Tervező"
   (Planificare) menüpont mindkét sablon-ágban (`full` és `project`/`simple`).
   → Ellenőrzés: a menüpont látszik, a route navigál.
8. **Átgörgető cron `server/src/cron/` (a `emailScheduler.ts` distributed-lock mintával):**
   heti job (hétfő hajnal), amely az előző hét `scope='week'` tételeit, ha a hozzájuk
   tartozó task `status != 'terminat'` és nincs törölve, beszúrja a következő hét
   `period_start`-jával (ON CONFLICT DO NOTHING). Havi átgörgetés a hónap
   1-jén CSAK a közvetlen `scope='month'` tételekre (a heti tételek számoltan jelennek
   meg a haviban, ezért azokat külön görgetni NEM kell).
   → Ellenőrzés: a job egyszer fut le replikánként (lock), a be-nem-fejezett tételek
     átkerülnek; a `terminat`-ok nem.
9. **i18n:** `ro.json` + `hu.json` — planner-kulcsok (`planner.title`, `planner.week`,
   `planner.month`, `planner.add_to_week`, `planner.add_to_month`, `planner.remove`,
   `planner.company_view`, `planner.my_plan`, `planner.empty`, `planner.rolled_over`).
   → Ellenőrzés: a JSON-ok érvényesek; nincs nyers kulcs a felületen.
10. **A régi heti nézet eltávolítása + átirányítás:** `client/src/App.tsx` — a
    `/week-view` route helyett `<Navigate to="/planner" replace />`; a `WeekViewPage`
    import + (ha máshol nem használt) a komponens-fájl törlése.
    `client/src/components/layout/Layout.tsx` — a „Heti nézet" menüpont eltávolítása
    mindkét sablon-ágban (a „Napi nézet" marad). A `dayView.ts` `/week` végpont törlése,
    ha csak a `WeekViewPage` használta.
    → Ellenőrzés: a régi `/week-view` cím a Tervezőre visz; a menüben nincs „Heti nézet",
      a „Napi nézet" megvan és működik.
11. **A havi riport teljes eltávolítása:** `DashboardPage.tsx` — a „Raport lunar" gomb +
    a `ReportModal` használat törlése (a 2026-06-05-ben feloldott blokk); a
    `client/src/components/dashboard/ReportModal.tsx` fájl törlése; `server/src/routes/reports.ts`
    `/monthly` végpont + az `app.ts` bekötés eltávolítása (a fájlban máshol használt kód
    megtartásával — lásd gotcha). A frontend `report.*` i18n-kulcsok törölhetők; a
    **szerver** `serverI18n.ts` `report.*` kulcsok MARADNAK (completion-e-mail).
    → Ellenőrzés: a Dashboardon nincs riport-gomb; `/api/reports/monthly` már nincs;
      a lezárás-e-mail (completion report) változatlanul megy.

## Validation Loop

- `cd client && npx tsc -b && npx vite build` → zöld
- `cd server && npx tsc --noEmit` → zöld
- `npx eslint` az érintett/új fájlokra → 0 ÚJ hiba (pre-existing debt nem nő)
- Manuális (Robert élesben deploy után):
  - (a) **Superadmin (Robert):** a feladatlistában kijelöl 2-3 feladatot →
    „Adaugă în planul săptămânii" → a Tervező Heti fülén megjelennek; a Havi fülön is
    látszanak (ugyanaz a hónap). Egyet kivesz → eltűnik.
  - (b) **Sima user (magic-linkkel, nem-admin):** csak a saját (rárendelt + subtaskos)
    feladatait tudja betervezni; a céges áttekintő nézet NEM érhető el neki.
  - (c) **Vezetői nézet:** Robert a „Céges áttekintés"-ben látja mindenki tervét, user
    szerint csoportosítva.
  - (d) **Tenant-izoláció:** másik céggel belépve más (vagy üres) terv; nincs átszivárgás.
  - (e) **Átgörgetés:** egy be-nem-fejezett heti tételen a hét fordulóján ellenőrizni,
    hogy átkerült a következő hétre (vagy a cron kézi triggerével tesztelni).
  - (f) **Régi nézetek:** a „Heti nézet" menüpont eltűnt, a régi `/week-view` cím a
    Tervezőre visz; a „Napi nézet" megvan és működik; a Dashboardon nincs havi riport
    gomb; a lezárás-e-mail (completion report) viszont továbbra is megy.

## Out of Scope

- **Fordított irány** (havi a forrás/prioritás, abból a heti) — későbbi fázis
  (Robert: „egyelőre gradiensenként", a heti az elsődleges most).
- **Drag-and-drop** behúzás — most jelölőnégyzet + gomb.
- **Naptár-rács** vizualizáció a tervezőben — most lista (a meglévő heti nézet marad a
  rácsos, határidő-alapú).
- **A napi nézet** (operatív, határidő-alapú) — **marad**, nem módosítjuk. (A heti nézet
  és a havi riport viszont kikerül — lásd 8. döntés.)
- **A lezáráskor küldött »completion report« e-mail** — érintetlen (más rendszer, nem a
  most törölt Dashboard-havi-riport; lásd a gotchát).
- **PDF/Excel export** a tervről — nem ebben a körben.
- **Több-assignee adatmodell** változtatása (a subtask-alapú megosztás a meglévő modellt
  használja, nem vezetünk be új many-to-many assignment-et a fő taskra).
- **A `due_date` bármilyen automatikus módosítása** a betervezéskor (lásd 1. döntés).

## Eldöntött kérdések (2026-06-22, Robert)

- **Céges nézet gátja:** NEM szerep-alapú. Pontosan három személy — Ledényi Emőke,
  Róbert LEDÉNYI, Mária VASZI (user-whitelist, lásd 6. döntés). Más admin nem látja.
- **Havi átgörgetés:** elég a **heti** átgörgetés; a közvetlen `scope='month'` tételek a
  hónap fordulóján görögnek. A heti tételekre külön havi görgetés nem kell (számoltan
  jelennek meg a haviban).
- **Jóváhagyás:** a scope és a fenti döntések Robert által megerősítve (2026-06-22).
  Kód-építés indul; a `main`-re push (éles deploy) külön, Robert engedélyével.
