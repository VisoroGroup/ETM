# 2026-06-05 — Napi/heti nézet + havi riport megnyitása minden belépett usernek

**Tags:** access-control, permissions, dayview, weekview, reports, multitenancy, frontend, backend
**Commit:** 8dfd746
**Related:** [[2026-06-04-monthly-report-load-failed]], [[2026-05-17-pug-subsystem-launch]]

## Mit kért

Robert: a napi és heti nézet legyen elérhető mindenkinek, és mindenki lássa benne
mindenki feladatát. Majd kiterjesztette: "sőt a havi nézet is legyen mindenkinek és
mindenkinek a mindenkié elérhető". A "havi nézet" = a meglévő **havi riport** (Raport
lunar, `ReportModal` → `/api/reports/monthly`), NEM új képernyős oldal — ezt előre
tisztáztam, és a tervre rábólintott ("mehet").

## Mit változott

Jogosultság-feloldás 3 nézeten, a tenant-szűrés érintetlenül hagyásával.

- [server/src/routes/dayView.ts](server/src/routes/dayView.ts) — a `/week`, `/` és
  `/pdf/:userId` végpontokon `requireRole('superadmin')` → `requireRole('user')`.
  Plusz access-komment a router tetején.
- [server/src/routes/reports.ts:24](server/src/routes/reports.ts) — a `/monthly`
  végponton `requireRole('admin','manager')` → `requireRole('user')`.
- [client/src/App.tsx:104](client/src/App.tsx) — a `/day-view` és `/week-view`
  route-okról levéve a `<ProtectedRoute allowedRoles={['superadmin']}>` wrapper
  (most nyitott, mint a `/tasks`, `/terminate`).
- [client/src/components/layout/Layout.tsx:39](client/src/components/layout/Layout.tsx)
  — a napi/heti menüpont mindkét sablon-ágban (`full` és `project`/`simple`)
  feltétel nélkül megjelenik (eddig `role.isSuperAdmin ? ... : []`).
- [client/src/components/dashboard/DashboardPage.tsx:391](client/src/components/dashboard/DashboardPage.tsx)
  — a riport-gomb feltétel nélkül látszik (eddig admin/manager/superadmin).
- [client/src/services/api.ts:311](client/src/services/api.ts) — komment frissítve.

## Miért — döntések

**1. `requireRole('user')` = "bárki belépett", nem "csak user-tier".** A
`ROLE_INHERITANCE` (`middleware/auth.ts`) szerint minden szerep effektív listája
tartalmazza a `'user'`-t (superadmin/admin/manager/user mind). Ezért ez a legtisztább
idiomatikus mód a "bármely autentikált felhasználó"-ra. Alternatíva a `requireRole`
teljes elhagyása lett volna (csak `authMiddleware`) — de a `requireRole('user')`
explicit és olvasható.

**2. A frontend route-on a ProtectedRoute wrapper teljes eltávolítása** (nem a 4
szerep felsorolása), mert a cél "literálisan mindenki, aki belépett" — ez a `/tasks`
és `/terminate` mintája. A `/proiecte` felsorolja a 4 szerepet; itt a wrapper-mentes
forma őszintébb.

**3. A "mindenki lássa a mindenkiet" rész már KÉSZ volt az adat-rétegben.** A
`getDayViewData` (dayView.ts) és a havi riport SQL-je eddig is cég-szinten végigment
minden active userön, `company_id`-re szűrve. Tehát NEM kellett az adat-lekérdezést
bővíteni — csak a hozzáférési gátakat levenni. A tenant-izoláció (kemény szabály,
PLANNING §7.1) sértetlen.

**4. A PDF-letöltés (bárki napi listája) is megnyílt.** A gomb a napi nézeten belül
van; külön zárolása látható-de-403 gombot adna. Robert a "mindenkinek a mindenkié
elérhető" megfogalmazással ezt megerősítette.

**5. DashboardPage gomb:** a kondicionális JSX-wrapper teljes eltávolítása + a blokk
újraindentálása (24→20 szóköz). A `user` máshol is használt (`isOverseer`), nincs
orphan változó.

## Gotcha jövő-Claude-nak

- **Ez tudatos hozzáférés-tágítás (2026-06-05).** A napi/heti/havi nézet SZÁNDÉKOSAN
  mindenkinek elérhető a cégen belül. Ha később felmerül "miért lát egy sima user
  mindenkit?" — ez Robert kifejezett kérése volt, nem bug.
- **Cégek közti átlátás továbbra is TILOS.** A megnyitás KIZÁRÓLAG a szerep-gátat
  vette le; a `company_id`-szűrés minden lekérdezésben megmaradt. Új napi/heti/havi
  funkciónál a `req.activeCompanyId`-szűrést KÖTELEZŐ megtartani.
- **`requireRole('user')` a "bárki belépett" minta** ebben a kódbázisban — a
  hierarchia miatt mindenkit átenged. Ne `requireRole()` nélkül, hanem ezzel.
- **A `Layout.tsx` `role.isSuperAdmin` mezője most már sehol nem használt a
  `buildMenuForCompany`-ban**, de szándékosan bent hagytam (a `role` objektumban),
  mert ártalmatlan és jövőbeli menüpont-gatehez kellhet. Ne "takarítsd ki" (Surgical §4).
- **Lint:** a megérintett fájlokban sok pre-existing `no-explicit-any` / unused-import
  hiba van (~30), de EGYIK SEM az általam módosított sorokban — nem javítottam
  (pre-existing adósság, lásd a korábbi brain-eket). Build (`tsc -b && vite build`) zöld.
- **Nincs teszt-harness erre** (szerveren csak dateUtils/validation unit teszt). Robert
  Chrome-ban, egy nem-admin userrel teszteli élesben.

## Hivatkozások

- Commit: 8dfd746 (`feat(access): open day/week views and monthly report to all company members`).
- A havi riport korábbi bugja/kontextusa: [[2026-06-04-monthly-report-load-failed]].
- A napi/heti nézet eredete (PUG-flow): [[2026-05-17-pug-subsystem-launch]].
- Érintett: PLANNING.md §4, TASK.md (Done), `server/src/middleware/auth.ts` (ROLE_INHERITANCE).
