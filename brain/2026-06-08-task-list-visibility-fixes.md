# 2026-06-08 — Task-lista láthatósági javítások (Emo 2 bug)

**Tags:** tasks, task-list, filtering, org-view, multitenancy, frontend, backend
**Commit:** 21eab7a
**Related:** PRPs/001-task-list-visibility-fixes.md, [[2026-06-05-open-day-week-monthly-views]], [[2026-06-04-monthly-report-load-failed]]

## Mit kért

Emo (Roberton keresztül) két task-lista hibát jelzett (Visoro Global, 'full' sablon):
1. A "Sarcinile mele / nálam" nézetben más user (Timi) taskjai is megjelennek — pedig
   ő a "nálam" (rám rendelve) nézetben van, nem a "created" (általam) szűrőn.
2. Kollégák létrehoznak taskot, az nem jelenik meg a listákban, de **kereséssel megvan**.
   "Továbbra is fennáll" — visszatérő.

Robert döntései: Bug 1 — válasszuk **ketté** a szűrőt (Nálam / Általam). Bug 2 (Visoro
Global) — mindkét okot javítsuk.

## Mit változott

**Bug 1 — a "Sarcinile mele" kettéválasztása**
- [server/src/routes/tasks.ts](server/src/routes/tasks.ts) `GET /` — két új query-param:
  `assigned_to_me === 'true'` → `t.assigned_to = $userId`; `created_by_me === 'true'` →
  `t.created_by = $userId`. A régi `my_tasks` (created OR assigned OR subtask) **érintetlen**
  (a DashboardPage erre épül, kliens-oldalon bontja). A role=user default klóz (érintett vagyok)
  is maradt; az új paramok ANDelődnek vele, de részhalmazok, így helyes minden szerepnél.
- [client/src/components/tasks/TaskListPage.tsx](client/src/components/tasks/TaskListPage.tsx) —
  az egy "Sarcinile mele" gomb helyett **két** gomb: "Atribuite mie" (`assigned_to_me`) és
  "Create de mine" (`created_by_me`), egymást kizárók (egyik bekapcsolása nullázza a másikat).
  Új derived `isPersonalView` váltja a lapos-lista nézetet (a régi `filters.my_tasks` minden
  hivatkozása erre cserélve). `activeFilterCount` mostantól mindhárom személyes kulcsot kizárja.
- [client/src/types/index.ts](client/src/types/index.ts) — `TaskFilters`: +`assigned_to_me?`,
  +`created_by_me?` (a `my_tasks` marad).
- i18n: `tasks.filter_assigned_to_me`, `tasks.filter_created_by_me` RO+HU-ban (en.json NEM kap —
  RO-fallback, lásd [[2026-05-30-drop-english-language]]).

**Bug 2 — a hiányzó taskok**
- [client/src/components/tasks/TaskListPage.tsx](client/src/components/tasks/TaskListPage.tsx)
  `loadTasks` — a lista mostantól `limit: 500`-zal kér (eddig limit nélkül → backend default 50,
  lapozó UI sehol). A dashboard precedensét követi (az is 500).
- Ugyanitt: a szervezeti accordion nézetbe egy új **"Fără atribuire organizatorică"** csoport
  (`unscopedTasks` = nincs `assigned_post_id` ÉS `assigned_section_id` ÉS `assigned_department_id`),
  `OrgTaskRowsList`-tel renderelve. Csak akkor látszik, ha van ilyen task.
- i18n: `tasks.unscoped_group` RO+HU.

## Miért — döntések

**1. Miért nem nyúltam a `my_tasks`-hoz?** A DashboardPage (`DashboardPage.tsx:74,149,152,640`)
a `my_tasks=true` (érintett) szuperhalmazt kéri le, és **kliens-oldalon** bontja
assigned/created-re. Ha a `my_tasks` szemantikáját átírom, a dashboard "általad létrehozott"
statisztikája törik. Ezért ÚJ paramokat adtam, a régit hagytam.

**2. Bug 1 gyökere nem klasszikus bug volt.** A "Sarcinile mele" szándékosan "érintett vagyok"
(created OR assigned OR subtask-assignee). Emo elvárása "rám rendelve" — innen a félreértés.
A szétválasztás (Robert A opció) oldja fel: a "Nálam" most tényleg `assigned_to=én`.

**3. Bug 2 KÉT független ok, mindkettő ugyanazt a tünetet adja:**
- **50-es limit, lapozó nélkül** — minden cégtípusnál. >50 nyitott tasknál a többi nem
  töltődik be; a kereső (search.ts, saját lekérdezés, updated_at szerint) viszont megtalálja.
- **Szervezeti void (csak 'full'):** az accordion CSAK a poszt/szekció/részleg besorolású
  taskot rendereli ([OrgDepartmentAccordion.tsx:30,217,229](client/src/components/tasks/OrgDepartmentAccordion.tsx:30)).
  Besorolás nélküli task (csak személyre, vagy sehova) lekérdeződik, de sehol nem látszik.
  Az "Új feladat" űrlap 'full'-nál kötelezővé teszi a posztot, ezért ez főleg MCP / külső API
  úton létrejött taskot érint.

**4. Limit 500, nem valódi lapozás.** Egyszerű, dashboard-konzisztens, és a Visoro Global jó
darabig nem ér 500 nyitott task fölé. Robert tudott róla és elfogadta (PRP "Out of Scope").

**5. A besorolatlan-csoport a 'full' org-nézet tetején (a részlegek előtt), amber színnel** —
hogy a korábban láthatatlan taskok rögtön szembetűnjenek. Csak ha `unscopedTasks.length > 0`.

## Gotcha jövő-Claude-nak

- **`my_tasks` ÉL TOVÁBB, csak a DashboardPage használja.** A TaskListPage már NEM. Ha a
  dashboardot bántod, tudd: az a `my_tasks=true` érintett-szuperhalmazra épül, kliens-oldali
  bontással. Ne "egységesítsd" a TaskListPage új `assigned_to_me`/`created_by_me` paramjaival
  gondolkodás nélkül.
- **Az 500-as limit MÉG MINDIG plafon.** Ha a Visoro Global átlépi az 500 nyitott taskot, a
  tünet visszajön — akkor kell a valódi lapozás / "továbbiak" gomb (külön task). Nem csendes
  vágás: a PRP Out-of-Scope rögzíti.
- **A besorolatlan-csoport csak a 'full' (orgDepartments>0) ágban renderel.** A 'simple'/'project'
  sablon a fallback lapos listát (`tasks.map`) használja, ott amúgy is minden látszik (≤500).
- **A role=user default klóz (tasks.ts ~169) ÉL.** Sima user csak az érintett taskjait kérheti le;
  az új `assigned_to_me`/`created_by_me` ezzel ANDelődik (részhalmaz → helyes). Admin/manager/
  superadminnál nincs ez a klóz, ott az új param maga szűr.
- **Tenant-izoláció érintetlen** (PLANNING §7.1): minden ág `company_id`-re szűr; az új paramok
  csak a user-szűrést finomítják.
- **Ellenőrzés állapota:** kliens `tsc -b && vite build` zöld, szerver `tsc` zöld (ez fut élesen).
  Lint csak pre-existing (a TaskListPage tele van régi no-explicit-any/unused hibával, EGYIK SEM az
  én soraimban — nem javítottam, Surgical §4). **Élő, nem-admin vizuális teszt NEM készült el** a
  session alatt (MS365 SSO superadminként léptet be; nem-admin/magic-link kéne — lásd
  [[2026-06-05-open-day-week-monthly-views]] gotcha). Robert élesben (Visoro Global) teszteli.
- **`server/tsconfig.tsbuildinfo`** untracked maradt a buildtől (nincs gitignore-olva). Nem
  commitoltam; ártalmatlan build-artifact. Ha zavar, gitignore-ba tehető (külön, apró meló).

## Hivatkozások

- Commit: 21eab7a (`fix(tasks): split my-tasks filter and surface hidden tasks in the list`).
- PRP: PRPs/001-task-list-visibility-fixes.md (Approved 2026-06-08).
- Kereső, ami "megtalálja" a rejtett taskot: [server/src/routes/search.ts](server/src/routes/search.ts).
- A szervezeti nézet eredete: [[2026-05-17-pug-subsystem-launch]]; hozzáférés-tágítás: [[2026-06-05-open-day-week-monthly-views]].
